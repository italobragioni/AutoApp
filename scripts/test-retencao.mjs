/**
 * Teste do registro de contato da Retencao.
 *
 * TESTE 1  cliente "Em risco" aparece na fila de prioridade
 * TESTE 2  registrar contato -> gravado no banco -> data aparece na interface
 * TESTE 3  cliente continua "Em risco", mas sai da prioridade no cooldown
 * TESTE 4  passado o cooldown, volta a aparecer (sem ter retornado)
 * TESTE 5  cliente conclui uma nova OS -> motor de retencao recalcula normalmente
 * TESTE 6  cliente de outra empresa: registro bloqueado no servidor
 *
 * O TESTE 4 simula a passagem do tempo movendo `contactedAt` para tras no
 * banco — o mesmo efeito de esperar o cooldown terminar.
 *
 * Requer o servidor rodando (npm run build && npm run start) e DATABASE_URL
 * apontando para o mesmo banco:
 *   CHROMIUM_PATH=/caminho/chrome node scripts/test-retencao.mjs
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

/** O Intl pt-BR usa espaco nao-quebravel depois de "R$". */
const norm = (t) => t.replace(/\u00a0/g, " ");

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Ids dos clientes listados na tabela da aba atual. Compara por id, nao por nome. */
async function rowIds(page) {
  return page
    .locator('tbody tr a[href^="/clientes/"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute("href").split("/").pop()));
}

async function openTab(page, tab) {
  await page.goto(`${BASE}/retencao?aba=${tab}`, { waitUntil: "networkidle" });
}

/** Linha de um cliente na tabela da aba atual. */
function rowOf(page, customerId) {
  return page.locator(`tbody tr:has(a[href="/clientes/${customerId}"])`);
}

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

const b = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: "pt-BR" });
const p = await ctx.newPage();
p.on("pageerror", (e) => noise.push(`pageerror: ${e.message}`));
p.on("console", (m) => {
  if (m.type() === "error") noise.push(`console: ${m.text()}`);
});

await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.click('button[type="submit"]');
await p.waitForURL("**/dashboard");

// ---------------------------------------------------------------- TESTE 1
console.log("\n══ TESTE 1: cliente em risco na fila de prioridade ══");

await openTab(p, "em_risco");
const emRisco = await rowIds(p);
check(emRisco.length > 0, `${emRisco.length} cliente(s) em risco na carteira`);

// Escolhe um que tenha veiculo: o TESTE 5 vai abrir uma OS para ele.
let alvo = null;
for (const id of emRisco) {
  const veiculo = (await rowOf(p, id).locator("td").nth(1).innerText()).trim();
  if (veiculo && veiculo !== "—") {
    alvo = id;
    break;
  }
}
check(Boolean(alvo), "cliente em risco com veículo escolhido para o teste");
if (!alvo) {
  console.error("Sem cliente em risco com veículo — o seed precisa ser recarregado.");
  process.exit(1);
}

const cliente = await db.customer.findUnique({
  where: { id: alvo },
  select: { id: true, name: true, companyId: true },
});
console.log(`   alvo: ${cliente.name} (${alvo})`);

// Nenhum contato anterior — o cooldown comeca zerado.
await db.contactLog.deleteMany({ where: { customerId: alvo } });

await openTab(p, "prioridade");
check((await rowIds(p)).includes(alvo), "cliente em risco aparece na prioridade de contato");
check(
  norm(await rowOf(p, alvo).innerText()).includes("Nenhum contato registrado"),
  "linha mostra que ainda não houve contato",
);
check(
  norm(await rowOf(p, alvo).innerText()).includes("Em risco"),
  "situação exibida na fila: Em risco",
);

// ---------------------------------------------------------------- TESTE 2
console.log("\n══ TESTE 2: registrar contato ══");

await rowOf(p, alvo).locator('button:has-text("Registrar")').click();
await p.waitForSelector('[role="dialog"]', { timeout: 8000 });
check(true, "botão Registrar abre o formulário");

const dataPreenchida = await p.inputValue('input[name="contactedAt"]');
check(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dataPreenchida), `data e hora já preenchidas (${dataPreenchida})`);

// Validacao: contato no futuro nao entra.
const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
await p.fill('input[name="contactedAt"]', amanha);
await p.click('#contact-form button[type="submit"]');
await p.waitForTimeout(1200);
check(
  (await p.locator('#contact-form [role="alert"]').count()) > 0,
  "validação recusa contato com data no futuro",
);

await p.fill('input[name="contactedAt"]', dataPreenchida);
await p.selectOption('select[name="channel"]', "ligacao");
await p.selectOption('select[name="outcome"]', "sem_resposta");
await p.fill('textarea[name="notes"]', "Ligação registrada pelo teste.");
await p.click('#contact-form button[type="submit"]');
await p.waitForTimeout(3000);

const registro = await db.contactLog.findFirst({
  where: { customerId: alvo },
  orderBy: { createdAt: "desc" },
  include: { user: { select: { name: true } } },
});
check(Boolean(registro), "contato gravado no banco");
check(registro?.companyId === cliente.companyId, "vinculado à empresa correta");
check(registro?.customerId === alvo, "vinculado ao cliente correto");
check(Boolean(registro?.userId), `vinculado ao usuário que registrou (${registro?.user?.name})`);
check(registro?.channel === "ligacao", "tipo de contato salvo: ligação");
check(registro?.outcome === "sem_resposta", "status do contato salvo: sem resposta");
check(registro?.notes === "Ligação registrada pelo teste.", "observação salva");

// A data precisa aparecer na interface — o cliente saiu da prioridade e foi
// para a aba de espera.
await openTab(p, "cooldown");
const linhaCooldown = norm(await rowOf(p, alvo).innerText());
const dataFormatada = new Date(registro.contactedAt).toLocaleDateString("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
check(linhaCooldown.includes(dataFormatada), `data do contato exibida na interface (${dataFormatada})`);
check(linhaCooldown.includes("Sem resposta"), "resultado do contato exibido");
check(linhaCooldown.includes("Ligação"), "tipo do contato exibido");
check(linhaCooldown.includes("Aguardando"), "linha indica período de espera");

// ---------------------------------------------------------------- TESTE 3
console.log("\n══ TESTE 3: continua em risco, fora da prioridade ══");

const empresa = await db.company.findUnique({
  where: { id: cliente.companyId },
  select: { contactCooldownDays: true },
});
check(empresa.contactCooldownDays > 0, `cooldown da empresa: ${empresa.contactCooldownDays} dias`);

await openTab(p, "em_risco");
check(
  (await rowIds(p)).includes(alvo),
  "cliente continua na aba Em risco (estágio não mudou)",
);
check(
  norm(await rowOf(p, alvo).innerText()).includes("Em risco"),
  "badge continua Em risco depois do contato",
);

await openTab(p, "prioridade");
check(!(await rowIds(p)).includes(alvo), "saiu da fila de prioridade durante o cooldown");

// A proxima data recomendada precisa estar visivel.
await openTab(p, "cooldown");
const proxima = new Date(registro.contactedAt);
proxima.setDate(proxima.getDate() + empresa.contactCooldownDays);
const proximaCurta = proxima.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
check(
  norm(await rowOf(p, alvo).innerText()).includes(proximaCurta),
  `próxima data recomendada de contato exibida (${proximaCurta})`,
);

// Dashboard: o cliente sai do card de prioridade, sem mexer em nada financeiro.
await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
const cardContatar = p.locator('section:has-text("Contatar hoje"), div:has-text("Contatar hoje")').last();
check(
  !(await cardContatar.locator(`a[href="/clientes/${alvo}"]`).count()),
  "Dashboard: cliente sai do card Contatar hoje durante o cooldown",
);

// ---------------------------------------------------------------- TESTE 4
console.log("\n══ TESTE 4: passado o cooldown, volta para a fila ══");

// Simula o tempo passando: o contato vira mais antigo que o cooldown.
const atrasado = new Date(registro.contactedAt);
atrasado.setDate(atrasado.getDate() - (empresa.contactCooldownDays + 1));
await db.contactLog.update({ where: { id: registro.id }, data: { contactedAt: atrasado } });

await openTab(p, "prioridade");
check((await rowIds(p)).includes(alvo), "cliente volta à prioridade depois do cooldown");
check(
  !norm(await rowOf(p, alvo).innerText()).includes("Aguardando"),
  "linha não indica mais período de espera",
);
check(
  norm(await rowOf(p, alvo).innerText()).includes("Sem resposta"),
  "histórico do contato anterior continua visível",
);

await openTab(p, "cooldown");
check(!(await rowIds(p)).includes(alvo), "saiu da aba Aguardando retorno");

// ---------------------------------------------------------------- TESTE 5
console.log("\n══ TESTE 5: cliente volta e conclui uma OS ══");

await p.goto(`${BASE}/ordens?nova=1`, { waitUntil: "networkidle" });
await p.waitForSelector('[role="dialog"]', { timeout: 8000 });
await p.selectOption('select[name="customerId"]', alvo);
await p.waitForTimeout(300);
const veiculos = await p
  .locator('select[name="vehicleId"] option')
  .evaluateAll((els) => els.filter((e) => e.value).map((e) => e.value));
check(veiculos.length > 0, "veículos do cliente listados na OS");
await p.selectOption('select[name="vehicleId"]', veiculos[0]);
await p.locator('#work-order-form input[type="checkbox"]').first().check();
await p.waitForTimeout(300);
await p.fill('input[name="date"]', today());
await p.fill('textarea[name="notes"]', "Retorno do cliente, registrado pelo teste.");
await p.click('#work-order-form button[type="submit"]');
await p.waitForURL(/\/ordens\/[a-z0-9]+$/, { timeout: 15000 });
const osId = p.url().split("/").pop();
check(true, `OS criada para o cliente (${osId})`);

await p.click('button:has-text("Concluir e receber")');
await p.waitForSelector('[role="dialog"]');
await p.selectOption('select[name="paymentMethod"]', "pix");
await p.fill('input[name="finishedAt"]', today());
await p.click('#complete-form button[type="submit"]');
await p.waitForTimeout(3000);

const os = await db.workOrder.findUnique({
  where: { id: osId },
  select: { status: true, finishedAt: true, customerId: true },
});
check(os?.status === "concluida" && Boolean(os.finishedAt), "OS concluída com data de conclusão");

await openTab(p, "em_dia");
check(
  (await rowIds(p)).includes(alvo),
  "motor de retenção recalcula: cliente passa para Em dia",
);
await openTab(p, "em_risco");
check(!(await rowIds(p)).includes(alvo), "cliente não está mais em risco");
await openTab(p, "prioridade");
check(!(await rowIds(p)).includes(alvo), "cliente sai da fila porque voltou, não por cooldown");

const historico = await db.contactLog.count({ where: { customerId: alvo } });
check(historico === 1, "histórico de contato preservado depois do retorno");

// ---------------------------------------------------------------- TESTE 6
console.log("\n══ TESTE 6: isolamento multiempresa ══");

const outra = await switchCompany(p, 1);
console.log(`   empresa ativa: ${outra}`);

// Acha uma linha qualquer na empresa B para abrir o formulario.
let alvoB = null;
for (const aba of ["prioridade", "em_risco", "em_dia", "atencao", "inativo", "novo"]) {
  await openTab(p, aba);
  const ids = await rowIds(p);
  if (ids.length > 0) {
    alvoB = ids[0];
    break;
  }
}
check(Boolean(alvoB), "empresa B tem clientes na retenção");

const clienteB = await db.customer.findUnique({
  where: { id: alvoB },
  select: { companyId: true },
});
check(clienteB.companyId !== cliente.companyId, "as duas empresas são diferentes");

await rowOf(p, alvoB).locator('button:has-text("Registrar")').click();
await p.waitForSelector('[role="dialog"]');

// Troca o id no formulario pelo cliente da empresa A: o servidor precisa
// recusar, mesmo o id sendo real.
//
// A injecao vem por ultimo de proposito. Qualquer interacao depois dela
// (trocar um select, digitar) faz o React repintar o campo escondido e desfaz
// a troca — foi o que aconteceu na primeira versao deste teste, que por isso
// gravava um contato legitimo e nao testava nada.
await p.selectOption('select[name="channel"]', "whatsapp");
await p.evaluate((id) => {
  document.querySelector('#contact-form input[name="customerId"]').value = id;
}, alvo);
check(
  (await p.inputValue('#contact-form input[name="customerId"]')) === alvo,
  "formulário da empresa B enviando o id de um cliente da empresa A",
);
await p.click('#contact-form button[type="submit"]');
await p.waitForTimeout(2500);

const erro = await p.locator('#contact-form [role="alert"]').first().innerText();
check(
  erro.includes("Cliente não encontrado nesta empresa"),
  `servidor recusa cliente de outra empresa ("${erro.trim()}")`,
);

const vazado = await db.contactLog.count({
  where: { customerId: alvo, companyId: clienteB.companyId },
});
check(vazado === 0, "nenhum registro cruzado foi gravado");
const totalAlvo = await db.contactLog.count({ where: { customerId: alvo } });
check(totalAlvo === 1, "cliente da empresa A não ganhou contato novo");

// Limpeza: o teste nao deixa registros para tras, para poder rodar de novo.
await db.contactLog.deleteMany({ where: { customerId: { in: [alvo, alvoB] } } });

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
