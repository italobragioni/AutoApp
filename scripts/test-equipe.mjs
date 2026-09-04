/**
 * Teste de Equipe e Permissoes.
 *
 * TESTE 1  convite -> link copiado -> aceite -> Membership criado
 * TESTE 2  funcionario nao alcanca as configuracoes criticas
 * TESTE 3  funcionario chamando a acao direto: o servidor recusa
 * TESTE 4  administrador muda o papel -> o acesso muda junto
 * TESTE 7  rebaixar/remover o ultimo administrador e bloqueado
 * TESTE 5  administrador remove o usuario -> acesso cortado na hora
 * TESTE 6  duas empresas -> troca -> dados completamente separados
 *
 * O TESTE 7 roda antes do 5 de proposito: ele precisa de outro membro na tela
 * de Equipe, e o 5 remove justamente esse membro.
 *
 * Requer o servidor rodando (npm run build && npm run start) e DATABASE_URL
 * apontando para o mesmo banco:
 *   CHROMIUM_PATH=/caminho/chrome node scripts/test-equipe.mjs
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const CHROME = process.env.CHROMIUM_PATH;
const fails = [];
const noise = [];
/** O teste provoca um 404 de propósito; o registro de erros ignora esse trecho. */
let expecting404 = false;

const db = new PrismaClient();

function check(ok, label) {
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}`);
  if (!ok) fails.push(label);
}

/** Identidade propria por execucao: o teste cria uma conta de verdade. */
const TAG = `t${Math.floor(Date.now() / 1000) % 100000}`;
const CONVIDADO = `equipe.${TAG}@autovolt.com.br`;
const SENHA = "equipe12345";

const b = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

/** Cada papel tem seu proprio navegador: as sessoes nao se misturam. */
async function novaAba(nome) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: "pt-BR" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => noise.push(`pageerror (${nome}) em ${page.url()}: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !expecting404) {
      noise.push(`console (${nome}) em ${page.url()}: ${m.text()}`);
    }
  });
  return page;
}

async function hrefsDoMenu(page) {
  return page.locator("aside nav a").evaluateAll((els) =>
    els.map((el) => el.getAttribute("href")),
  );
}

const dono = await novaAba("dono");
await dono.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await dono.fill('input[name="email"]', "demo@autovolt.com.br");
await dono.fill('input[name="password"]', "autovolt123");
await dono.click('button[type="submit"]');
await dono.waitForURL("**/dashboard");

const empresaA = await db.company.findFirst({
  where: { memberships: { some: { user: { email: "demo@autovolt.com.br" } } } },
  orderBy: { createdAt: "asc" },
  select: { id: true, name: true },
});
console.log(`   empresa da sessão: ${empresaA.name}`);

// ---------------------------------------------------------------- TESTE 1
console.log("\n══ TESTE 1: convite, link e aceite ══");

await dono.goto(`${BASE}/configuracoes`, { waitUntil: "networkidle" });
await dono.click('button:has-text("Convidar")');
await dono.waitForSelector("#invite-form", { timeout: 8000 });
await dono.fill('#invite-form input[name="email"]', CONVIDADO);
await dono.selectOption('#invite-form select[name="role"]', "staff");
await dono.click('#invite-form button[type="submit"]');
await dono.waitForSelector("[data-invite-created]", { timeout: 10000 });

const link = await dono.inputValue("[data-invite-created] [data-invite-link]");
check(link.includes("/convite/"), `link de convite gerado (${link.slice(0, 46)}...)`);

const convite = await db.invitation.findFirst({
  where: { email: CONVIDADO },
  select: { token: true, status: true, role: true, companyId: true, expiresAt: true },
});
check(Boolean(convite), "convite gravado no banco");
check(convite.companyId === empresaA.id, "vinculado à empresa correta");
check(convite.role === "staff", "papel do convite: funcionário");
check(convite.status === "pendente", "nasce pendente");
check(convite.token.length >= 40, `token longo e aleatório (${convite.token.length} caracteres)`);
check(link.endsWith(convite.token), "o link carrega exatamente esse token");
check(convite.expiresAt > new Date(), `tem validade (até ${convite.expiresAt.toLocaleDateString("pt-BR")})`);

// Ninguem logado abre o link e cria a conta.
const convidado = await novaAba("convidado");
await convidado.goto(link, { waitUntil: "networkidle" });
check(
  (await convidado.locator("#accept-form").count()) > 0,
  "página do convite abre para quem não está logado",
);
await convidado.click('button:has-text("Criar conta")');
await convidado.fill('#accept-form input[name="name"]', `Convidado ${TAG}`);
await convidado.fill('#accept-form input[name="password"]', SENHA);
await convidado.click('#accept-form button[type="submit"]');
await convidado.waitForURL("**/dashboard", { timeout: 15000 });
check(true, "aceite leva direto para a empresa");

const membroCriado = await db.membership.findFirst({
  where: { user: { email: CONVIDADO }, companyId: empresaA.id },
  include: { user: { select: { id: true, name: true } } },
});
check(Boolean(membroCriado), "Membership criado na empresa do convite");
check(membroCriado?.role === "staff", "com o papel do convite");

const conviteUsado = await db.invitation.findFirst({
  where: { email: CONVIDADO },
  select: { status: true, acceptedById: true, acceptedAt: true },
});
check(conviteUsado.status === "aceito", "convite marcado como aceito");
check(conviteUsado.acceptedById === membroCriado.userId, "registra quem aceitou");

// O mesmo link nao serve de novo.
const reuso = await novaAba("reuso");
await reuso.goto(link, { waitUntil: "networkidle" });
const textoReuso = await reuso.locator("body").innerText();
check(
  textoReuso.includes("Já utilizado") || textoReuso.includes("já foi aceito"),
  "link recusado na segunda tentativa",
);
await reuso.context().close();

// ---------------------------------------------------------------- TESTE 2
console.log("\n══ TESTE 2: funcionário e as configurações críticas ══");

const menuFuncionario = await hrefsDoMenu(convidado);
check(!menuFuncionario.includes("/relatorios"), "menu esconde Relatórios");
check(!menuFuncionario.includes("/orcamentos"), "menu esconde Orçamentos");
check(!menuFuncionario.includes("/campanhas"), "menu esconde Campanhas");
check(menuFuncionario.includes("/clientes"), "menu mantém Clientes");
check(menuFuncionario.includes("/ordens"), "menu mantém Ordens de Serviço");

await convidado.goto(`${BASE}/configuracoes`, { waitUntil: "networkidle" });
check(
  (await convidado.locator('input[name="retentionWindowDays"]').count()) === 0,
  "não vê o formulário de regras de retenção",
);
check(
  (await convidado.locator('input[name="document"]').count()) === 0,
  "não vê o formulário de dados da empresa",
);
check(
  (await convidado.locator('button:has-text("Convidar")').count()) === 0,
  "não vê o botão de convidar",
);
check(
  (await convidado.locator('button:has-text("Criar nova empresa")').count()) === 0,
  "não vê a criação de empresa",
);

// A pagina protegida no servidor devolve o usuario para o Dashboard.
await convidado.goto(`${BASE}/relatorios`, { waitUntil: "networkidle" });
check(convidado.url().endsWith("/dashboard"), `/relatorios redireciona (${convidado.url()})`);
await convidado.goto(`${BASE}/orcamentos`, { waitUntil: "networkidle" });
check(convidado.url().endsWith("/dashboard"), "/orcamentos redireciona");

await convidado.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
const painel = await convidado.locator("body").innerText();
// A afirmacao positiva vem junto de proposito: sem ela, "nao ve o faturamento"
// tambem passaria se a pagina simplesmente nao tivesse renderizado.
check(painel.includes("Agendamentos hoje"), "Dashboard carregou para o funcionário");
check(!painel.includes("Faturamento do mês"), "Dashboard esconde o faturamento");
check(!painel.includes("Ticket médio"), "Dashboard esconde o ticket médio");

// ---------------------------------------------------------------- TESTE 3
console.log("\n══ TESTE 3: ação protegida chamada direto ══");

/*
 * O formulário de serviço não é renderizado para funcionário. Para chegar até a
 * ação sem passar pela interface, o teste promove o usuário no banco, carrega a
 * tela com o formulário e devolve o papel para funcionário SEM recarregar. O
 * navegador continua com um formulário que ele não deveria mais poder enviar —
 * exatamente o caso que a trava do servidor existe para cobrir.
 */
await db.membership.update({ where: { id: membroCriado.id }, data: { role: "manager" } });
await convidado.goto(`${BASE}/servicos?novo=1`, { waitUntil: "networkidle" });
check(
  (await convidado.locator("#service-form").count()) > 0,
  "com papel de gerente, o formulário de serviço aparece",
);
await db.membership.update({ where: { id: membroCriado.id }, data: { role: "staff" } });

const nomeServico = `Serviço proibido ${TAG}`;
await convidado.fill('#service-form input[name="name"]', nomeServico);
await convidado.fill('#service-form input[name="price"]', "100,00");
await convidado.click('#service-form button[type="submit"]');
await convidado.waitForTimeout(2500);

const alerta = await convidado.locator('#service-form [role="alert"]').first().innerText();
check(
  alerta.includes("não tem permissão"),
  `servidor recusa a ação ("${alerta.trim()}")`,
);
const servicoCriado = await db.serviceItem.findFirst({ where: { name: nomeServico } });
check(!servicoCriado, "nada foi gravado no banco");

// ---------------------------------------------------------------- TESTE 4
console.log("\n══ TESTE 4: administrador altera o papel ══");

await dono.goto(`${BASE}/configuracoes`, { waitUntil: "networkidle" });
const seletorPapel = dono.locator(`select[aria-label="Papel de ${membroCriado.user.name}"]`);
check((await seletorPapel.count()) > 0, "administrador vê o seletor de papel do membro");
await seletorPapel.selectOption("manager");
await dono.waitForTimeout(3000);

const depoisDaTroca = await db.membership.findUnique({
  where: { id: membroCriado.id },
  select: { role: true },
});
check(depoisDaTroca.role === "manager", "papel alterado no banco para gerente");

// O acesso muda junto, sem tocar em mais nada.
await convidado.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
const menuGerente = await hrefsDoMenu(convidado);
check(menuGerente.includes("/relatorios"), "gerente passa a ver Relatórios no menu");
check(menuGerente.includes("/orcamentos"), "gerente passa a ver Orçamentos");
await convidado.goto(`${BASE}/relatorios`, { waitUntil: "networkidle" });
check(convidado.url().endsWith("/relatorios"), "gerente abre Relatórios");

// Mas continua sem a gestão da empresa.
await convidado.goto(`${BASE}/configuracoes`, { waitUntil: "networkidle" });
check(
  (await convidado.locator('input[name="retentionWindowDays"]').count()) === 0,
  "gerente continua sem as regras de retenção",
);
check(
  (await convidado.locator('button:has-text("Convidar")').count()) === 0,
  "gerente continua sem convidar",
);

// ---------------------------------------------------------------- TESTE 7
console.log("\n══ TESTE 7: o último administrador é protegido ══");

const membershipDono = await db.membership.findFirst({
  where: { companyId: empresaA.id, role: "owner" },
  select: { id: true },
});
const donosAntes = await db.membership.count({
  where: { companyId: empresaA.id, role: "owner" },
});
check(donosAntes === 1, `a empresa tem ${donosAntes} administrador`);

await dono.goto(`${BASE}/configuracoes`, { waitUntil: "networkidle" });

// Rebaixar: troca o id no formulário do OUTRO membro pelo do próprio dono.
// A injeção vem por último — qualquer interação depois faria o React repintar.
await dono.evaluate((id) => {
  document.querySelector('form input[name="membershipId"]').value = id;
}, membershipDono.id);
await dono.locator('select[aria-label^="Papel de"]').first().selectOption("staff");
await dono.waitForTimeout(3000);

const donoDepois = await db.membership.findUnique({
  where: { id: membershipDono.id },
  select: { role: true },
});
check(donoDepois.role === "owner", "rebaixar o último administrador não passou");
check(
  (await db.membership.count({ where: { companyId: empresaA.id, role: "owner" } })) === 1,
  "empresa continua com administrador",
);

// Remover: mesmo caminho, agora pelo formulário de remoção.
await dono.goto(`${BASE}/configuracoes`, { waitUntil: "networkidle" });
await dono.locator('button[aria-label^="Remover"]').first().click();
await dono.waitForSelector("#remove-member-form");
await dono.evaluate((id) => {
  document.querySelector('#remove-member-form input[name="membershipId"]').value = id;
}, membershipDono.id);
await dono.click('#remove-member-form button[type="submit"]');
await dono.waitForTimeout(2500);

const erroRemocao = await dono.locator('#remove-member-form [role="alert"]').first().innerText();
check(
  erroRemocao.includes("sem administrador"),
  `servidor recusa remover o último administrador ("${erroRemocao.trim()}")`,
);
check(
  Boolean(await db.membership.findUnique({ where: { id: membershipDono.id } })),
  "o administrador continua na empresa",
);
await dono.goto(`${BASE}/configuracoes`, { waitUntil: "networkidle" });

// ---------------------------------------------------------------- TESTE 5
console.log("\n══ TESTE 5: remoção corta o acesso ══");

await dono.locator(`button[aria-label="Remover ${membroCriado.user.name}"]`).click();
await dono.waitForSelector("#remove-member-form");
await dono.click('#remove-member-form button[type="submit"]');
await dono.waitForTimeout(3000);

const vinculo = await db.membership.findUnique({ where: { id: membroCriado.id } });
check(!vinculo, "Membership removido");
const contaAinda = await db.user.findUnique({ where: { id: membroCriado.userId } });
check(Boolean(contaAinda), "a conta do usuário continua existindo");

// A sessão que já estava aberta perde o acesso na próxima navegação.
await convidado.goto(`${BASE}/clientes`, { waitUntil: "networkidle" });
check(
  convidado.url().includes("/login"),
  `sessão do removido cai no login (${convidado.url()})`,
);

// ---------------------------------------------------------------- TESTE 6
console.log("\n══ TESTE 6: duas empresas, dados separados ══");

async function clientesVisiveis(page) {
  await page.goto(`${BASE}/clientes`, { waitUntil: "networkidle" });
  return page
    .locator('tbody tr a[href^="/clientes/"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute("href").split("/").pop()));
}

const clientesA = await clientesVisiveis(dono);

await dono.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await dono.locator("header button").first().click();
await dono.waitForSelector('[role="menu"]');
const opcao = dono.locator('[role="menu"] form button').nth(1);
const nomeB = (await opcao.innerText()).split("\n")[0].trim();
await opcao.click();
await dono.waitForFunction(
  (n) => document.querySelector("header button")?.textContent?.includes(n) ?? false,
  nomeB,
  { timeout: 20000 },
);
console.log(`   empresa ativa agora: ${nomeB}`);

const clientesB = await clientesVisiveis(dono);
check(clientesA.length > 0 && clientesB.length > 0, `A tem ${clientesA.length}, B tem ${clientesB.length} clientes`);
check(
  !clientesA.some((id) => clientesB.includes(id)),
  "nenhum cliente aparece nas duas empresas",
);

// E o servidor recusa abrir um cliente da empresa A estando na B.
expecting404 = true;
const respostaCruzada = await dono.goto(`${BASE}/clientes/${clientesA[0]}`, {
  waitUntil: "networkidle",
});
expecting404 = false;
check(respostaCruzada.status() === 404, `cliente da empresa A responde 404 na B (${respostaCruzada.status()})`);

// Limpeza: o teste nao deixa conta nem convite para tras.
await db.invitation.deleteMany({ where: { email: CONVIDADO } });
await db.user.deleteMany({ where: { email: CONVIDADO } });

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
