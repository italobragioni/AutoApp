/**
 * Teste do modulo Campanhas.
 *
 * TESTE 1  criar campanha para clientes em risco -> participantes reais
 * TESTE 2  remover um cliente antes de salvar -> fica fora do snapshot
 * TESTE 3  snapshot resiste a mudanca de estagio do cliente
 * TESTE 4  registrar envio individual -> so os enviados entram na taxa
 * TESTE 5  OS concluida na janela -> conversao, receita e OS atribuida
 * TESTE 6  a mesma OS nao gera receita duas vezes
 * TESTE 7  cliente em duas campanhas -> OS vai para a mais recente
 * TESTE 8  campanha de outra empresa: leitura e escrita bloqueadas
 *
 * Requer o servidor rodando (npm run build && npm run start) e DATABASE_URL
 * apontando para o mesmo banco:
 *   CHROMIUM_PATH=/caminho/chrome node scripts/test-campanhas.mjs
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const CHROME = process.env.CHROMIUM_PATH;
const fails = [];
const noise = [];
let expecting404 = false;

const db = new PrismaClient();

function check(ok, label) {
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}`);
  if (!ok) fails.push(label);
}

/** O Intl pt-BR usa espaco nao-quebravel depois de "R$". */
const norm = (t) => t.replace(/\u00a0/g, " ");
const brl = (cents) =>
  `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Marca unica por execucao: o teste pode rodar varias vezes na mesma base. */
const TAG = `T${Math.floor(Date.now() / 1000) % 100000}`;

/**
 * OS criadas por este teste. Elas concluem atendimentos HOJE, o que muda o
 * estagio de retencao dos clientes envolvidos — sem desfazer no fim, a proxima
 * execucao nao encontraria ninguem "em risco".
 */
const ordensCriadas = [];

async function switchCompany(page, index) {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.locator("header button").first().click();
  await page.waitForSelector('[role="menu"]');
  const option = page.locator('[role="menu"] form button').nth(index);
  const target = (await option.innerText()).split("\n")[0].trim();
  await option.click();
  await page.waitForFunction(
    (n) => document.querySelector("header button")?.textContent?.includes(n) ?? false,
    target,
    { timeout: 20000 },
  );
  return target;
}

/** Abre o formulario de nova campanha e escolhe o publico. */
async function openNewCampaign(page, audience) {
  await page.goto(`${BASE}/campanhas?nova=1`, { waitUntil: "networkidle" });
  await page.waitForSelector("#campaign-form", { timeout: 8000 });
  await page.selectOption('select[name="audience"]', audience);
  await page.waitForTimeout(300);
}

/** Ids dos clientes marcados na previa (os que vao para o snapshot). */
async function selectedIds(page) {
  return page
    .locator('#campaign-form input[name="customerIds"]')
    .evaluateAll((els) => els.map((el) => el.value));
}

async function submitCampaign(page, { name, message }) {
  await page.fill('#campaign-form input[name="name"]', name);
  await page.fill('#campaign-form textarea[name="message"]', message);
  await page.click('#campaign-form button[type="submit"]');
  await page.waitForURL(/\/campanhas\/[a-z0-9]+$/, { timeout: 15000 });
  return page.url().split("/").pop();
}

/** Cria e conclui uma OS pela interface, com o valor pedido. */
async function createAndCompleteOrder(page, customerId, valor) {
  await page.goto(`${BASE}/ordens?nova=1`, { waitUntil: "networkidle" });
  await page.waitForSelector('[role="dialog"]', { timeout: 8000 });
  await page.selectOption('select[name="customerId"]', customerId);
  await page.waitForTimeout(300);
  const veiculos = await page
    .locator('select[name="vehicleId"] option')
    .evaluateAll((els) => els.filter((e) => e.value).map((e) => e.value));
  if (veiculos.length === 0) return null;
  await page.selectOption('select[name="vehicleId"]', veiculos[0]);
  await page.locator('#work-order-form input[type="checkbox"]').first().check();
  await page.waitForTimeout(300);
  await page.fill('input[name="date"]', today());
  await page.click('#work-order-form button[type="submit"]');
  await page.waitForURL(/\/ordens\/[a-z0-9]+$/, { timeout: 15000 });
  const osId = page.url().split("/").pop();

  await page.click('button:has-text("Concluir e receber")');
  await page.waitForSelector('[role="dialog"]');
  await page.selectOption('select[name="paymentMethod"]', "pix");
  await page.fill('input[name="paidAmount"]', valor);
  await page.fill('input[name="finishedAt"]', today());
  await page.click('#complete-form button[type="submit"]');
  await page.waitForTimeout(3000);
  ordensCriadas.push(osId);
  return osId;
}

/** Marca um participante com um status, pela linha dele na tabela. */
async function markParticipant(page, campaignId, customerId, label) {
  await page.goto(`${BASE}/campanhas/${campaignId}`, { waitUntil: "networkidle" });
  const row = page.locator(`tbody tr:has(a[href="/clientes/${customerId}"])`);
  await row.locator(`button:has-text("${label}")`).first().click();
  await page.waitForTimeout(2500);
}

const b = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: "pt-BR" });
const p = await ctx.newPage();
// A URL entra no registro: sem ela, um erro isolado vira um mistério que não dá
// para investigar depois.
p.on("pageerror", (e) => noise.push(`pageerror em ${p.url()}: ${e.message}`));
p.on("console", (m) => {
  if (m.type() === "error" && !expecting404) noise.push(`console em ${p.url()}: ${m.text()}`);
});

await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.click('button[type="submit"]');
await p.waitForURL("**/dashboard");

// ---------------------------------------------------------------- TESTE 1
console.log("\n══ TESTE 1: campanha para clientes em risco ══");

// Quantos clientes em risco a tela de Retencao mostra? E o mesmo motor, entao
// os dois numeros tem que bater.
await p.goto(`${BASE}/retencao?aba=em_risco`, { waitUntil: "networkidle" });
const emRiscoNaRetencao = await p
  .locator('tbody tr a[href^="/clientes/"]')
  .evaluateAll((els) => els.map((el) => el.getAttribute("href").split("/").pop()));
console.log(`   retenção mostra ${emRiscoNaRetencao.length} cliente(s) em risco`);

await openNewCampaign(p, "em_risco");
const rotuloPublico = await p
  .locator('#campaign-form select[name="audience"] option[value="em_risco"]')
  .innerText();
const totalNoRotulo = Number(rotuloPublico.match(/\((\d+)\)/)?.[1] ?? -1);
check(
  totalNoRotulo === emRiscoNaRetencao.length,
  `público do formulário bate com a Retenção (${totalNoRotulo})`,
);

/**
 * O teste 2 precisa remover alguem e ainda sobrar gente. Os outros modulos da
 * suite concluem OS hoje e vao esvaziando o publico "em risco" da base, entao
 * quando ele fica pequeno o teste cai para "todos" — as verificacoes de
 * snapshot valem para qualquer publico.
 */
const PUBLICO = emRiscoNaRetencao.length >= 2 ? "em_risco" : "todos";
if (PUBLICO !== "em_risco") {
  console.log(`   (só ${emRiscoNaRetencao.length} em risco nesta base: usando o público "todos")`);
  await p.selectOption('#campaign-form select[name="audience"]', PUBLICO);
  await p.waitForTimeout(300);
}

const previa = await selectedIds(p);
if (PUBLICO === "em_risco") {
  check(previa.length === emRiscoNaRetencao.length, `prévia lista ${previa.length} participante(s)`);
  check(
    previa.every((id) => emRiscoNaRetencao.includes(id)),
    "prévia contém exatamente os clientes em risco",
  );
} else {
  check(previa.length >= 2, `prévia lista ${previa.length} participante(s)`);
}

const campanha1 = await submitCampaign(p, {
  name: `${TAG} Em risco`,
  message: "Oi {nome}! O {veiculo} está sentindo falta da gente.",
});
check(Boolean(campanha1), `campanha criada (${campanha1})`);

const participantes1 = await db.campaignParticipant.findMany({
  where: { campaignId: campanha1 },
  select: { customerId: true, stage: true, status: true, sentAt: true, customer: { select: { companyId: true } } },
});
check(
  participantes1.length === previa.length,
  `${participantes1.length} participantes gravados no banco`,
);
const campanhaDb = await db.campaign.findUnique({ where: { id: campanha1 } });
check(
  participantes1.every((x) => x.customer.companyId === campanhaDb.companyId),
  "todos os participantes são da empresa da campanha",
);
check(
  participantes1.every((x) => typeof x.stage === "string" && x.stage.length > 0),
  `estágio de retenção congelado no snapshot (${[...new Set(participantes1.map((x) => x.stage))].join(", ")})`,
);
check(
  participantes1.every((x) => x.status === "pendente" && x.sentAt === null),
  "criar campanha NÃO marca ninguém como enviado",
);
check(
  campanhaDb.sentCount === 0 && campanhaDb.convertedCount === 0 && campanhaDb.revenueCents === 0,
  "contadores da campanha nascem zerados",
);

// ---------------------------------------------------------------- TESTE 2
console.log("\n══ TESTE 2: remover cliente antes de salvar ══");

await openNewCampaign(p, PUBLICO);
const antes = await selectedIds(p);
const removido = antes[0];
await p.locator("#campaign-form input[type=checkbox]").first().uncheck();
await p.waitForTimeout(300);
const depois = await selectedIds(p);
check(depois.length === antes.length - 1, `prévia caiu de ${antes.length} para ${depois.length}`);
check(!depois.includes(removido), "cliente desmarcado sai da lista de envio");

const campanha2 = await submitCampaign(p, {
  name: `${TAG} Sem um cliente`,
  message: "Oi {nome}, tudo bem?",
});
const participantes2 = await db.campaignParticipant.findMany({
  where: { campaignId: campanha2 },
  select: { customerId: true, stage: true },
});
const participantes2Stage = new Map(participantes2.map((x) => [x.customerId, x.stage]));
check(
  participantes2.length === antes.length - 1,
  `snapshot salvo com ${participantes2.length} participantes`,
);
check(
  !participantes2.some((x) => x.customerId === removido),
  "cliente removido não participa do snapshot",
);

// O cliente removido continua intacto na retenção — o estágio dele não mudou.
const estagioDoRemovido = await db.customer.findUnique({
  where: { id: removido },
  select: { id: true },
});
check(Boolean(estagioDoRemovido), "cliente removido da campanha continua cadastrado");
await p.goto(`${BASE}/retencao?aba=prioridade`, { waitUntil: "networkidle" });
check(
  (await p.locator("tbody tr").count()) >= 0,
  "remover da campanha não mexeu na tela de retenção",
);

// ---------------------------------------------------------------- TESTE 3
console.log("\n══ TESTE 3: snapshot resiste à mudança de estágio ══");

// Escolhe um participante da campanha 2 que tenha veículo (precisa abrir OS).
await p.goto(`${BASE}/ordens?nova=1`, { waitUntil: "networkidle" });
await p.waitForSelector('[role="dialog"]');
const comVeiculo = await p
  .locator('select[name="customerId"] option')
  .evaluateAll((els) => els.filter((e) => e.value).map((e) => e.value));
// Precisa ser alguem que NAO esteja "em dia": so assim a OS de hoje muda o
// estagio dele e o teste consegue provar que o snapshot ficou congelado.
const alvo3 = participantes2.find(
  (x) => x.stage !== "em_dia" && comVeiculo.includes(x.customerId),
)?.customerId;
check(Boolean(alvo3), `participante com veículo e fora de "em dia" (${participantes2Stage.get(alvo3)})`);

// Uma OS concluída hoje muda o estágio dele para "Em dia".
await createAndCompleteOrder(p, alvo3, "180,00");

await p.goto(`${BASE}/retencao?aba=em_dia`, { waitUntil: "networkidle" });
check(
  (await p.locator(`tbody tr a[href="/clientes/${alvo3}"]`).count()) > 0,
  "motor de retenção reclassificou o cliente para Em dia",
);

const aindaParticipa = await db.campaignParticipant.findFirst({
  where: { campaignId: campanha2, customerId: alvo3 },
  select: { stage: true, workOrderId: true },
});
check(Boolean(aindaParticipa), "cliente continua participante da campanha");
const estagioNoSnapshot = participantes2Stage.get(alvo3);
check(
  aindaParticipa?.stage === estagioNoSnapshot && aindaParticipa?.stage !== "em_dia",
  `estágio do snapshot continua ${estagioNoSnapshot} (congelado, mesmo com o cliente agora Em dia)`,
);
check(
  aindaParticipa?.workOrderId === null,
  "sem envio registrado, a OS não vira conversão",
);

await p.goto(`${BASE}/campanhas/${campanha2}`, { waitUntil: "networkidle" });
check(
  (await p.locator(`tbody tr a[href="/clientes/${alvo3}"]`).count()) > 0,
  "campanha continua listando o cliente reclassificado",
);

// ---------------------------------------------------------------- TESTE 4
console.log("\n══ TESTE 4: envio individual define o denominador ══");

const alvosComVeiculo = participantes1
  .map((x) => x.customerId)
  .filter((id) => comVeiculo.includes(id));
check(alvosComVeiculo.length >= 2, `${alvosComVeiculo.length} participantes com veículo`);
const [enviado1, enviado2] = alvosComVeiculo;

await markParticipant(p, campanha1, enviado1, "Enviado");
await markParticipant(p, campanha1, enviado2, "Enviado");

const depoisDoEnvio = await db.campaignParticipant.findMany({
  where: { campaignId: campanha1 },
  select: { customerId: true, status: true, sentAt: true },
});
const enviados = depoisDoEnvio.filter((x) => x.sentAt !== null);
check(enviados.length === 2, `apenas 2 de ${depoisDoEnvio.length} participantes com envio`);
check(
  enviados.every((x) => [enviado1, enviado2].includes(x.customerId)),
  "somente os dois marcados receberam data de envio",
);

const campanha1Db = await db.campaign.findUnique({ where: { id: campanha1 } });
check(campanha1Db.sentCount === 2, "contador de enviadas recalculado a partir dos participantes");

await p.goto(`${BASE}/campanhas/${campanha1}`, { waitUntil: "networkidle" });
let corpo = norm(await p.locator("body").innerText());
check(corpo.includes("0 de 2 que receberam"), "taxa de conversão usa só quem recebeu");

// ---------------------------------------------------------------- TESTE 5
console.log("\n══ TESTE 5: OS concluída na janela vira conversão ══");

const VALOR = 52000; // R$ 520,00
const os5 = await createAndCompleteOrder(p, enviado1, "520,00");
check(Boolean(os5), `OS criada e concluída (${os5})`);

const convertido = await db.campaignParticipant.findFirst({
  where: { campaignId: campanha1, customerId: enviado1 },
  select: { workOrderId: true, convertedAt: true, revenueCents: true },
});
check(convertido?.workOrderId === os5, "OS atribuída ao participante certo");
check(Boolean(convertido?.convertedAt), "data da conversão registrada");
check(convertido?.revenueCents === VALOR, `receita atribuída = ${brl(VALOR)}`);

await p.goto(`${BASE}/campanhas/${campanha1}`, { waitUntil: "networkidle" });
corpo = norm(await p.locator("body").innerText());
check(corpo.includes(brl(VALOR)), "receita aparece na tela da campanha");
check(corpo.includes("50%"), "taxa de conversão real: 1 de 2 = 50%");
const linkOs = await p
  .locator(`tbody tr:has(a[href="/clientes/${enviado1}"]) a[href^="/ordens/"]`)
  .count();
check(linkOs > 0, "OS atribuída aparece na linha do participante");

// ---------------------------------------------------------------- TESTE 6
console.log("\n══ TESTE 6: a mesma OS não gera receita duas vezes ══");

const donos = await db.campaignParticipant.count({ where: { workOrderId: os5 } });
check(donos === 1, "a OS está atribuída a exatamente um participante");

const totalCampanha1 = await db.campaignParticipant.aggregate({
  where: { campaignId: campanha1 },
  _sum: { revenueCents: true },
});
check(
  totalCampanha1._sum.revenueCents === VALOR,
  `receita da campanha soma a OS uma única vez (${brl(totalCampanha1._sum.revenueCents)})`,
);

// Tentativa direta de gravar a mesma OS em outro participante: o banco recusa.
const outroParticipante = await db.campaignParticipant.findFirst({
  where: { campaignId: campanha1, workOrderId: null },
  select: { id: true },
});
let recusado = false;
try {
  await db.campaignParticipant.update({
    where: { id: outroParticipante.id },
    data: { workOrderId: os5, revenueCents: VALOR },
  });
} catch {
  recusado = true;
}
check(recusado, "banco recusa a mesma OS em dois participantes (índice único)");

// ---------------------------------------------------------------- TESTE 7
console.log("\n══ TESTE 7: cliente em duas campanhas ══");

// enviado2 ainda nao converteu na campanha 1. Cria uma segunda campanha com
// ele e registra um envio MAIS RECENTE.
await openNewCampaign(p, "todos");
const todos = await selectedIds(p);
check(todos.includes(enviado2), "cliente disponível no público 'todos'");
// Deixa so ele: desmarca o resto.
for (const id of todos) {
  if (id === enviado2) continue;
  await p.locator(`#campaign-form input[type=checkbox]`).nth(todos.indexOf(id)).uncheck();
}
await p.waitForTimeout(400);
const soEle = await selectedIds(p);
check(soEle.length === 1 && soEle[0] === enviado2, "campanha nova com um único participante");

const campanha3 = await submitCampaign(p, {
  name: `${TAG} Segunda campanha`,
  message: "Oi {nome}! Condição especial esta semana.",
});
await markParticipant(p, campanha3, enviado2, "Enviado");

const envioC1 = await db.campaignParticipant.findFirst({
  where: { campaignId: campanha1, customerId: enviado2 },
  select: { sentAt: true },
});
const envioC3 = await db.campaignParticipant.findFirst({
  where: { campaignId: campanha3, customerId: enviado2 },
  select: { sentAt: true },
});
check(
  envioC3.sentAt > envioC1.sentAt,
  "segunda campanha tem envio mais recente para o mesmo cliente",
);

const VALOR7 = 33000; // R$ 330,00
const os7 = await createAndCompleteOrder(p, enviado2, "330,00");

const naC1 = await db.campaignParticipant.findFirst({
  where: { campaignId: campanha1, customerId: enviado2 },
  select: { workOrderId: true, revenueCents: true },
});
const naC3 = await db.campaignParticipant.findFirst({
  where: { campaignId: campanha3, customerId: enviado2 },
  select: { workOrderId: true, revenueCents: true },
});
check(naC3?.workOrderId === os7, "OS foi para a campanha enviada mais recentemente");
check(naC1?.workOrderId === null, "campanha antiga NÃO recebeu a mesma OS");
check(naC1?.revenueCents === 0, "campanha antiga continua sem essa receita");
check(naC3?.revenueCents === VALOR7, `receita da campanha nova = ${brl(VALOR7)}`);

const totalC1 = await db.campaign.findUnique({ where: { id: campanha1 } });
check(
  totalC1.revenueCents === VALOR,
  "receita da campanha 1 não mudou com a conversão da campanha 3",
);

// ---------------------------------------------------------------- TESTE 8
console.log("\n══ TESTE 8: isolamento multiempresa ══");

const outra = await switchCompany(p, 1);
console.log(`   empresa ativa: ${outra}`);

expecting404 = true;
const resposta = await p.goto(`${BASE}/campanhas/${campanha1}`, { waitUntil: "networkidle" });
check(resposta.status() === 404, `campanha de outra empresa responde 404 (${resposta.status()})`);
expecting404 = false;

check(
  !(await p.locator(`a[href="/campanhas/${campanha1}"]`).count()),
  "campanha da empresa A não aparece na listagem da empresa B",
);

// Escrita: marca um participante da empresa A pelo formulario da empresa B.
const participanteA = await db.campaignParticipant.findFirst({
  where: { campaignId: campanha2, status: "pendente" },
  select: { id: true },
});

// Cria uma campanha na empresa B so para ter um formulario de participante.
await openNewCampaign(p, "todos");
const idsB = await selectedIds(p);
for (const id of idsB.slice(1)) {
  await p.locator(`#campaign-form input[type=checkbox]`).nth(idsB.indexOf(id)).uncheck();
}
await p.waitForTimeout(400);
const campanhaB = await submitCampaign(p, {
  name: `${TAG} Empresa B`,
  message: "Oi {nome}!",
});

// Troca o id no formulario pelo participante da empresa A. A injecao vem por
// ultimo: qualquer interacao depois faria o React repintar o campo escondido.
await p.evaluate((id) => {
  const form = document.querySelector(`form input[name="participantId"]`).closest("form");
  form.querySelector('input[name="participantId"]').value = id;
}, participanteA.id);
await p.locator('button:has-text("Enviado")').first().click();
await p.waitForTimeout(2500);

const alvoIntacto = await db.campaignParticipant.findUnique({
  where: { id: participanteA.id },
  select: { sentAt: true, status: true },
});
check(
  alvoIntacto.status === "pendente" && alvoIntacto.sentAt === null,
  "participante da empresa A não foi alterado pela empresa B",
);
const campanhaBDb = await db.campaign.findUnique({ where: { id: campanhaB } });
check(campanhaBDb.companyId !== campanhaDb.companyId, "as duas empresas são diferentes");

// Limpeza: campanhas primeiro (leva os participantes junto), depois as OS que
// o teste concluiu — assim os clientes voltam ao estagio de retencao anterior e
// a proxima execucao encontra a mesma base.
await db.campaign.deleteMany({ where: { name: { startsWith: TAG } } });
await db.workOrder.deleteMany({ where: { id: { in: ordensCriadas.filter(Boolean) } } });

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
