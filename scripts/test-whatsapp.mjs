/**
 * Teste do WhatsApp Automático (fase Mock — nenhuma mensagem real sai).
 *
 * TESTE 1  endpoint de execução exige o segredo (401 sem/errado)
 * TESTE 2  automações geram as mensagens certas (risco/inativo/lembrete/pós)
 * TESTE 3  variáveis são renderizadas (sem {tokens} sobrando)
 * TESTE 4  provider = mock em tudo (nada real é enviado)
 * TESTE 5  cliente sem telefone não recebe mensagem
 * TESTE 6  idempotência: rodar de novo não duplica
 * TESTE 7  cooldown: mesmo cliente/tipo não repete
 * TESTE 8  multiempresa: cada mensagem pertence à empresa do cliente
 * TESTE 9  toggle: automação desligada não envia
 * TESTE 10 interruptor geral desligado não envia nada
 * TESTE 11 UI /whatsapp no celular sem scroll horizontal
 *
 * Requer o servidor rodando com CRON_SECRET e o mesmo valor no ambiente do teste.
 *   CRON_SECRET=... CHROMIUM_PATH=/caminho/chrome node scripts/test-whatsapp.mjs
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const CHROME = process.env.CHROMIUM_PATH;
const SECRET = process.env.CRON_SECRET ?? "cron-secret-test";
const db = new PrismaClient();
const fails = [];
const check = (ok, label) => {
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}`);
  if (!ok) fails.push(label);
};

const TAG = `wa${Math.floor(Date.now() / 1000) % 100000}`;
const DAY = 24 * 60 * 60 * 1000;
let woNumber = 1;

async function makeCompany(suffix, settings = {}) {
  const company = await db.company.create({
    data: { name: `WA ${TAG}-${suffix}`, slug: `wa-${TAG}-${suffix}`, retentionWindowDays: 90, inactiveAfterDays: 180 },
  });
  await db.whatsAppIntegration.create({
    data: { companyId: company.id, provider: "mock", status: "connected", instanceName: `i-${suffix}`, phoneNumber: "11999999999", connectedAt: new Date() },
  });
  await db.whatsAppAutomationSettings.create({ data: { companyId: company.id, ...settings } });
  return company;
}

async function customer(companyId, name, phone, veh) {
  const c = await db.customer.create({ data: { companyId, name, phone } });
  let vehicleId = null;
  if (veh) {
    const v = await db.vehicle.create({
      data: { companyId, customerId: c.id, brand: veh[0], model: veh[1], plate: veh[2] ?? null },
    });
    vehicleId = v.id;
  }
  return { ...c, vehicleId };
}

async function concludedWO(companyId, customerId, vehicleId, daysAgo) {
  const finishedAt = new Date(Date.now() - daysAgo * DAY);
  await db.workOrder.create({
    data: { companyId, number: woNumber++, customerId, vehicleId, status: "concluida", totalCents: 12000, openedAt: finishedAt, finishedAt },
  });
}

async function appointmentIn(companyId, customerId, vehicleId, hoursAhead) {
  const startsAt = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
  await db.appointment.create({
    data: { companyId, customerId, vehicleId, startsAt, endsAt: new Date(startsAt.getTime() + 3600000), status: "agendado" },
  });
}

async function runEngine(force = true) {
  const res = await fetch(`${BASE}/api/automations/whatsapp/run${force ? "?force=1" : ""}`, {
    method: "POST",
    headers: { authorization: `Bearer ${SECRET}` },
  });
  return res;
}

async function messagesOf(companyId) {
  return db.whatsAppMessage.findMany({ where: { companyId }, include: { customer: { select: { name: true } } } });
}

// ------------------------------------------------------------- Setup
console.log(`\n▸ Preparando cenário (${TAG})`);
const A = await makeCompany("a");
const inativa = await customer(A.id, "Ana Inativa", "11988887777", ["Honda", "Civic", "ABC1D23"]);
await concludedWO(A.id, inativa.id, inativa.vehicleId, 200);
const risco = await customer(A.id, "Rui Risco", "11977776666", ["Ford", "Ka", "XYZ2E34"]);
await concludedWO(A.id, risco.id, risco.vehicleId, 130);
const semTel = await customer(A.id, "Sem Telefone", null, ["Fiat", "Uno"]);
await concludedWO(A.id, semTel.id, semTel.vehicleId, 200);
const agenda = await customer(A.id, "Aline Agenda", "11966665555", ["Jeep", "Compass"]);
await appointmentIn(A.id, agenda.id, agenda.vehicleId, 12);
const pos = await customer(A.id, "Pedro Pós", "11955554444", ["Toyota", "Corolla"]);
await concludedWO(A.id, pos.id, pos.vehicleId, 5);

const B = await makeCompany("b");
const inativaB = await customer(B.id, "Bia Inativa", "11944443333", ["VW", "Gol"]);
await concludedWO(B.id, inativaB.id, inativaB.vehicleId, 200);

const C = await makeCompany("c", { retentionInactiveEnabled: false });
const inativaC = await customer(C.id, "Célia Inativa", "11933332222", ["Chevrolet", "Onix"]);
await concludedWO(C.id, inativaC.id, inativaC.vehicleId, 200);

const D = await makeCompany("d", { enabled: false });
const inativaD = await customer(D.id, "Dora Inativa", "11922221111", ["Renault", "Kwid"]);
await concludedWO(D.id, inativaD.id, inativaD.vehicleId, 200);

// ------------------------------------------------------------- TESTE 1
console.log("\n══ TESTE 1: endpoint exige segredo ══");
const noAuth = await fetch(`${BASE}/api/automations/whatsapp/run?force=1`, { method: "POST" });
check(noAuth.status === 401, `sem Authorization → 401 (${noAuth.status})`);
const badAuth = await fetch(`${BASE}/api/automations/whatsapp/run?force=1`, { method: "POST", headers: { authorization: "Bearer errado" } });
check(badAuth.status === 401, `segredo errado → 401 (${badAuth.status})`);

// ------------------------------------------------------------- TESTE 2..5
console.log("\n══ TESTE 2-5: execução gera as mensagens certas ══");
const r1 = await runEngine(true);
check(r1.status === 200, `execução autorizada → 200 (${r1.status})`);

const aMsgs = await messagesOf(A.id);
const byType = (t) => aMsgs.filter((m) => m.automationType === t);
check(byType("risco").length === 1, `1 mensagem de risco (${byType("risco").length})`);
check(byType("inativo").length === 1, `1 mensagem de inativo (${byType("inativo").length})`);
check(byType("lembrete").length === 1, `1 lembrete (${byType("lembrete").length})`);
check(byType("pos_servico").length === 1, `1 pós-serviço (${byType("pos_servico").length})`);

const rMsg = byType("risco")[0];
check(rMsg?.content.includes("Rui") && rMsg?.content.includes("Ford Ka"), "risco personaliza nome + veículo");
const iMsg = byType("inativo")[0];
check(iMsg?.content.includes("Ana") && iMsg?.content.includes("Honda Civic"), "inativo personaliza nome + veículo");
const lMsg = byType("lembrete")[0];
check(Boolean(lMsg) && lMsg.content.includes("/") && lMsg.content.includes(":"), "lembrete traz data e horário");

// TESTE 3 — variáveis renderizadas (sem tokens sobrando)
check(aMsgs.every((m) => !m.content.includes("{")), "nenhuma mensagem tem {token} sem substituir");
// TESTE 4 — provider mock, status enviado
check(aMsgs.every((m) => m.provider === "mock"), "todas as mensagens usam o provider mock");
check(aMsgs.every((m) => m.status === "sent"), "todas as mensagens ficaram como enviadas (simulação)");
// TESTE 5 — sem telefone não recebe
check(aMsgs.every((m) => m.customerId !== semTel.id), "cliente sem telefone não recebeu mensagem");

// ------------------------------------------------------------- TESTE 6-7
console.log("\n══ TESTE 6-7: idempotência e cooldown ══");
const countBefore = aMsgs.length;
await runEngine(true); // segunda execução idêntica
const aMsgs2 = await messagesOf(A.id);
check(aMsgs2.length === countBefore, `rodar de novo não cria duplicatas (${countBefore} → ${aMsgs2.length})`);
const keys = aMsgs2.map((m) => m.dedupeKey);
check(new Set(keys).size === keys.length, "todas as chaves de deduplicação são únicas");

// ------------------------------------------------------------- TESTE 8
console.log("\n══ TESTE 8: isolamento multiempresa ══");
const aIds = new Set([inativa.id, risco.id, semTel.id, agenda.id, pos.id]);
check(aMsgs2.every((m) => aIds.has(m.customerId)), "empresa A só tem mensagens de clientes da empresa A");
const bMsgs = await messagesOf(B.id);
check(bMsgs.length === 1 && bMsgs[0].customerId === inativaB.id, "empresa B tem sua própria mensagem, isolada");

// ------------------------------------------------------------- TESTE 9-10
console.log("\n══ TESTE 9-10: toggles ══");
const cMsgs = await messagesOf(C.id);
check(cMsgs.filter((m) => m.automationType === "inativo").length === 0, "toggle inativo desligado → sem mensagem de inativo");
const dMsgs = await messagesOf(D.id);
check(dMsgs.length === 0, "interruptor geral desligado → nenhuma mensagem");

// ------------------------------------------------------------- TESTE 11
console.log("\n══ TESTE 11: UI no celular ══");
const b = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "pt-BR", isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.fill('input[name="email"]', "demo@autovolt.com.br");
await p.fill('input[name="password"]', "autovolt123");
await p.click('button[type="submit"]');
await p.waitForURL("**/dashboard", { timeout: 20000 });
await p.goto(`${BASE}/whatsapp`, { waitUntil: "networkidle" });
await p.waitForTimeout(400);
const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
check(overflow <= 1, `/whatsapp sem scroll horizontal no celular (${overflow}px)`);
check((await p.locator("body").innerText()).includes("WhatsApp conectado"), "empresa demo aparece conectada (Tela 2)");
await b.close();

// -------------------------------------------------------------
await db.$disconnect();
console.log(`\n${"─".repeat(52)}`);
if (fails.length === 0) {
  console.log("✔ TODOS OS TESTES DE WHATSAPP PASSARAM");
  process.exit(0);
} else {
  console.log(`✖ ${fails.length} falha(s):`);
  for (const f of fails) console.log(`   - ${f}`);
  process.exit(1);
}
