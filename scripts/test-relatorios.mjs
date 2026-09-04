/**
 * Teste de Relatorios Profissionais.
 *
 * TESTE 1  "Este mês" -> numeros so do mes atual (conferidos contra o banco)
 * TESTE 2  "Mês anterior" -> dados realmente diferentes
 * TESTE 3  periodo personalizado -> todas as metricas recalculadas
 * TESTE 4  comparacao com o periodo anterior de mesma duracao
 * TESTE 5  periodo sem dados -> estado vazio, sem numero enganoso
 * TESTE 6  exportar CSV -> valores batem com o periodo selecionado
 * TESTE 7  CSV abre no Excel -> BOM, separador e acentos corretos
 * TESTE 8  usuario sem permissao financeira -> pagina e export bloqueados
 * TESTE 9  isolamento multiempresa -> cada empresa exporta so o seu
 *
 * Os numeros esperados sao calculados direto no banco, com a MESMA definicao de
 * faturamento da aplicacao (OS concluida, finishedAt no periodo), e comparados
 * com o que a tela e o CSV mostram. Se a pagina ignorasse o periodo, os dois
 * lados divergiriam.
 *
 * Requer o servidor rodando (npm run build && npm run start).
 *   CHROMIUM_PATH=/caminho/chrome node scripts/test-relatorios.mjs
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const CHROME = process.env.CHROMIUM_PATH;
const fails = [];
const noise = [];
let expectingBlock = false;

const db = new PrismaClient();

function check(ok, label) {
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}`);
  if (!ok) fails.push(label);
}

/** "R$ 3.292,00" -> 329200 (centavos). */
function brlToCents(text) {
  const m = text.match(/R\$\s*([\d.]+,\d{2})/);
  if (!m) return null;
  return Math.round(Number(m[1].replace(/\./g, "").replace(",", ".")) * 100);
}

function startOfDay(d) {
  const v = new Date(d);
  v.setHours(0, 0, 0, 0);
  return v;
}
function endOfDay(d) {
  const v = new Date(d);
  v.setHours(23, 59, 59, 999);
  return v;
}

/** Faturamento esperado, com a mesma regra da aplicacao. */
async function dbRevenue(companyId, from, to) {
  const agg = await db.workOrder.aggregate({
    where: { companyId, status: "concluida", finishedAt: { gte: from, lte: to } },
    _sum: { totalCents: true },
    _count: { _all: true },
  });
  return { revenue: agg._sum.totalCents ?? 0, orders: agg._count._all };
}

const b = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const ctx = await b.newContext({ viewport: { width: 1440, height: 1400 }, locale: "pt-BR" });
const p = await ctx.newPage();
p.on("pageerror", (e) => noise.push(`pageerror em ${p.url()}: ${e.message}`));
p.on("console", (m) => {
  if (m.type() === "error" && !expectingBlock) noise.push(`console em ${p.url()}: ${m.text()}`);
});

await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.fill('input[name="email"]', "demo@autovolt.com.br");
await p.fill('input[name="password"]', "autovolt123");
await p.click('button[type="submit"]');
await p.waitForURL("**/dashboard");

/**
 * Baixa uma URL com o cookie de sessao do contexto.
 *
 * O APIRequestContext do Playwright nao envia o cookie httpOnly automaticamente
 * neste cenario; sem o Cookie explicito o middleware manda para /login e a
 * resposta vira o HTML do login. Anexar o cookie replica o que o navegador faz
 * ao seguir o link de download.
 */
async function baixar(page, url) {
  const cookies = await page.context().cookies();
  const sessao = cookies.find((c) => c.name === "autovolt_session");
  return page.request.get(url, {
    headers: sessao ? { Cookie: `autovolt_session=${sessao.value}` } : {},
    maxRedirects: 0,
  });
}

const empresaA = await db.company.findFirst({
  where: { memberships: { some: { user: { email: "demo@autovolt.com.br" } } } },
  orderBy: { createdAt: "asc" },
  select: { id: true, name: true },
});
console.log(`   empresa da sessão: ${empresaA.name}`);

/** Abre um período e devolve o faturamento mostrado no card. */
async function faturamentoNaTela(periodo, extra = "") {
  await p.goto(`${BASE}/relatorios?periodo=${periodo}${extra}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  const texto = await p.locator("body").innerText();
  const m = texto.match(/Faturamento\s*\n?\s*(R\$[^\n]*)/);
  return { cents: m ? brlToCents(m[1]) : null, vazio: texto.includes("Nenhum dado neste período") };
}

const now = new Date();

// ---------------------------------------------------------------- TESTE 1
console.log("\n══ TESTE 1: Este mês ══");

const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1);
const esperadoMes = await dbRevenue(empresaA.id, mesInicio, endOfDay(now));
const telaMes = await faturamentoNaTela("este-mes");
console.log(`   banco: ${esperadoMes.revenue} | tela: ${telaMes.cents}`);
check(telaMes.cents === esperadoMes.revenue, "faturamento da tela = faturamento do mês no banco");

// ---------------------------------------------------------------- TESTE 2
console.log("\n══ TESTE 2: Mês anterior ══");

const antInicio = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const antFim = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
const esperadoAnt = await dbRevenue(empresaA.id, antInicio, antFim);
const telaAnt = await faturamentoNaTela("mes-anterior");
console.log(`   banco: ${esperadoAnt.revenue} | tela: ${telaAnt.cents}`);
check(telaAnt.cents === esperadoAnt.revenue, "faturamento da tela = faturamento do mês anterior no banco");
check(
  telaAnt.cents !== telaMes.cents,
  `mudar de período muda os dados (mês ${telaMes.cents} ≠ anterior ${telaAnt.cents})`,
);

// ---------------------------------------------------------------- TESTE 3
console.log("\n══ TESTE 3: período personalizado ══");

// Um intervalo que não coincide com nenhum preset: dia 10 do mês passado ao 20.
const cde = new Date(now.getFullYear(), now.getMonth() - 1, 10);
const cate = new Date(now.getFullYear(), now.getMonth() - 1, 20);
const iso = (d) => d.toISOString().slice(0, 10);
const esperadoCustom = await dbRevenue(empresaA.id, startOfDay(cde), endOfDay(cate));
const telaCustom = await faturamentoNaTela("personalizado", `&de=${iso(cde)}&ate=${iso(cate)}`);
console.log(`   banco: ${esperadoCustom.revenue} | tela: ${telaCustom.cents}`);
check(
  telaCustom.cents === esperadoCustom.revenue,
  "faturamento do período personalizado = banco no mesmo intervalo",
);
// Ticket médio e OS também precisam refletir o intervalo.
const corpoCustom = await p.locator("body").innerText();
const osNaTela = Number(corpoCustom.match(/OS concluídas\s*\n?\s*(\d+)/)?.[1] ?? -1);
check(osNaTela === esperadoCustom.orders, `OS concluídas recalculadas (${osNaTela})`);

// ---------------------------------------------------------------- TESTE 4
console.log("\n══ TESTE 4: comparação com período anterior ══");

// "Mês anterior" tem duração de um mês; o comparativo é o mês antes dele.
await p.goto(`${BASE}/relatorios?periodo=mes-anterior`, { waitUntil: "networkidle" });
const corpoComp = await p.locator("body").innerText();
// A duração do "mês anterior" em dias, e o período de comparação mostrado.
const compLinha = corpoComp.split("\n").find((l) => l.includes("comparado com")) ?? "";
check(compLinha.length > 0, `linha de comparação visível (${compLinha.trim().slice(0, 48)})`);

// O período de comparação termina 1ms antes do início do "mês anterior".
const spanMs = antFim.getTime() - antInicio.getTime();
const compTo = new Date(antInicio.getTime() - 1);
const compFrom = new Date(compTo.getTime() - spanMs);
const esperadoComp = await dbRevenue(empresaA.id, compFrom, compTo);
// O valor "antes" aparece no hint do card de faturamento.
const antesNaTela = brlToCents(corpoComp.match(/antes (R\$[^\n·]*)/)?.[1] ?? "");
console.log(`   comparação banco: ${esperadoComp.revenue} | tela "antes": ${antesNaTela}`);
check(
  antesNaTela === esperadoComp.revenue,
  "valor do período anterior na tela = banco no intervalo comparado",
);

// ---------------------------------------------------------------- TESTE 5
console.log("\n══ TESTE 5: período sem dados ══");

const vazio = await faturamentoNaTela("personalizado", "&de=2019-01-01&ate=2019-01-31");
check(vazio.vazio, "estado vazio exibido para período sem dados");
const corpoVazio = await p.locator("body").innerText();
check(
  !/R\$\s*[1-9]/.test(corpoVazio.split("Como estes números")[0]),
  "nenhum valor monetário diferente de zero é exibido no período vazio",
);

// ---------------------------------------------------------------- TESTE 6
console.log("\n══ TESTE 6: exportar CSV ══");

// A exportação usa os cookies da sessão (mesma origem). Baixa o mês anterior.
const respExport = await baixar(p, `${BASE}/relatorios/export?periodo=mes-anterior`);
check(respExport.ok(), `download responde 200 (${respExport.status()})`);
const disposition = respExport.headers()["content-disposition"] ?? "";
check(disposition.includes("autovolt-relatorio"), `nome do arquivo tem "autovolt-relatorio"`);
check(
  disposition.includes(iso(antInicio)),
  `nome do arquivo carrega o período (${disposition.match(/filename="([^"]+)"/)?.[1] ?? "?"})`,
);

const csv = await respExport.text();
// A linha do faturamento no resumo: "Faturamento (R$);<atual>;<anterior>;..."
const linhaFat = csv.split("\n").find((l) => l.startsWith("Faturamento (R$)")) ?? "";
const csvFatCents = Math.round(
  Number((linhaFat.split(";")[1] ?? "0").replace(/\./g, "").replace(",", ".")) * 100,
);
console.log(`   banco: ${esperadoAnt.revenue} | csv: ${csvFatCents}`);
check(csvFatCents === esperadoAnt.revenue, "faturamento no CSV = período selecionado no banco");
check(csv.includes("RANKING DE CLIENTES"), "CSV traz a seção de ranking");
check(csv.includes("SERVIÇOS"), "CSV traz a seção de serviços");
check(csv.includes("FORMAS DE PAGAMENTO"), "CSV traz a seção de pagamentos");

// ---------------------------------------------------------------- TESTE 7
console.log("\n══ TESTE 7: CSV compatível com Excel ══");

check(csv.charCodeAt(0) === 0xfeff, "arquivo começa com BOM UTF-8");
check(csv.split("\n")[0].trim() === "sep=;", "primeira linha declara o separador ponto e vírgula");
// Acentos preservados: procura um rótulo que só existe com UTF-8 correto.
check(/Serviço|Período|atribuída|SERVIÇOS/.test(csv), "acentos preservados (UTF-8)");
// Um serviço do catálogo com cedilha/acento aparece intacto, se houver no período.
const servicoAcentuado = await db.workOrderItem.findFirst({
  where: {
    workOrder: {
      companyId: empresaA.id,
      status: "concluida",
      finishedAt: { gte: antInicio, lte: antFim },
    },
    description: { contains: "ç" },
  },
  select: { description: true },
});
if (servicoAcentuado) {
  check(
    csv.includes(servicoAcentuado.description),
    `nome com cedilha intacto no CSV ("${servicoAcentuado.description}")`,
  );
} else {
  console.log("   (nenhum serviço com cedilha concluído neste período; etapa pulada)");
}
// Escape de RFC 4180: nenhuma célula quebra a estrutura. Cada linha de dados
// tem o mesmo número de separadores que não estão entre aspas — checagem
// simples: o arquivo parseia sem aspas órfãs.
const aspasOrfas = (csv.match(/"/g) ?? []).length % 2 === 0;
check(aspasOrfas, "aspas balanceadas (escape RFC 4180 correto)");

// ---------------------------------------------------------------- TESTE 8
console.log("\n══ TESTE 8: usuário sem permissão financeira ══");

const staff = await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: "pt-BR" });
const ps = await staff.newPage();
await ps.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await ps.fill('input[name="email"]', "diego.nakamura@garage77.com.br");
await ps.fill('input[name="password"]', "autovolt123");
await ps.click('button[type="submit"]');
await ps.waitForURL("**/dashboard", { timeout: 15000 });

expectingBlock = true;
await ps.goto(`${BASE}/relatorios`, { waitUntil: "networkidle" });
check(ps.url().endsWith("/dashboard"), `staff é redirecionado de /relatorios (${ps.url()})`);

const exportStaff = await baixar(ps, `${BASE}/relatorios/export?periodo=este-mes`);
check(exportStaff.status() === 403, `export via chamada direta responde 403 (${exportStaff.status()})`);
expectingBlock = false;

// ---------------------------------------------------------------- TESTE 9
console.log("\n══ TESTE 9: isolamento multiempresa ══");

// O dono tem duas empresas. Troca para a B e confere que o CSV muda e que a
// exportação usa a empresa da SESSÃO, não um id da URL.
await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await p.locator("header button").first().click();
await p.waitForSelector('[role="menu"]');
const opcaoB = p.locator('[role="menu"] form button').nth(1);
const nomeB = (await opcaoB.innerText()).split("\n")[0].trim();
await opcaoB.click();
await p.waitForFunction(
  (n) => document.querySelector("header button")?.textContent?.includes(n) ?? false,
  nomeB,
  { timeout: 20000 },
);

const empresaB = await db.company.findFirst({
  where: { name: nomeB },
  select: { id: true, name: true },
});
check(empresaB.id !== empresaA.id, `empresa ativa agora é a B (${empresaB.name})`);

const esperadoB = await dbRevenue(empresaB.id, antInicio, antFim);
const csvB = await (await baixar(p, `${BASE}/relatorios/export?periodo=mes-anterior`)).text();
const linhaFatB = csvB.split("\n").find((l) => l.startsWith("Faturamento (R$)")) ?? "";
const csvBcents = Math.round(
  Number((linhaFatB.split(";")[1] ?? "0").replace(/\./g, "").replace(",", ".")) * 100,
);
console.log(`   banco B: ${esperadoB.revenue} | csv B: ${csvBcents} | A era: ${esperadoAnt.revenue}`);
check(csvBcents === esperadoB.revenue, "CSV da empresa B reflete os dados da empresa B");
check(csvB.includes(empresaB.name), "CSV nomeia a empresa B");
check(!csvB.includes(empresaA.name), "CSV da B não contém o nome da empresa A");

await staff.close();

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
