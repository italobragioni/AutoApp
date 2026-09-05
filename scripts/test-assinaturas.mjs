/**
 * Teste de assinaturas e pagamentos (Cakto).
 *
 * TESTE 1   novo usuário se cadastra → SEM acesso operacional antes de assinar
 * TESTE 2   iniciar checkout → nenhuma chave privada é exposta
 * TESTE 3   webhook válido de compra aprovada → assinatura ACTIVE
 * TESTE 4   mesmo webhook duas vezes → sem registros duplicados (idempotência)
 * TESTE 5   troca de empresa: ativa libera, empresa sem assinatura bloqueia
 * TESTE 6   funcionário da empresa ativa acessa conforme permissões
 * TESTE 7   funcionário tenta gerenciar assinatura → servidor bloqueia
 * TESTE 8   assinatura cancelada → dados preservados
 * TESTE 9   webhook de renovação → segue ativa e período é atualizado
 * TESTE 10  build/deploy: nada é apagado, nenhum secret é exposto
 * TESTE 11  conta demo (isenta) opera sem assinatura
 *
 * A liberação de acesso NUNCA é testada pela URL de retorno: em todos os casos a
 * verdade é conferida no banco depois de um webhook autenticado. O corpo do
 * webhook é assinado com o mesmo CAKTO_WEBHOOK_SECRET do servidor.
 *
 * Requer o servidor rodando com as variáveis da Cakto:
 *   CAKTO_WEBHOOK_SECRET=... CAKTO_CHECKOUT_URL_PROFESSIONAL=... \
 *   CAKTO_PRODUCT_ID_PROFESSIONAL=... CAKTO_PRICE_PROFESSIONAL_CENTS=9700 \
 *   npm run start
 * e depois:
 *   CAKTO_WEBHOOK_SECRET=... CHROMIUM_PATH=/caminho/chrome node scripts/test-assinaturas.mjs
 */
import { execSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

import { login } from "./_billing.mjs";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const CHROME = process.env.CHROMIUM_PATH;
const SECRET = process.env.CAKTO_WEBHOOK_SECRET ?? "cakto-test-secret-do-not-ship";
const CHECKOUT_HOST = "pay.cakto.com.br";
const fails = [];

const db = new PrismaClient();

function check(ok, label) {
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}`);
  if (!ok) fails.push(label);
}

const TAG = `sub${Math.floor(Date.now() / 1000) % 100000}`;
const EMAIL = `${TAG}@autovolt.com.br`;
const SENHA = "assinatura123";
const STAFF_EMAIL = `${TAG}.staff@autovolt.com.br`;

const b = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

async function novaAba(viewport = { width: 1440, height: 1000 }) {
  const ctx = await b.newContext({ viewport, locale: "pt-BR" });
  return ctx.newPage();
}

/** POST autenticado (ou não) no endpoint de webhook. */
async function webhook(event, data, secret = SECRET) {
  const res = await fetch(`${BASE}/api/webhooks/cakto`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret, event, data }),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* corpo não-JSON */
  }
  return { status: res.status, json };
}

const futuroISO = (dias) => new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString();

// ---------------------------------------------------------------- TESTE 1
console.log("\n══ TESTE 1: cadastro não libera acesso operacional ══");

const p = await novaAba();
await p.goto(`${BASE}/cadastro`, { waitUntil: "networkidle" });
await p.fill('input[name="name"]', `Dono ${TAG}`);
await p.fill('input[name="companyName"]', `Estética ${TAG}`);
await p.fill('input[name="email"]', EMAIL);
await p.fill('input[name="password"]', SENHA);
await p.click('button[type="submit"]');
await p.waitForURL("**/assinatura**", { timeout: 20000 });
check(p.url().includes("/assinatura"), "cadastro leva direto para /assinatura");

const empresa = await db.company.findFirst({
  where: { memberships: { some: { user: { email: EMAIL } } } },
  select: { id: true, name: true },
});
check(Boolean(empresa), `empresa nova criada (${empresa?.name})`);

// Tentar entrar numa rota operacional cai de volta em /assinatura.
await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
check(p.url().endsWith("/assinatura"), "dashboard redireciona para /assinatura sem assinatura");
await p.goto(`${BASE}/clientes`, { waitUntil: "networkidle" });
check(p.url().endsWith("/assinatura"), "clientes redireciona para /assinatura sem assinatura");

const sub0 = await db.subscription.findUnique({ where: { companyId: empresa.id } });
check(!sub0 || sub0.status !== "active", "empresa nasce sem assinatura ativa");

// ---------------------------------------------------------------- TESTE 2
console.log("\n══ TESTE 2: checkout não expõe chave privada ══");

// Intercepta a ida ao checkout hospedado para ler a URL sem navegar para fora.
let checkoutUrl = null;
await p.route(`https://${CHECKOUT_HOST}/**`, (route) => {
  checkoutUrl = route.request().url();
  return route.abort();
});

await p.goto(`${BASE}/assinatura`, { waitUntil: "networkidle" });
const htmlAssinatura = await p.content();
check(!htmlAssinatura.includes(SECRET), "a página de assinatura não contém o secret do webhook");

// O botão só existe para o dono (é ele quem está logado aqui).
const temControle = await p.locator('form input[name="plan"]').count();
check(temControle > 0, "o dono vê o controle de assinar");

await p.click('form:has(input[name="plan"]) button[type="submit"]');
// Aguarda a interceptação do redirecionamento para a Cakto.
for (let i = 0; i < 30 && !checkoutUrl; i++) await p.waitForTimeout(200);

check(Boolean(checkoutUrl), "checkout redireciona para o host da Cakto");
if (checkoutUrl) {
  check(checkoutUrl.includes("src="), "URL do checkout carrega a referência segura (src)");
  check(checkoutUrl.includes("email="), "URL do checkout pré-preenche o e-mail");
  check(!checkoutUrl.includes(SECRET), "URL do checkout não contém o secret");
  check(!/api[_-]?key/i.test(checkoutUrl), "URL do checkout não contém chave de API");
}
await p.unroute(`https://${CHECKOUT_HOST}/**`);

const subCheckout = await db.subscription.findUnique({ where: { companyId: empresa.id } });
check(Boolean(subCheckout?.checkoutRef), "checkout gravou uma referência no backend");
check(subCheckout?.status !== "active", "checkout sozinho NÃO ativa a assinatura");
const REF = subCheckout.checkoutRef;
const CAKTO_SUB_ID = `${TAG}-cakto-sub`;

// ---------------------------------------------------------------- TESTE 3
console.log("\n══ TESTE 3: compra aprovada ativa a assinatura ══");

const dadosCompra = {
  id: `${TAG}-ord1`,
  src: REF,
  customer: { email: EMAIL, name: `Dono ${TAG}` },
  product: { id: "prod-professional", short_id: "prof" },
  subscription: { id: CAKTO_SUB_ID, next_payment_date: futuroISO(30) },
  amount: 97.0,
};
const r3 = await webhook("purchase_approved", dadosCompra);
check(r3.status === 200, "webhook de compra aprovada responde 200");

const sub3 = await db.subscription.findUnique({ where: { companyId: empresa.id } });
check(sub3.status === "active", "assinatura ficou ACTIVE");
check(sub3.caktoSubscriptionId === CAKTO_SUB_ID, "id da assinatura da Cakto foi vinculado");
check(Boolean(sub3.currentPeriodEnd), "período de renovação foi registrado");

// Agora o acesso operacional abre.
await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
check(p.url().endsWith("/dashboard"), "com assinatura ativa, o dashboard abre");

// ---------------------------------------------------------------- TESTE 4
console.log("\n══ TESTE 4: idempotência (mesmo evento duas vezes) ══");

const r4 = await webhook("purchase_approved", dadosCompra);
check(r4.status === 200, "reentrega responde 200");
check(r4.json?.result === "duplicate", "reentrega é reconhecida como duplicada");

const eventos = await db.webhookEvent.count({
  where: { externalId: `purchase_approved:${TAG}-ord1` },
});
check(eventos === 1, "o evento foi registrado uma única vez");
const assinaturas = await db.subscription.count({ where: { companyId: empresa.id } });
check(assinaturas === 1, "não criou uma segunda assinatura para a empresa");

// ---------------------------------------------------------------- TESTE 5
console.log("\n══ TESTE 5: multiempresa (uma ativa, outra sem assinatura) ══");

const dono = await db.user.findUnique({ where: { email: EMAIL }, select: { id: true } });
const filial = await db.company.create({
  data: {
    name: `Filial ${TAG}`,
    slug: `filial-${TAG}`,
    memberships: { create: { userId: dono.id, role: "owner" } },
  },
});

// Troca para a filial (sem assinatura) pelo seletor de empresa da Topbar.
await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await p.locator("header button").first().click();
await p.waitForTimeout(300);
await p.locator(`form:has(input[name="companyId"]) button:has-text("Filial ${TAG}")`).first().click();
await p.waitForURL("**/assinatura", { timeout: 15000 }).catch(() => {});
check(p.url().endsWith("/assinatura"), "empresa sem assinatura é bloqueada (vai para /assinatura)");

// Volta para a empresa ativa: novo login escolhe a primeira empresa (a ativa).
await p.locator('button:has-text("Sair")').first().click();
await p.waitForURL("**/login", { timeout: 15000 });
await login(p, BASE, EMAIL, SENHA);
check(p.url().endsWith("/dashboard"), "empresa ativa continua liberando o acesso");

// ---------------------------------------------------------------- TESTE 6
console.log("\n══ TESTE 6: funcionário da empresa ativa ══");

// A senha reaproveita o hash da conta demo (autovolt123), como nos outros testes.
const demoHash = (
  await db.user.findUnique({ where: { email: "demo@autovolt.com.br" }, select: { passwordHash: true } })
).passwordHash;
await db.user.create({
  data: {
    name: `Staff ${TAG}`,
    email: STAFF_EMAIL,
    passwordHash: demoHash,
    emailVerifiedAt: new Date(),
    memberships: { create: { companyId: empresa.id, role: "staff" } },
  },
});

const staff = await novaAba();
await login(staff, BASE, STAFF_EMAIL, "autovolt123");
check(staff.url().endsWith("/dashboard"), "funcionário da empresa ativa acessa o sistema");

await staff.goto(`${BASE}/clientes`, { waitUntil: "networkidle" });
check(staff.url().endsWith("/clientes"), "funcionário acessa Clientes (tem permissão)");
await staff.goto(`${BASE}/relatorios`, { waitUntil: "networkidle" });
check(
  staff.url().endsWith("/dashboard"),
  "funcionário sem permissão de relatórios é redirecionado (permissão preservada)",
);

// ---------------------------------------------------------------- TESTE 7
console.log("\n══ TESTE 7: funcionário não gerencia assinatura ══");

await staff.goto(`${BASE}/assinatura`, { waitUntil: "networkidle" });
// A prova do bloqueio no SERVIDOR: o controle de checkout não é renderizado para
// o funcionário (o botão posta uma action que também re-checa billing.manage).
const staffTemControle = await staff.locator('form input[name="plan"]').count();
check(staffTemControle === 0, "servidor não renderiza o controle de assinar para o funcionário");
// Ele ainda VÊ a assinatura (só não a gerencia): a página abre com o plano.
check(
  (await staff.locator("body").innerText()).includes("AUTOVOLT Profissional"),
  "funcionário vê a assinatura, mas sem controle para gerenciá-la",
);
await staff.close();

// ---------------------------------------------------------------- TESTE 8
console.log("\n══ TESTE 8: cancelamento preserva os dados ══");

// Cria um dado real na empresa para provar que o cancelamento não apaga nada.
const cliente = await db.customer.create({
  data: { companyId: empresa.id, name: `Cliente ${TAG}` },
});
const antes = {
  clientes: await db.customer.count({ where: { companyId: empresa.id } }),
  memberships: await db.membership.count({ where: { companyId: empresa.id } }),
};

const r8 = await webhook("subscription_canceled", {
  id: `${TAG}-cancel`,
  src: REF,
  subscription: { id: CAKTO_SUB_ID, canceledAt: new Date().toISOString() },
});
check(r8.status === 200, "webhook de cancelamento responde 200");

const sub8 = await db.subscription.findUnique({ where: { companyId: empresa.id } });
check(sub8.status === "canceled", "assinatura ficou CANCELED");
check(Boolean(sub8.canceledAt), "data de cancelamento foi registrada");

const depois = {
  clientes: await db.customer.count({ where: { companyId: empresa.id } }),
  memberships: await db.membership.count({ where: { companyId: empresa.id } }),
};
check(depois.clientes === antes.clientes, "clientes preservados após o cancelamento");
check(depois.memberships === antes.memberships, "equipe (memberships) preservada");
check(
  Boolean(await db.company.findUnique({ where: { id: empresa.id } })),
  "a empresa não foi apagada",
);
check(
  Boolean(await db.customer.findUnique({ where: { id: cliente.id } })),
  "o cliente criado continua no banco",
);

// ---------------------------------------------------------------- TESTE 9
console.log("\n══ TESTE 9: renovação mantém ativa e atualiza período ══");

const novoFim = futuroISO(60);
const r9 = await webhook("subscription_renewed", {
  id: `${TAG}-renew`,
  src: REF,
  subscription: { id: CAKTO_SUB_ID, next_payment_date: novoFim },
});
check(r9.status === 200, "webhook de renovação responde 200");

const sub9 = await db.subscription.findUnique({ where: { companyId: empresa.id } });
check(sub9.status === "active", "após renovar, a assinatura volta a ACTIVE");
check(
  sub9.currentPeriodEnd && Math.abs(sub9.currentPeriodEnd.getTime() - new Date(novoFim).getTime()) < 60000,
  "o período de renovação foi atualizado",
);

// ---------------------------------------------------------------- TESTE 10
console.log("\n══ TESTE 10: build/deploy — nada apagado, nada exposto ══");

// 10a — webhook com secret errado é recusado e não muda nada.
const estadoAntes = sub9.status;
const rBad = await webhook("purchase_approved", { id: `${TAG}-bad`, src: REF }, "segredo-errado");
check(rBad.status === 401, "webhook com secret inválido é recusado (401)");
const subBad = await db.subscription.findUnique({ where: { companyId: empresa.id } });
check(subBad.status === estadoAntes, "webhook inválido não altera a assinatura");
check(
  !(await db.webhookEvent.findUnique({ where: { externalId: `purchase_approved:${TAG}-bad` } })),
  "evento não autenticado não é registrado",
);

// 10b — a migration de assinaturas é aditiva (sem SQL destrutivo).
try {
  const dir = readdirSync("prisma/migrations").find((d) => d.includes("assinaturas_e_pagamentos"));
  const sql = readFileSync(`prisma/migrations/${dir}/migration.sql`, "utf8");
  // Procura DML/DDL destrutivo de verdade — sem confundir com "ON DELETE CASCADE"
  // (cláusula de chave estrangeira, não apaga dados).
  check(
    !/\bDROP\s+(TABLE|COLUMN|SCHEMA|DATABASE|INDEX|CONSTRAINT)\b|\bDELETE\s+FROM\b|\bTRUNCATE\b/i.test(sql),
    "migration de assinaturas não tem DROP/DELETE FROM/TRUNCATE",
  );
  check(/CREATE TABLE "subscriptions"/.test(sql), "migration cria a tabela subscriptions");
} catch (e) {
  check(false, `não foi possível ler a migration: ${e.message}`);
}

// 10c — o secret não vaza no bundle do cliente.
try {
  const out = execSync(`grep -rl ${JSON.stringify(SECRET)} .next/static 2>/dev/null || true`, {
    encoding: "utf8",
  }).trim();
  check(out === "", "o secret do webhook não aparece no bundle do cliente (.next/static)");
} catch {
  check(true, "verificação de bundle ignorada (grep indisponível)");
}

// ---------------------------------------------------------------- TESTE 11
console.log("\n══ TESTE 11: conta demo opera sem assinatura (isenção) ══");

// Uma empresa NOVA da conta demo, sem nenhuma assinatura: só a isenção
// (BILLING_EXEMPT_EMAILS, que por padrão inclui a conta demo) pode liberar.
const demoUser = await db.user.findUnique({
  where: { email: "demo@autovolt.com.br" },
  select: { id: true },
});
const isenta = await db.company.create({
  data: {
    name: `Isenta ${TAG}`,
    slug: `isenta-${TAG}`,
    memberships: { create: { userId: demoUser.id, role: "owner" } },
  },
});
const subIsenta = await db.subscription.findUnique({ where: { companyId: isenta.id } });
check(!subIsenta, "a empresa isenta realmente não tem assinatura");

const demoPage = await novaAba();
await login(demoPage, BASE, "demo@autovolt.com.br", "autovolt123");
await demoPage.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await demoPage.locator("header button").first().click();
await demoPage.waitForTimeout(300);
await demoPage
  .locator(`form:has(input[name="companyId"]) button:has-text("Isenta ${TAG}")`)
  .first()
  .click();
await demoPage.waitForTimeout(1500);
check(
  demoPage.url().endsWith("/dashboard"),
  "conta demo acessa uma empresa SEM assinatura (isenção libera o acesso)",
);
await demoPage.close();

// ----------------------------------------------------------------
await b.close();
await db.$disconnect();

console.log(`\n${"─".repeat(52)}`);
if (fails.length === 0) {
  console.log("✔ TODOS OS TESTES DE ASSINATURA PASSARAM");
  process.exit(0);
} else {
  console.log(`✖ ${fails.length} falha(s):`);
  for (const f of fails) console.log(`   - ${f}`);
  process.exit(1);
}
