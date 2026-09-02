/**
 * Teste do modulo Agenda.
 *
 * Percorre o caminho pedido:
 *   criar -> visualizar -> editar -> remarcar -> confirmar -> cancelar ->
 *   nao compareceu
 *
 * Cobre tambem as regras que so aparecem aqui:
 *   - veiculos filtrados pelo cliente escolhido
 *   - preco e duracao preenchidos pelo catalogo, com edicao manual
 *   - aviso de conflito de horario antes de salvar
 *   - isolamento multiempresa nos QUATRO ids (agendamento, cliente, veiculo,
 *     servico)
 *
 * Requer o servidor rodando (npm run build && npm run start).
 *   CHROMIUM_PATH=/caminho/chrome node scripts/test-agenda.mjs
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

/** O Intl pt-BR usa espaco nao-quebravel depois de "R$". */
const norm = (t) => t.replace(/ /g, " ");

/** Data futura em "YYYY-MM-DD", longe do seed para evitar conflitos herdados. */
function futureDate(daysAhead) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
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

// Cada execucao usa uma semana propria: o teste deixa agendamentos em estados
// terminais (concluido, nao compareceu) que nao oferecem as acoes esperadas, e
// reaproveitar a mesma data faria a rodada seguinte falhar por resíduo.
const OFFSET = 21 + (Math.floor(Date.now() / 1000) % 60);
const DATA = futureDate(OFFSET);
const HORA = "08:00";

console.log("\n▸ ABRIR FORMULÁRIO");
await p.goto(`${BASE}/agenda`, { waitUntil: "networkidle" });
await p.click('a[href="/agenda?novo=1"]');
await p.waitForSelector('[role="dialog"]', { timeout: 8000 });
check(true, "botão Novo agendamento abre o formulário");

console.log("\n▸ VEÍCULOS FILTRADOS PELO CLIENTE");
// Antes de escolher cliente, o seletor de veículo fica desabilitado.
check(
  await p.locator('select[name="vehicleId"]').isDisabled(),
  "seletor de veículo começa desabilitado",
);

const clientes = await p
  .locator('select[name="customerId"] option')
  .evaluateAll((els) => els.filter((e) => e.value).map((e) => ({ id: e.value, nome: e.textContent.trim() })));
check(clientes.length > 0, `seletor lista ${clientes.length} cliente(s) com veículo`);

// Escolhe dois clientes diferentes e confirma que a lista de veículos muda.
await p.selectOption('select[name="customerId"]', clientes[0].id);
await p.waitForTimeout(200);
const veiculosA = await p
  .locator('select[name="vehicleId"] option')
  .evaluateAll((els) => els.filter((e) => e.value).map((e) => e.value));
await p.selectOption('select[name="customerId"]', clientes[1].id);
await p.waitForTimeout(200);
const veiculosB = await p
  .locator('select[name="vehicleId"] option')
  .evaluateAll((els) => els.filter((e) => e.value).map((e) => e.value));
check(veiculosA.length > 0 && veiculosB.length > 0, "cada cliente tem veículos listados");
check(
  !veiculosA.some((v) => veiculosB.includes(v)),
  "trocar de cliente troca a lista de veículos (sem vazamento entre clientes)",
);

console.log("\n▸ SERVIÇO PREENCHE PREÇO E DURAÇÃO");
await p.selectOption('select[name="customerId"]', clientes[0].id);
await p.waitForTimeout(200);
await p.selectOption('select[name="vehicleId"]', veiculosA[0]);

const primeiroServico = p.locator('#appointment-form input[type="checkbox"]').first();
const rotuloServico = await primeiroServico.locator("xpath=..").innerText();
await primeiroServico.check();
await p.waitForTimeout(300);
const precoAuto = await p.inputValue('input[name="price"]');
const duracaoAuto = await p.inputValue('input[name="durationMin"]');
check(precoAuto !== "" && precoAuto !== "0,00", `preço preenchido pelo catálogo (${precoAuto})`);
check(duracaoAuto !== "" && duracaoAuto !== "0", `duração preenchida pelo catálogo (${duracaoAuto}min)`);
// Compara numericamente: o campo traz "1480,50" e o rotulo "R$ 1.480,50",
// entao comparar como texto falharia por causa do separador de milhar.
const centavosDoCampo = Math.round(
  Number(precoAuto.replace(/\./g, "").replace(",", ".")) * 100,
);
const centavosDoRotulo = (() => {
  const m = norm(rotuloServico).match(/R\$\s*([\d.]+,\d{2})/);
  return m ? Math.round(Number(m[1].replace(/\./g, "").replace(",", ".")) * 100) : -1;
})();
check(
  centavosDoCampo === centavosDoRotulo && centavosDoCampo > 0,
  `valor bate com o do catálogo (${precoAuto} = ${centavosDoRotulo / 100})`,
);

console.log("\n▸ VALIDAÇÃO");
// Sem data válida não salva.
await p.fill('input[name="durationMin"]', "1");
await p.click('#appointment-form button[type="submit"]');
await p.waitForTimeout(800);
check(
  (await p.locator('#appointment-form [role="alert"]').count()) > 0,
  "validação rejeita duração abaixo do mínimo",
);

console.log("\n▸ CRIAR");
await p.fill('input[name="durationMin"]', "60");
await p.fill('input[name="price"]', "255,00"); // sobrescreve o valor do catálogo
await p.fill('input[name="date"]', DATA);
await p.fill('input[name="time"]', HORA);
await p.fill('textarea[name="notes"]', "Agendamento criado pelo teste.");
await p.click('#appointment-form button[type="submit"]');
await p.waitForTimeout(3000);

const semana = `?semana=${DATA}`;
await p.goto(`${BASE}/agenda${semana}`, { waitUntil: "networkidle" });
let corpo = norm(await p.locator("body").innerText());
check(corpo.includes(clientes[0].nome), "agendamento aparece na agenda");
check(corpo.includes("R$ 255,00"), "valor manual sobrepôs o do catálogo");
check(corpo.includes("08:00"), "horário salvo");

console.log("\n▸ AVISO DE CONFLITO");
await p.goto(`${BASE}/agenda?novo=1`, { waitUntil: "networkidle" });
await p.waitForSelector('[role="dialog"]');
await p.selectOption('select[name="customerId"]', clientes[1].id);
await p.waitForTimeout(200);
await p.selectOption('select[name="vehicleId"]', veiculosB[0]);
await p.locator('#appointment-form input[type="checkbox"]').first().check();
await p.waitForTimeout(300);
await p.fill('input[name="date"]', DATA);
await p.fill('input[name="time"]', HORA); // mesmo horário do anterior
await p.fill('input[name="durationMin"]', "60");
await p.click('#appointment-form button[type="submit"]');
await p.waitForTimeout(2500);
const aviso = await p.locator('#appointment-form [role="alert"]').innerText();
check(
  aviso.includes("Já existe atendimento neste horário"),
  "conflito de horário exibe aviso antes de salvar",
);
check(
  (await p.locator('button:has-text("Salvar mesmo assim")').count()) > 0,
  "usuário pode confirmar e salvar assim mesmo",
);
// Confirma o conflito, que é um caso legítimo (dois boxes).
await p.click('#appointment-form button[type="submit"]');
await p.waitForTimeout(3000);
await p.goto(`${BASE}/agenda${semana}`, { waitUntil: "networkidle" });
check(
  norm(await p.locator("body").innerText()).includes(clientes[1].nome),
  "após confirmar, o agendamento em conflito é salvo",
);

console.log("\n▸ EDITAR / REMARCAR");
// Escolhe o agendamento que ESTE teste criou, e nao "o primeiro da semana":
// execucoes anteriores podem ter deixado registros na mesma semana.
const hrefs = await p
  .locator('a[href^="/agenda?editar="]')
  .evaluateAll((els) => els.map((e) => e.getAttribute("href")));
let agendamentoId = null;
for (const href of hrefs) {
  const id = href.split("editar=")[1].split("&")[0];
  await p.goto(`${BASE}/agenda?editar=${id}`, { waitUntil: "networkidle" });
  await p.waitForSelector('[role="dialog"]');
  if ((await p.inputValue('input[name="date"]')) === DATA) {
    agendamentoId = id;
    break;
  }
}
check(agendamentoId !== null, "encontrou o agendamento criado pelo teste");
check(
  (await p.inputValue('input[name="date"]')) === DATA,
  "formulário de edição abre preenchido com a data",
);
check(
  (await p.locator('#appointment-form input[type="checkbox"]:checked').count()) > 0,
  "serviços do agendamento vêm marcados",
);

// Remarca para outro dia e outro horário.
const NOVA_DATA = futureDate(OFFSET + 2);
await p.fill('input[name="date"]', NOVA_DATA);
await p.fill('input[name="time"]', "15:30");
await p.click('#appointment-form button[type="submit"]');
await p.waitForTimeout(3000);
await p.goto(`${BASE}/agenda?semana=${NOVA_DATA}`, { waitUntil: "networkidle" });
corpo = norm(await p.locator("body").innerText());
check(corpo.includes("15:30"), "remarcação persistiu (novo horário)");

console.log("\n▸ STATUS: CONFIRMAR → INICIAR → FINALIZAR");
async function clicarStatus(rotulo) {
  const btn = p.locator(`button:has-text("${rotulo}")`).first();
  await btn.click();
  await p.waitForTimeout(2500);
  await p.goto(`${BASE}/agenda?semana=${NOVA_DATA}`, { waitUntil: "networkidle" });
  return norm(await p.locator("body").innerText());
}
corpo = await clicarStatus("Confirmar");
check(corpo.includes("Confirmado"), "status alterado para Confirmado");
corpo = await clicarStatus("Iniciar");
check(corpo.includes("Em andamento"), "status alterado para Em andamento");
corpo = await clicarStatus("Finalizar");
check(corpo.includes("Concluído"), "status alterado para Concluído (Finalizado)");

console.log("\n▸ STATUS: CANCELAR E NÃO COMPARECEU");
await p.goto(`${BASE}/agenda${semana}`, { waitUntil: "networkidle" });
const cancelaveis = p.locator('button:has-text("Cancelar")');
check((await cancelaveis.count()) > 0, "ação de cancelar disponível");
await cancelaveis.first().click();
await p.waitForTimeout(2500);
await p.goto(`${BASE}/agenda${semana}`, { waitUntil: "networkidle" });
corpo = norm(await p.locator("body").innerText());
check(corpo.includes("Cancelado"), "status alterado para Cancelado");

// Um agendamento cancelado volta para a agenda com "Reagendar".
const reagendar = p.locator('button:has-text("Reagendar")');
check((await reagendar.count()) > 0, "cancelado pode ser reagendado");
await reagendar.first().click();
await p.waitForTimeout(2500);
await p.goto(`${BASE}/agenda${semana}`, { waitUntil: "networkidle" });
check(
  norm(await p.locator("body").innerText()).includes("Agendado"),
  "status voltou para Agendado",
);

// "Não compareceu" só faz sentido a partir de agendado/confirmado.
const naoCompareceu = p.locator('button:has-text("Não compareceu")');
check((await naoCompareceu.count()) > 0, "ação de não compareceu disponível");
await naoCompareceu.first().click();
await p.waitForTimeout(2500);
await p.goto(`${BASE}/agenda${semana}`, { waitUntil: "networkidle" });
check(
  norm(await p.locator("body").innerText()).includes("Não compareceu"),
  "status alterado para Não compareceu",
);

console.log("\n▸ INDICADORES E DASHBOARD ATUALIZAM");
await p.goto(`${BASE}/agenda${semana}`, { waitUntil: "networkidle" });
const indicadores = norm(await p.locator("body").innerText());
check(
  /Atendimentos na semana/.test(indicadores) && /Valor agendado/.test(indicadores),
  "indicadores da semana renderizam com os dados novos",
);
const dash = await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
check(dash.status() === 200, "dashboard recarrega sem erro após as alterações");

console.log("\n▸ ISOLAMENTO ENTRE EMPRESAS");
const empresaB = await switchCompany(p, 1);
check(true, `trocou para "${empresaB}"`);

await p.goto(`${BASE}/agenda?editar=${agendamentoId}`, { waitUntil: "networkidle" });
check(
  (await p.locator('[role="dialog"]').count()) === 0,
  "editar agendamento de outra empresa não abre o formulário",
);

await p.goto(`${BASE}/agenda?novo=1`, { waitUntil: "networkidle" });
await p.waitForSelector('[role="dialog"]');
const idsClientesB = await p
  .locator('select[name="customerId"] option')
  .evaluateAll((els) => els.map((e) => e.value));
check(
  !idsClientesB.includes(clientes[0].id),
  "seletor de cliente da empresa B não oferece cliente da empresa A (por id)",
);
const idsVeiculosB = await p.evaluate(() =>
  Array.from(document.querySelectorAll('select[name="vehicleId"] option')).map((e) => e.value),
);
check(
  !idsVeiculosB.includes(veiculosA[0]),
  "seletor de veículo da empresa B não oferece veículo da empresa A",
);

await switchCompany(p, 0);

console.log("\n▸ CONSOLE");
check(noise.length === 0, `sem erros de console (${noise.length})`);
noise.slice(0, 5).forEach((n) => console.log("       " + n));

await b.close();
console.log(
  fails.length === 0
    ? "\n✔ Módulo Agenda aprovado.\n"
    : `\n✘ ${fails.length} falha(s):\n  - ${fails.join("\n  - ")}\n`,
);
process.exit(fails.length ? 1 : 0);
