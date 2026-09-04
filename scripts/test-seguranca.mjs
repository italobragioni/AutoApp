/**
 * Teste de recuperacao de senha e verificacao de e-mail.
 *
 * TESTE 1  conta existente pede recuperacao -> token valido criado
 * TESTE 2  e-mail inexistente -> a MESMA resposta na tela
 * TESTE 3  token expirado -> redefinicao bloqueada
 * TESTE 4  token ja usado -> reutilizacao bloqueada
 * TESTE 5  senha redefinida -> login com a nova senha funciona
 * TESTE 6  token de verificacao -> e-mail passa para verificado
 * TESTE 7  o mesmo token de verificacao de novo -> bloqueado
 * TESTE 8  reenvios seguidos -> protecao contra abuso
 *
 * O teste le o link na "caixa de saida" do servidor, como um usuario leria no
 * e-mail. Por isso o servidor precisa subir com o transporte de arquivo:
 *
 *   MAIL_TRANSPORT=file npm run start
 *   CHROMIUM_PATH=/caminho/chrome node scripts/test-seguranca.mjs
 *
 * O banco nunca guarda o token em claro, entao ler pelo Prisma nao seria
 * possivel — e essa e justamente a garantia que o teste 1 confere.
 */
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

import { ativarAssinatura } from "./_billing.mjs";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const CHROME = process.env.CHROMIUM_PATH;
const OUTBOX = process.env.MAIL_OUTBOX_FILE ?? ".mail-outbox.log";
const fails = [];
const noise = [];

const db = new PrismaClient();

function check(ok, label) {
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}`);
  if (!ok) fails.push(label);
}

/** Identidade propria por execucao: o teste cria uma conta de verdade. */
const TAG = `s${Math.floor(Date.now() / 1000) % 100000}`;
const EMAIL = `seguranca.${TAG}@autovolt.com.br`;
const SENHA_ANTIGA = "senhaAntiga123";
const SENHA_NOVA = "senhaNova456";

/** Mensagens que sairam para um endereco, da mais recente para a mais antiga. */
async function caixaDeEntrada(email) {
  let conteudo = "";
  try {
    conteudo = await readFile(OUTBOX, "utf8");
  } catch {
    return [];
  }
  return conteudo
    .split("\n")
    .filter(Boolean)
    .map((linha) => JSON.parse(linha))
    .filter((m) => m.to === email)
    .reverse();
}

/**
 * Extrai o link de um corpo de mensagem, ja na origem que o teste navega.
 *
 * O link nasce com a origem de NEXT_PUBLIC_APP_URL (localhost:3000), e a suite
 * dirige 127.0.0.1:3000. Sao origens diferentes para o navegador, entao o
 * cookie de sessao de uma nao vale na outra — trocar a origem aqui evita que o
 * teste "perca a sessao" por um detalhe de ambiente, sem afrouxar nada do que
 * ele verifica: o token continua sendo exatamente o que saiu na mensagem.
 */
function linkDe(mensagem) {
  const bruto = mensagem?.text.match(/https?:\/\/\S+/)?.[0] ?? null;
  if (!bruto) return null;
  const url = new URL(bruto);
  const base = new URL(BASE);
  url.protocol = base.protocol;
  url.host = base.host;
  return url.toString();
}

async function esperarMensagem(email, trecho) {
  for (let tentativa = 0; tentativa < 25; tentativa++) {
    const mensagens = await caixaDeEntrada(email);
    const encontrada = mensagens.find((m) => m.subject.includes(trecho));
    if (encontrada) return encontrada;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return null;
}

const b = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

async function novaAba(nome) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: "pt-BR" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => noise.push(`pageerror (${nome}) em ${page.url()}: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") noise.push(`console (${nome}) em ${page.url()}: ${m.text()}`);
  });
  return page;
}

async function pedirRecuperacao(page, email) {
  await page.goto(`${BASE}/esqueci-senha`, { waitUntil: "networkidle" });
  await page.fill('#forgot-form input[name="email"]', email);
  await page.click('#forgot-form button[type="submit"]');
  await page.waitForSelector("[data-recovery-sent]", { timeout: 10000 });
  return page.locator("[data-recovery-sent]").innerText();
}

// Duas abas: a que se cadastrou (com sessao) e a de quem esqueceu a senha
// (sem sessao). A tela de recuperacao vive no grupo (auth), que manda quem
// esta logado para o painel — e assim que um usuario real chega nela.
const p = await novaAba("logado");
const anon = await novaAba("deslogado");
await p.goto(`${BASE}/cadastro`, { waitUntil: "networkidle" });
await p.fill('input[name="name"]', `Teste ${TAG}`);
await p.fill('input[name="companyName"]', `Empresa ${TAG}`);
await p.fill('input[name="email"]', EMAIL);
await p.fill('input[name="password"]', SENHA_ANTIGA);
await p.click('button[type="submit"]');
// O cadastro leva à assinatura (SaaS pago). Ativa como o webhook da Cakto faria,
// para que os logins seguintes cheguem ao painel.
await p.waitForURL("**/assinatura", { timeout: 20000 });
await ativarAssinatura(db, EMAIL);
await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });

const conta = await db.user.findUnique({
  where: { email: EMAIL },
  select: { id: true, passwordHash: true, emailVerifiedAt: true },
});
check(Boolean(conta), `conta criada pelo cadastro (${EMAIL})`);
check(conta.emailVerifiedAt === null, "e-mail começa como não verificado");

// ---------------------------------------------------------------- TESTE 1
console.log("\n══ TESTE 1: pedido de recuperação cria token válido ══");

const respostaExistente = await pedirRecuperacao(anon, EMAIL);
check(
  respostaExistente.includes("Se houver uma conta"),
  "tela confirma o pedido com a resposta genérica",
);

// O servidor de teste roda em modo producao (`next start`), entao o link NAO
// pode aparecer na tela — so na mensagem.
check(
  (await anon.locator("[data-recovery-link]").count()) === 0,
  "em produção a tela não expõe o link",
);

const mensagem = await esperarMensagem(EMAIL, "Redefinir sua senha");
check(Boolean(mensagem), "mensagem de recuperação saiu pela camada de e-mail");
const linkRecuperacao = linkDe(mensagem);
check(
  linkRecuperacao?.includes("/redefinir-senha/"),
  `link de redefinição gerado (${linkRecuperacao?.slice(0, 44)}...)`,
);

const tokenRecuperacao = linkRecuperacao.split("/").pop();
const registro = await db.authToken.findFirst({
  where: { userId: conta.id, purpose: "recuperacao" },
  orderBy: { createdAt: "desc" },
});
check(Boolean(registro), "token registrado no banco");
check(registro.usedAt === null, "nasce não utilizado");
check(registro.expiresAt > new Date(), "tem prazo de expiração");
check(tokenRecuperacao.length >= 40, `token longo (${tokenRecuperacao.length} caracteres)`);

// O banco guarda o hash, nunca o token.
const hashEsperado = createHash("sha256").update(tokenRecuperacao).digest("hex");
check(registro.tokenHash === hashEsperado, "banco guarda o SHA-256 do token");
check(
  !registro.tokenHash.includes(tokenRecuperacao),
  "o token em claro não aparece em lugar nenhum do registro",
);

// ---------------------------------------------------------------- TESTE 2
console.log("\n══ TESTE 2: e-mail inexistente responde igual ══");

const inexistente = `nao.existe.${TAG}@autovolt.com.br`;
const respostaInexistente = await pedirRecuperacao(anon, inexistente);
check(
  respostaInexistente.trim() === respostaExistente.trim(),
  "resposta idêntica à de uma conta existente",
);
check(
  (await db.user.findUnique({ where: { email: inexistente } })) === null,
  "nenhuma conta foi criada",
);
check(
  (await caixaDeEntrada(inexistente)).length === 0,
  "nenhuma mensagem enviada para o endereço inexistente",
);

// ---------------------------------------------------------------- TESTE 3
console.log("\n══ TESTE 3: token expirado ══");

// Simula a passagem do tempo empurrando a expiração para trás.
const { token: tokenExpirado } = await (async () => {
  await pedirRecuperacao(anon, EMAIL);
  const m = await esperarMensagem(EMAIL, "Redefinir sua senha");
  return { token: linkDe(m).split("/").pop() };
})();
await db.authToken.updateMany({
  where: { tokenHash: createHash("sha256").update(tokenExpirado).digest("hex") },
  data: { expiresAt: new Date(Date.now() - 60 * 1000) },
});

await anon.goto(`${BASE}/redefinir-senha/${tokenExpirado}`, { waitUntil: "networkidle" });
let corpo = await anon.locator("body").innerText();
check(corpo.includes("Este link expirou"), "tela avisa que o link expirou");
check(
  (await anon.locator("#reset-form").count()) === 0,
  "formulário de nova senha nem é exibido",
);

// Pedir de novo invalida o link anterior: dois links vivos ao mesmo tempo
// dobrariam a superficie de ataque sem beneficio nenhum.
await anon.goto(linkRecuperacao, { waitUntil: "networkidle" });
check(
  (await anon.locator("#reset-form").count()) === 0,
  "pedir um link novo invalida o anterior",
);

// E o servidor recusa mesmo se alguem montar o formulario por fora.
const forjado = await novaAba("forjado");
await forjado.goto(`${BASE}/esqueci-senha`, { waitUntil: "networkidle" });
const recusaExpirado = await forjado.evaluate(async ([base, token]) => {
  // Reaproveita o formulário de uma página válida seria mais fiel, mas aqui
  // basta provar que a rota da action não aceita o token expirado: a página
  // de redefinição responde sem formulário para ele.
  const resposta = await fetch(`${base}/redefinir-senha/${token}`);
  return (await resposta.text()).includes("Este link expirou");
}, [BASE, tokenExpirado]);
check(recusaExpirado, "o servidor também recusa o token expirado na resposta HTML");
await forjado.context().close();

// ---------------------------------------------------------------- TESTE 5
console.log("\n══ TESTE 5: redefinir e entrar com a nova senha ══");

// (O teste 4 usa este mesmo link depois de gasto, então a redefinição vem antes.)
// Pede um link fresco: os anteriores foram invalidados pelos próprios pedidos.
await pedirRecuperacao(anon, EMAIL);
const linkValido = linkDe(await esperarMensagem(EMAIL, "Redefinir sua senha"));
const hashValido = createHash("sha256")
  .update(linkValido.split("/").pop())
  .digest("hex");

await anon.goto(linkValido, { waitUntil: "networkidle" });
check((await anon.locator("#reset-form").count()) > 0, "link válido abre o formulário");

// Senhas diferentes não passam.
await anon.fill('#reset-form input[name="password"]', SENHA_NOVA);
await anon.fill('#reset-form input[name="confirm"]', "outraCoisa789");
await anon.click('#reset-form button[type="submit"]');
await anon.waitForTimeout(1500);
check(
  (await anon.locator('#reset-form [role="alert"]').innerText()).includes("não são iguais"),
  "confirmação divergente é recusada",
);

// Senha curta também não. O campo já barra pelo navegador (minLength), então
// o teste desliga a validação nativa: o que precisa recusar é o servidor.
check(
  (await anon.getAttribute('#reset-form input[name="password"]', "minlength")) === "8",
  "campo exige 8 caracteres no navegador",
);
await anon.evaluate(() => {
  document.querySelector("#reset-form").noValidate = true;
});
await anon.fill('#reset-form input[name="password"]', "1234");
await anon.fill('#reset-form input[name="confirm"]', "1234");
await anon.click('#reset-form button[type="submit"]');
await anon.waitForTimeout(2000);
check(
  (await anon.locator('#reset-form [role="alert"]').innerText()).includes("8 caracteres"),
  "servidor recusa senha abaixo do mínimo",
);

await anon.fill('#reset-form input[name="password"]', SENHA_NOVA);
await anon.fill('#reset-form input[name="confirm"]', SENHA_NOVA);
await anon.click('#reset-form button[type="submit"]');
await anon.waitForURL("**/login**", { timeout: 15000 });
check(anon.url().includes("senha=redefinida"), "redireciona para o login com a confirmação");
check(
  (await anon.locator("body").innerText()).includes("Senha redefinida"),
  "login mostra o aviso de senha redefinida",
);

const depois = await db.user.findUnique({
  where: { email: EMAIL },
  select: { passwordHash: true, sessionsValidFrom: true },
});
check(depois.passwordHash !== conta.passwordHash, "hash da senha mudou no banco");
check(depois.passwordHash.startsWith("$2"), "continua sendo bcrypt");
check(
  depois.sessionsValidFrom > registro.createdAt,
  "corte de sessão avançado: cookies antigos deixam de valer",
);

// A sessao que estava aberta ANTES da troca perde o acesso.
await p.goto(`${BASE}/clientes`, { waitUntil: "networkidle" });
check(
  p.url().includes("/login"),
  `sessão aberta antes da troca cai no login (${p.url()})`,
);

// A senha antiga não entra mais.
await anon.fill('input[name="email"]', EMAIL);
await anon.fill('input[name="password"]', SENHA_ANTIGA);
await anon.click('button[type="submit"]');
await anon.waitForTimeout(2500);
check(
  (await anon.locator("body").innerText()).includes("incorretos"),
  "senha antiga é recusada",
);

// A nova entra.
await anon.fill('input[name="email"]', EMAIL);
await anon.fill('input[name="password"]', SENHA_NOVA);
await anon.click('button[type="submit"]');
await anon.waitForURL("**/dashboard", { timeout: 15000 });
check(true, "login com a nova senha funciona");

// ---------------------------------------------------------------- TESTE 4
console.log("\n══ TESTE 4: o mesmo link não serve duas vezes ══");

const usado = await db.authToken.findFirst({
  where: { tokenHash: hashValido },
  select: { usedAt: true },
});
check(Boolean(usado.usedAt), "token marcado como utilizado");

const reuso = await novaAba("reuso");
await reuso.goto(linkValido, { waitUntil: "networkidle" });
corpo = await reuso.locator("body").innerText();
check(corpo.includes("já foi utilizado"), "tela recusa o link gasto");
check((await reuso.locator("#reset-form").count()) === 0, "sem formulário para reutilizar");
await reuso.context().close();

// ---------------------------------------------------------------- TESTE 6
console.log("\n══ TESTE 6: verificação de e-mail ══");

const aviso = await anon.locator("[data-email-notice]").count();
check(aviso > 0, "plataforma avisa que o e-mail não foi verificado");
check(
  (await anon.locator("body").innerText()).includes("ainda não foi verificado"),
  "o aviso diz exatamente isso",
);
// E não bloqueia: a página carregou normalmente.
check(
  (await anon.locator("aside nav a").count()) > 0,
  "o aviso não bloqueia o uso da plataforma",
);

const verificacao = await esperarMensagem(EMAIL, "Confirme seu e-mail");
check(Boolean(verificacao), "link de verificação saiu no cadastro");
const linkVerificacao = linkDe(verificacao);

await anon.goto(linkVerificacao, { waitUntil: "networkidle" });
check((await anon.locator("#verify-form").count()) > 0, "link abre a confirmação");
await anon.click('#verify-form button[type="submit"]');
await anon.waitForSelector("[data-email-verified]", { timeout: 10000 });

const verificado = await db.user.findUnique({
  where: { email: EMAIL },
  select: { emailVerifiedAt: true },
});
check(Boolean(verificado.emailVerifiedAt), "e-mail marcado como verificado no banco");

await anon.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
// A afirmacao positiva primeiro: "o aviso sumiu" tambem passaria se a sessao
// tivesse caido e a pagina fosse o login.
check(anon.url().endsWith("/dashboard"), `continua na plataforma (${anon.url()})`);
check(
  (await anon.locator("[data-email-notice]").count()) === 0,
  "o aviso some depois da verificação",
);

// ---------------------------------------------------------------- TESTE 7
console.log("\n══ TESTE 7: token de verificação não se repete ══");

const reverificar = await novaAba("reverificar");
await reverificar.goto(linkVerificacao, { waitUntil: "networkidle" });
corpo = await reverificar.locator("body").innerText();
check(corpo.includes("já foi utilizado"), "segunda visita ao link é recusada");
check(
  (await reverificar.locator("#verify-form").count()) === 0,
  "sem botão para confirmar de novo",
);
await reverificar.context().close();

// ---------------------------------------------------------------- TESTE 8
console.log("\n══ TESTE 8: limite de reenvios ══");

// Volta o e-mail para não verificado, para o aviso e o reenvio aparecerem.
await db.user.update({ where: { email: EMAIL }, data: { emailVerifiedAt: null } });
await db.authToken.deleteMany({ where: { userId: conta.id, purpose: "verificacao" } });

await anon.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
check(
  (await anon.locator('button:has-text("Reenviar verificação")').count()) > 0,
  `aviso volta com o botão de reenvio (${anon.url()})`,
);

let bloqueio = null;
for (let tentativa = 1; tentativa <= 5; tentativa++) {
  await anon.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  const botao = anon.locator('button:has-text("Reenviar verificação")');
  if ((await botao.count()) === 0) break;
  await botao.click();
  await anon.waitForTimeout(2000);
  const texto = await anon.locator("[data-email-notice]").innerText();
  if (texto.includes("Tente de novo")) {
    bloqueio = { tentativa, texto };
    break;
  }
}

check(Boolean(bloqueio), `reenvios seguidos são barrados (na ${bloqueio?.tentativa}ª tentativa)`);
check(
  bloqueio?.texto.includes("minutos"),
  `mensagem explica a espera ("${bloqueio?.texto.split("\n").pop()?.trim().slice(0, 70)}...")`,
);

const emitidos = await db.authToken.count({
  where: { userId: conta.id, purpose: "verificacao" },
});
check(emitidos <= 3, `no máximo 3 tokens emitidos na janela (foram ${emitidos})`);

// Limpeza: a conta e a empresa criadas por este teste saem do banco.
const empresa = await db.membership.findFirst({
  where: { userId: conta.id },
  select: { companyId: true },
});
await db.user.delete({ where: { id: conta.id } });
if (empresa) await db.company.delete({ where: { id: empresa.companyId } }).catch(() => {});

// ---------------------------------------------------------------------------
console.log("\n──────────────────────────────────────────");
if (noise.length > 0) {
  console.log(`Erros de console: ${noise.length}`);
  noise.slice(0, 5).forEach((n) => console.log(`   ${n}`));
}
if (fails.length === 0) {
  console.log("TODOS OS TESTES PASSARAM");
} else {
  console.log(`${fails.length} FALHA(S):`);
  fails.forEach((f) => console.log(`   - ${f}`));
}

await b.close();
await db.$disconnect();
process.exit(fails.length === 0 ? 0 : 1);
