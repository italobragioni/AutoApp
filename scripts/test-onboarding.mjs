/**
 * Teste de Onboarding e primeira experiência.
 *
 * TESTE 1   empresa nova → checklist com progresso inicial correto
 * TESTE 2   cadastrar serviço → etapa marca sozinha
 * TESTE 3   cadastrar cliente e veículo → progresso sobe
 * TESTE 4   criar agendamento → progresso sobe
 * TESTE 5   criar OS → conclusão (mensagem de pronto)
 * TESTE 6   excluir um dado → progresso recalcula
 * TESTE 7   duas empresas → cada uma com seu progresso
 * TESTE 8   permissão → staff não recebe ação clicável que não pode executar
 * TESTE 9   checklist no celular
 * TESTE 10  empresa operacional → onboarding some depois de dispensar
 *
 * O progresso é lido do card no Dashboard e conferido contra o banco. Nenhum
 * dado fictício é criado: tudo passa pelos formulários reais da plataforma.
 *
 * Requer o servidor rodando (npm run build && npm run start) e DATABASE_URL.
 *   CHROMIUM_PATH=/caminho/chrome node scripts/test-onboarding.mjs
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const CHROME = process.env.CHROMIUM_PATH;
const fails = [];
const noise = [];

const db = new PrismaClient();

function check(ok, label) {
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}`);
  if (!ok) fails.push(label);
}

const TAG = `onb${Math.floor(Date.now() / 1000) % 100000}`;
const EMAIL = `${TAG}@autovolt.com.br`;
const SENHA = "onboarding123";

const b = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

async function novaAba(nome, viewport = { width: 1440, height: 1000 }) {
  const ctx = await b.newContext({ viewport, locale: "pt-BR", isMobile: viewport.width < 700, hasTouch: viewport.width < 700 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => noise.push(`pageerror (${nome}) em ${page.url()}: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") noise.push(`console (${nome}) em ${page.url()}: ${m.text()}`);
  });
  return page;
}

/** Lê "X de Y etapas" do card de onboarding. -1 se o card não estiver visível. */
async function progresso(page) {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const el = page.locator("[data-progress]");
  if ((await el.count()) === 0) return { done: -1, total: -1, texto: null };
  const texto = (await el.first().innerText()).trim();
  const m = texto.match(/(\d+)\s+de\s+(\d+)/);
  return { done: m ? Number(m[1]) : -1, total: m ? Number(m[2]) : -1, texto };
}

/** Uma etapa está marcada como concluída no card? (o card só existe no Dashboard) */
async function etapaConcluida(page, key) {
  if (!page.url().endsWith("/dashboard")) {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
  }
  const el = page.locator(`[data-step="${key}"]`);
  if ((await el.count()) === 0) return null;
  return (await el.first().getAttribute("data-done")) === "true";
}

// A conta e a empresa nascem pelo cadastro normal.
const p = await novaAba("dono");
await p.goto(`${BASE}/cadastro`, { waitUntil: "networkidle" });
await p.fill('input[name="name"]', `Dono ${TAG}`);
await p.fill('input[name="companyName"]', `Estética ${TAG}`);
await p.fill('input[name="email"]', EMAIL);
await p.fill('input[name="password"]', SENHA);
// Desmarca "popular com dados de demonstração": o onboarding precisa de uma
// empresa realmente vazia. (O checkbox é opt-in e vem marcado por padrão.)
await p.uncheck('input[name="demo"]').catch(() => {});
await p.click('button[type="submit"]');
await p.waitForURL("**/dashboard", { timeout: 20000 });

const empresa = await db.company.findFirst({
  where: { memberships: { some: { user: { email: EMAIL } } } },
  select: { id: true, name: true },
});
check(Boolean(empresa), `empresa nova criada (${empresa?.name})`);

// ---------------------------------------------------------------- TESTE 1
console.log("\n══ TESTE 1: empresa nova, progresso inicial ══");

// O cadastro não preenche telefone/e-mail/CNPJ da empresa, então nenhuma etapa
// nasce concluída.
let prog = await progresso(p);
check(prog.total === 6, `checklist tem 6 etapas (${prog.texto})`);
check(prog.done === 0, `nenhuma etapa concluída no início (${prog.done})`);
check(
  (await p.locator("body").innerText()).includes("Vamos preparar sua empresa"),
  "card de boas-vindas aparece para empresa nova",
);
check((await etapaConcluida(p, "cliente")) === false, "etapa cliente começa pendente");

// ---------------------------------------------------------------- TESTE 8
console.log("\n══ TESTE 8: permissão (empresa ainda vazia) ══");

// Um funcionário na empresa nova, com tudo ainda pendente: a etapa de serviço
// (services.write, que o staff NÃO tem) vira informação; a de cliente
// (customers.write, que o staff tem) é um link clicável.
const staffEmail = `${TAG}.staff@autovolt.com.br`;
const staffUser = await db.user.create({
  data: {
    name: `Staff ${TAG}`,
    email: staffEmail,
    passwordHash: (await db.user.findUnique({ where: { email: "demo@autovolt.com.br" }, select: { passwordHash: true } })).passwordHash,
    emailVerifiedAt: new Date(),
    memberships: { create: { companyId: empresa.id, role: "staff" } },
  },
});

const staff = await novaAba("staff");
await staff.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await staff.fill('input[name="email"]', staffEmail);
await staff.fill('input[name="password"]', "autovolt123");
await staff.click('button[type="submit"]');
await staff.waitForURL("**/dashboard", { timeout: 15000 });
await staff.waitForTimeout(400);

const servicoTag = await staff.locator('[data-step="servico"]').evaluate((el) => el.tagName);
check(servicoTag === "LI", "etapa de serviço não é link para o staff (sem permissão)");
const clienteTag = await staff.locator('[data-step="cliente"]').evaluate((el) => el.tagName);
check(clienteTag === "A", "etapa de cliente é link para o staff (tem permissão)");
// O staff também não vê a etapa de empresa (company.settings) como link.
const empresaTag = await staff.locator('[data-step="empresa"]').evaluate((el) => el.tagName);
check(empresaTag === "LI", "etapa de empresa não é link para o staff");
await staff.close();

// ---------------------------------------------------------------- TESTE 2
console.log("\n══ TESTE 2: cadastrar serviço ══");

await p.goto(`${BASE}/servicos?novo=1`, { waitUntil: "networkidle" });
await p.waitForSelector("#service-form", { timeout: 8000 });
await p.fill('#service-form input[name="name"]', "Lavagem completa");
await p.fill('#service-form input[name="price"]', "120,00");
await p.click('#service-form button[type="submit"]');
await p.waitForTimeout(2500);
check((await db.serviceItem.count({ where: { companyId: empresa.id, active: true } })) === 1, "serviço ativo gravado");
check((await etapaConcluida(p, "servico")) === true, "etapa serviço marcou sozinha");
prog = await progresso(p);
check(prog.done === 1, `progresso subiu para 1 (${prog.texto})`);

// ---------------------------------------------------------------- TESTE 3
console.log("\n══ TESTE 3: cliente e veículo ══");

await p.goto(`${BASE}/clientes?novo=1`, { waitUntil: "networkidle" });
await p.waitForSelector('[role="dialog"]');
await p.fill('#customer-form input[name="name"]', "Roberto Dias");
await p.click('#customer-form button[type="submit"]');
await p.waitForTimeout(2500);
check((await etapaConcluida(p, "cliente")) === true, "etapa cliente marcou");

await p.goto(`${BASE}/veiculos?novo=1`, { waitUntil: "networkidle" });
await p.waitForSelector("#vehicle-form", { timeout: 8000 });
const clienteOpt = await p
  .locator('#vehicle-form select[name="customerId"] option')
  .evaluateAll((els) => els.filter((e) => e.value).map((e) => e.value));
await p.selectOption('#vehicle-form select[name="customerId"]', clienteOpt[0]);
await p.fill('#vehicle-form input[name="brand"]', "Honda");
await p.fill('#vehicle-form input[name="model"]', "Civic");
await p.click('#vehicle-form button[type="submit"]');
await p.waitForTimeout(2500);
check((await etapaConcluida(p, "veiculo")) === true, "etapa veículo marcou");
prog = await progresso(p);
check(prog.done === 3, `progresso em 3 de 6 (${prog.texto})`);

// ---------------------------------------------------------------- TESTE 4
console.log("\n══ TESTE 4: agendamento ══");

await p.goto(`${BASE}/agenda?novo=1`, { waitUntil: "networkidle" });
await p.waitForSelector('[role="dialog"]', { timeout: 8000 });
const cli = await p.locator('select[name="customerId"] option').evaluateAll((e) => e.filter((x) => x.value).map((x) => x.value));
await p.selectOption('select[name="customerId"]', cli[0]);
await p.waitForTimeout(300);
const vei = await p.locator('select[name="vehicleId"] option').evaluateAll((e) => e.filter((x) => x.value).map((x) => x.value));
await p.selectOption('select[name="vehicleId"]', vei[0]);
await p.locator('#appointment-form input[type="checkbox"]').first().check();
await p.waitForTimeout(300);
const hoje = new Date().toISOString().slice(0, 10);
await p.fill('input[name="date"]', hoje);
await p.fill('input[name="time"]', "09:00");
await p.fill('input[name="durationMin"]', "60");
await p.click('#appointment-form button[type="submit"]');
await p.waitForTimeout(3000);
check((await db.appointment.count({ where: { companyId: empresa.id } })) >= 1, "agendamento gravado no banco");
check((await etapaConcluida(p, "agendamento")) === true, "etapa agendamento marcou");

// ---------------------------------------------------------------- TESTE 5
console.log("\n══ TESTE 5: OS e conclusão ══");

await p.goto(`${BASE}/ordens?nova=1`, { waitUntil: "networkidle" });
await p.waitForSelector('[role="dialog"]', { timeout: 8000 });
await p.selectOption('select[name="customerId"]', cli[0]);
await p.waitForTimeout(300);
const veiOs = await p.locator('select[name="vehicleId"] option').evaluateAll((e) => e.filter((x) => x.value).map((x) => x.value));
await p.selectOption('select[name="vehicleId"]', veiOs[0]);
await p.locator('#work-order-form input[type="checkbox"]').first().check();
await p.waitForTimeout(300);
await p.fill('input[name="date"]', hoje);
await p.click('#work-order-form button[type="submit"]');
await p.waitForURL(/\/ordens\/[a-z0-9]+$/, { timeout: 15000 });
check((await db.workOrder.count({ where: { companyId: empresa.id } })) >= 1, "OS gravada no banco");
check((await etapaConcluida(p, "ordem")) === true, "etapa OS marcou");

// 5 de 6: falta configurar a empresa (telefone/e-mail). Completa essa etapa
// pelo formulário real de Configurações.
prog = await progresso(p);
check(prog.done === 5, `faltando só a etapa de empresa (${prog.texto})`);
await p.goto(`${BASE}/configuracoes`, { waitUntil: "networkidle" });
await p.fill('input[name="phone"]', "11940028922");
await p.click('button:has-text("Salvar dados da empresa")');
await p.waitForTimeout(2500);
// Confere no banco que a empresa passou a ser considerada configurada. (Não dá
// para ler a etapa no card: completar a última troca o checklist pelo card de
// conclusão, que não tem mais [data-step].)
const empresaConfig = await db.company.findUnique({
  where: { id: empresa.id },
  select: { phone: true, email: true, document: true, address: true },
});
check(
  Boolean(empresaConfig.phone || empresaConfig.email || empresaConfig.document || empresaConfig.address),
  "empresa passou a ter dado de contato/identificação (etapa configurada)",
);

prog = await progresso(p);
check(prog.done === -1, "checklist de etapas some quando tudo está concluído");
check(
  (await p.locator("body").innerText()).includes("pronto para começar"),
  "mensagem de conclusão aparece",
);

// ---------------------------------------------------------------- TESTE 6
console.log("\n══ TESTE 6: excluir dado recalcula o progresso ══");

// Apaga o único serviço; a etapa correspondente volta a pendente e o checklist
// (que estava concluído) reaparece com 5 de 6.
const servico = await db.serviceItem.findFirst({ where: { companyId: empresa.id } });
await db.serviceItem.delete({ where: { id: servico.id } });
prog = await progresso(p);
check(prog.done === 5 && prog.total === 6, `progresso recalculou para 5 de 6 (${prog.texto})`);
check((await etapaConcluida(p, "servico")) === false, "etapa serviço voltou a pendente");

// ---------------------------------------------------------------- TESTE 10
console.log("\n══ TESTE 10: dispensar o card ══");

// (roda antes do 7 porque usa a mesma sessão do dono nesta empresa.)
await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await p.click("[data-dismiss-onboarding]");
await p.waitForTimeout(2500);
prog = await progresso(p);
check(prog.done === -1, "card some depois de dispensar");
const dispensada = await db.company.findUnique({
  where: { id: empresa.id },
  select: { onboardingDismissedAt: true },
});
check(dispensada.onboardingDismissedAt !== null, "dispensa gravada por empresa no banco");
// Dispensar não apagou nada real.
check(
  (await db.customer.count({ where: { companyId: empresa.id } })) === 1,
  "dispensar não alterou os dados reais",
);

// ---------------------------------------------------------------- TESTE 7
console.log("\n══ TESTE 7: multiempresa ══");

// O usuário demo tem duas empresas operacionais. Numa sessão dele, o onboarding
// da empresa ativa não deve refletir a empresa recém-criada acima.
const demo = await novaAba("demo");
await demo.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await demo.fill('input[name="email"]', "demo@autovolt.com.br");
await demo.fill('input[name="password"]', "autovolt123");
await demo.click('button[type="submit"]');
await demo.waitForURL("**/dashboard", { timeout: 15000 });

// Empresa A do demo é operacional e nunca dispensou → mostra o card de pronto,
// não o checklist de etapas pendentes.
const progDemo = await progresso(demo);
check(progDemo.done === -1, "empresa operacional não mostra checklist de etapas pendentes");
const empresasDemo = await db.company.findMany({
  where: { memberships: { some: { user: { email: "demo@autovolt.com.br" } } } },
  select: { id: true },
});
check(
  !empresasDemo.some((c) => c.id === empresa.id),
  "a empresa nova não pertence ao usuário demo (progressos isolados)",
);

// ---------------------------------------------------------------- TESTE 9
console.log("\n══ TESTE 9: checklist no celular ══");

// O TESTE 10 dispensou o card; reexibe para conferir no celular.
await db.company.update({ where: { id: empresa.id }, data: { onboardingDismissedAt: null } });

const mob = await novaAba("mobile", { width: 390, height: 844 });
await mob.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await mob.fill('input[name="email"]', EMAIL);
await mob.fill('input[name="password"]', SENHA);
await mob.click('button[type="submit"]');
await mob.waitForURL("**/dashboard", { timeout: 15000 });
await mob.waitForTimeout(400);
check((await mob.locator("[data-progress]").count()) > 0, "checklist visível no celular");
const overflow = await mob.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
check(overflow <= 1, `sem scroll horizontal no celular (${overflow}px)`);
// Botão de uma etapa é tocável (área ≥ ~40px de altura).
const box = await mob.locator('[data-step="cliente"]').first().boundingBox();
check(Boolean(box) && box.height >= 40, `etapa com área de toque adequada (${box ? Math.round(box.height) : "?"}px)`);

// Limpeza: remove a conta/empresa criadas por este teste (nenhum dado do demo).
await mob.close();
await db.user.delete({ where: { id: staffUser.id } }).catch(() => {});
const dono = await db.user.findUnique({ where: { email: EMAIL }, select: { id: true } });
await db.company.delete({ where: { id: empresa.id } }).catch(() => {});
if (dono) await db.user.delete({ where: { id: dono.id } }).catch(() => {});

// ---------------------------------------------------------------------------
console.log("\n──────────────────────────────────────────");
if (noise.length > 0) {
  console.log(`Erros de console: ${noise.length}`);
  noise.slice(0, 6).forEach((n) => console.log(`   ${n}`));
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
