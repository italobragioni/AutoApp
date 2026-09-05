/**
 * Teste do modulo Servicos.
 *
 * Percorre o caminho pedido:
 *   criar -> editar preco -> editar recorrencia -> desativar -> verificar historico
 *
 * A parte mais importante e a integracao com o motor de retencao: editar o
 * ciclo de retorno de um servico precisa mudar, na tela de Retencao, a data em
 * que o cliente "deveria voltar". Isso prova que nao existe logica paralela —
 * o motor le o campo ao vivo.
 *
 * Requer o servidor rodando (npm run build && npm run start).
 *   CHROMIUM_PATH=/caminho/chrome node scripts/test-servicos.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const CHROME = process.env.CHROMIUM_PATH;
const fails = [];
const noise = [];

function check(ok, label) {
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}`);
  if (!ok) fails.push(label);
}

const b = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: "pt-BR" });
const p = await ctx.newPage();
p.on("pageerror", (e) => noise.push(`pageerror: ${e.message}`));
p.on("console", (m) => {
  if (m.type() === "error" && !/facebook\.(net|com)|fbevents/i.test(m.location()?.url ?? "")) noise.push(`console: ${m.text()}`);
});

/**
 * O Intl.NumberFormat pt-BR separa "R$" do valor com espaco NAO-QUEBRAVEL
 * (U+00A0). Comparar com espaco comum daria falso negativo.
 */
function norm(text) {
  return text.replace(/\u00a0/g, " ");
}

/** Localiza o cartao de um servico pelo nome. */
function card(page, name) {
  return page.locator("article").filter({ hasText: name }).first();
}

await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.fill('input[name="email"]', "demo@autovolt.com.br");
await p.fill('input[name="password"]', "autovolt123");
await p.click('button[type="submit"]');
await p.waitForURL("**/dashboard");

// Nome unico por execucao: o modulo nao tem exclusao, entao cada rodada
// deixa um servico para tras. Sem isso, o `card()` pegaria o da rodada anterior.
const NOME = `Blindagem Cerâmica ${Date.now().toString().slice(-6)}`;

console.log("\n▸ CRIAR");
await p.goto(`${BASE}/servicos`, { waitUntil: "networkidle" });
const antes = await p.locator("article").count();

await p.click('a[href="/servicos?novo=1"]');
await p.waitForSelector('[role="dialog"]');
check(true, "botão Novo serviço abre o formulário");

// validação: duração inválida
await p.fill('input[name="name"]', NOME);
await p.fill('input[name="price"]', "1.250,00");
await p.fill('input[name="durationMin"]', "2");
await p.click('#service-form button[type="submit"]');
await p.waitForTimeout(700);
check(
  (await p.locator('#service-form [role="alert"]').count()) > 0,
  "validação rejeita duração menor que o mínimo",
);

await p.fill('input[name="durationMin"]', "480");
await p.selectOption('select[name="category"]', "protecao");
await p.fill('textarea[name="description"]', "Proteção cerâmica de longa duração.");
await p.fill('input[name="recurrenceDays"]', "365");
await p.click('#service-form button[type="submit"]');
await p.waitForTimeout(2500);

await p.goto(`${BASE}/servicos`, { waitUntil: "networkidle" });
const depois = await p.locator("article").count();
check(depois === antes + 1, `serviço aparece na listagem (${antes} → ${depois})`);

const criado = norm(await card(p, NOME).innerText());
check(criado.includes("R$ 1.250,00"), "preço salvo em centavos e exibido em reais");
check(criado.includes("8h"), "duração salva (480min exibido como 8h)");
check(criado.includes("a cada 365 dias"), "ciclo de retorno salvo");
check(criado.includes("Proteção cerâmica"), "descrição salva");

console.log("\n▸ EDITAR PREÇO");
const editHref = await card(p, NOME).locator('a[href^="/servicos?editar="]').getAttribute("href");
const servicoId = editHref.split("=").pop();
await p.goto(`${BASE}${editHref}`, { waitUntil: "networkidle" });
await p.waitForSelector('[role="dialog"]');
check(
  (await p.inputValue('input[name="price"]')) === "1250,00",
  "formulário abre com o preço convertido de centavos",
);

await p.fill('input[name="price"]', "1.480,50");
await p.click('#service-form button[type="submit"]');
await p.waitForTimeout(2500);
await p.goto(`${BASE}/servicos`, { waitUntil: "networkidle" });
check(
  norm(await card(p, NOME).innerText()).includes("R$ 1.480,50"),
  "preço atualizado (centavos preservados)",
);

console.log("\n▸ EDITAR RECORRÊNCIA E VERIFICAR O MOTOR DE RETENÇÃO");
// Cliente com histórico real: lemos a data de retorno ideal antes e depois.
await p.goto(`${BASE}/retencao?aba=em_dia`, { waitUntil: "networkidle" });
const primeiraLinha = p.locator("tbody tr").first();
const nomeCliente = (await primeiraLinha.locator("td").first().innerText()).split("\n")[0].trim();
await p.goto(`${BASE}/clientes`, { waitUntil: "networkidle" });
const clienteHref = await p
  .locator("tbody a", { hasText: nomeCliente })
  .first()
  .getAttribute("href");
await p.goto(`${BASE}${clienteHref}`, { waitUntil: "networkidle" });

/** Le "Retorno ideal em DD/MM/AAAA" da ficha do cliente. */
async function retornoIdeal(page) {
  const text = await page.locator("body").innerText();
  const m = text.match(/Retorno ideal em (\d{2}\/\d{2}\/\d{4})/);
  return m ? m[1] : null;
}

const retornoAntes = await retornoIdeal(p);
check(retornoAntes !== null, `retorno ideal antes: ${retornoAntes}`);

// Descobre qual serviço definiu o ciclo do último atendimento desse cliente.
const historico = await p.locator("body").innerText();

// Edita a recorrência de TODOS os serviços do último atendimento para 15 dias,
// forçando o motor a recalcular com o novo ciclo.
await p.goto(`${BASE}/servicos`, { waitUntil: "networkidle" });
const cards = await p.locator("article").all();
const alterados = [];
/** Guarda o valor anterior para restaurar no fim e o teste poder rodar de novo. */
const originais = [];
for (const c of cards) {
  const nome = (await c.locator("h4").innerText()).trim();
  if (!historico.includes(nome)) continue;
  const href = await c.locator('a[href^="/servicos?editar="]').getAttribute("href");
  if (!href) continue;
  await p.goto(`${BASE}${href}`, { waitUntil: "networkidle" });
  await p.waitForSelector('[role="dialog"]');
  const anterior = await p.inputValue('input[name="recurrenceDays"]');
  // Valor deliberadamente diferente do atual, para a mudança ser detectável.
  const novo = anterior === "7" ? "21" : "7";
  await p.fill('input[name="recurrenceDays"]', novo);
  await p.click('#service-form button[type="submit"]');
  await p.waitForTimeout(1800);
  alterados.push(nome);
  originais.push({ href, anterior });
  await p.goto(`${BASE}/servicos`, { waitUntil: "networkidle" });
}
check(alterados.length > 0, `recorrência alterada em: ${alterados.join(", ") || "nenhum"}`);

await p.goto(`${BASE}${clienteHref}`, { waitUntil: "networkidle" });
const retornoDepois = await retornoIdeal(p);
check(
  retornoDepois !== null && retornoDepois !== retornoAntes,
  `motor de retenção usou o novo ciclo (${retornoAntes} → ${retornoDepois})`,
);

console.log("\n▸ DESATIVAR");
await p.goto(`${BASE}/servicos`, { waitUntil: "networkidle" });
const alvo = card(p, NOME);
check(!(await alvo.innerText()).includes("Inativo"), "serviço começa ativo");
await alvo.locator('button:has-text("Desativar")').click();
await p.waitForTimeout(2500);
await p.goto(`${BASE}/servicos`, { waitUntil: "networkidle" });
check((await card(p, NOME).innerText()).includes("Inativo"), "serviço marcado como inativo");
check(
  (await p.locator("article").count()) === depois,
  "serviço inativo continua visível no catálogo (não sumiu)",
);

console.log("\n▸ HISTÓRICO PRESERVADO APÓS DESATIVAR");
// Desativa um serviço que TEM histórico e confere que as ordens antigas seguem iguais.
await p.goto(`${BASE}/ordens`, { waitUntil: "networkidle" });
const ordensAntes = await p.locator("tbody tr").count();
const textoOrdensAntes = await p.locator("tbody").first().innerText();

const comHistorico = alterados[0];
if (comHistorico) {
  await p.goto(`${BASE}/servicos`, { waitUntil: "networkidle" });
  const c = card(p, comHistorico);
  const jaInativo = (await c.innerText()).includes("Inativo");
  if (!jaInativo) {
    await c.locator('button:has-text("Desativar")').click();
    await p.waitForTimeout(2500);
  }

  await p.goto(`${BASE}/ordens`, { waitUntil: "networkidle" });
  check(
    (await p.locator("tbody tr").count()) === ordensAntes,
    `ordens de serviço intactas (${ordensAntes})`,
  );
  check(
    (await p.locator("tbody").first().innerText()) === textoOrdensAntes,
    `histórico de "${comHistorico}" inalterado após desativar`,
  );

  await p.goto(`${BASE}/servicos`, { waitUntil: "networkidle" });
  check(
    (await card(p, comHistorico).innerText()).includes("vendas em 6 meses"),
    "serviço inativo mantém o desempenho histórico registrado",
  );
}

console.log("\n▸ REATIVAR");
await p.goto(`${BASE}/servicos`, { waitUntil: "networkidle" });
await card(p, NOME).locator('button:has-text("Ativar")').click();
await p.waitForTimeout(2500);
await p.goto(`${BASE}/servicos`, { waitUntil: "networkidle" });
check(!(await card(p, NOME).innerText()).includes("Inativo"), "serviço reativado");

console.log("\n▸ ISOLAMENTO ENTRE EMPRESAS");
await p.locator("header button").first().click();
await p.waitForSelector('[role="menu"]');
const opcao = p.locator('[role="menu"] form button').nth(1);
const nomeB = (await opcao.innerText()).split("\n")[0].trim();
await opcao.click();
await p.waitForFunction(
  (n) => document.querySelector("header button")?.textContent?.includes(n) ?? false,
  nomeB,
  { timeout: 20000 },
);
await p.goto(`${BASE}/servicos?editar=${servicoId}`, { waitUntil: "networkidle" });
check(
  (await p.locator('[role="dialog"]').count()) === 0,
  "editar serviço de outra empresa não abre o formulário",
);
check(
  !(await p.locator("body").innerText()).includes(NOME),
  "serviço da empresa A não aparece no catálogo da B",
);

console.log("\n▸ RESTAURANDO O CATÁLOGO");
// Volta para a empresa dona: o teste de isolamento deixou a sessão na empresa B.
await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await p.locator("header button").first().click();
await p.waitForSelector('[role="menu"]');
const voltar = p.locator('[role="menu"] form button').nth(0);
const nomeA = (await voltar.innerText()).split("\n")[0].trim();
await voltar.click();
await p.waitForFunction(
  (n) => document.querySelector("header button")?.textContent?.includes(n) ?? false,
  nomeA,
  { timeout: 20000 },
);

for (const { href, anterior } of originais) {
  await p.goto(`${BASE}${href}`, { waitUntil: "networkidle" });
  await p.waitForSelector('[role="dialog"]');
  await p.fill('input[name="recurrenceDays"]', anterior);
  await p.click('#service-form button[type="submit"]');
  await p.waitForTimeout(1500);
}
// Confere a restauracao pelo proprio campo do servico. A data de retorno
// derivada depende do ultimo atendimento do cliente, que outros testes podem
// ter alterado nesta mesma base — o valor do campo e o dado direto.
let restauradas = 0;
for (const { href, anterior } of originais) {
  await p.goto(`${BASE}${href}`, { waitUntil: "networkidle" });
  await p.waitForSelector('[role="dialog"]');
  if ((await p.inputValue('input[name="recurrenceDays"]')) === anterior) restauradas += 1;
}
check(
  restauradas === originais.length,
  `recorrência restaurada em ${restauradas}/${originais.length} serviços`,
);

console.log("\n▸ CONSOLE");
check(noise.length === 0, `sem erros de console (${noise.length})`);
noise.slice(0, 5).forEach((n) => console.log("       " + n));

await b.close();
console.log(
  fails.length === 0
    ? "\n✔ Módulo Serviços aprovado.\n"
    : `\n✘ ${fails.length} falha(s):\n  - ${fails.join("\n  - ")}\n`,
);
process.exit(fails.length ? 1 : 0);
