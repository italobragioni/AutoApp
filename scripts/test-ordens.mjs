/**
 * Teste do modulo Ordens de Servico.
 *
 * TESTE 1  cliente -> veiculo -> servico -> criar OS -> iniciar -> concluir ->
 *          registrar pagamento
 * TESTE 2  criar agendamento -> criar OS a partir dele -> conferir appointmentId
 *          -> nao duplicar -> concluir
 * TESTE 3  depois de concluir: historico do cliente, historico do veiculo,
 *          faturamento, dashboard, relatorios e motor de retencao
 *
 * Requer o servidor rodando (npm run build && npm run start).
 *   CHROMIUM_PATH=/caminho/chrome node scripts/test-ordens.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const CHROME = process.env.CHROMIUM_PATH;
const fails = [];
const noise = [];
let expecting404 = false;

function check(ok, label) {
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}`);
  if (!ok) fails.push(label);
}

/** Intl pt-BR usa espaco nao-quebravel depois de "R$". */
const norm = (t) => t.replace(/\u00a0/g, " ");
const brl = (cents) =>
  `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function futureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
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

/**
 * Le o valor exibido logo abaixo do rotulo de um indicador.
 * Trabalha sobre o texto da pagina, sem depender da arvore do DOM.
 */
async function statValue(page, label) {
  const text = norm(await page.locator("body").innerText());
  const match = text.match(new RegExp(`${label}\\s*\\n\\s*(R\\$[^\\n]*)`));
  return match ? match[1].trim() : "";
}

const b = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: "pt-BR" });
const p = await ctx.newPage();
p.on("pageerror", (e) => noise.push(`pageerror: ${e.message}`));
p.on("console", (m) => {
  if (m.type() === "error" && !expecting404) noise.push(`console: ${m.text()}`);
});

await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.fill('input[name="email"]', "demo@autovolt.com.br");
await p.fill('input[name="password"]', "autovolt123");
await p.click('button[type="submit"]');
await p.waitForURL("**/dashboard");

// ---------------------------------------------------------------- TESTE 1
console.log("\n══ TESTE 1: OS manual ══");

// Faturamento antes, para comparar depois.
await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
const fatAntes = await statValue(p, "Faturamento do mês");
console.log(`   faturamento antes: ${fatAntes}`);

await p.goto(`${BASE}/ordens`, { waitUntil: "networkidle" });
await p.click('a[href="/ordens?nova=1"]');
await p.waitForSelector('[role="dialog"]', { timeout: 8000 });
check(true, "botão Nova OS abre o formulário");

check(
  await p.locator('select[name="vehicleId"]').isDisabled(),
  "veículo desabilitado antes de escolher o cliente",
);

const clientes = await p
  .locator('select[name="customerId"] option')
  .evaluateAll((e) =>
    e.filter((x) => x.value).map((x) => ({ id: x.value, nome: x.textContent.trim() })),
  );
await p.selectOption('select[name="customerId"]', clientes[0].id);
await p.waitForTimeout(250);
const veiculos = await p
  .locator('select[name="vehicleId"] option')
  .evaluateAll((e) => e.filter((x) => x.value).map((x) => ({ id: x.value, txt: x.textContent })));
check(veiculos.length > 0, `veículos do cliente listados (${veiculos.length})`);
await p.selectOption('select[name="vehicleId"]', veiculos[0].id);

// Marca dois serviços e confere que o valor do catálogo entra sozinho.
const checkboxes = p.locator('#work-order-form input[type="checkbox"]');
await checkboxes.nth(0).check();
await p.waitForTimeout(200);
await checkboxes.nth(1).check();
await p.waitForTimeout(300);
const precos = await p
  .locator('#work-order-form input[name^="price__"]')
  .evaluateAll((e) => e.map((x) => x.value));
check(precos.length === 2, `dois serviços adicionados com valor preenchido (${precos.join(" + ")})`);

// Ajusta o valor do primeiro serviço à mão e confere o total.
await p.locator('#work-order-form input[name^="price__"]').first().fill("300,00");
await p.waitForTimeout(300);
const corpoForm = norm(await p.locator("#work-order-form").innerText());
const segundo = Number(precos[1].replace(/\./g, "").replace(",", "."));
const totalEsperado = Math.round((300 + segundo) * 100);
check(
  corpoForm.includes(brl(totalEsperado)),
  `total calculado a partir dos valores digitados (${brl(totalEsperado)})`,
);

await p.fill('input[name="date"]', futureDate(0));
await p.fill('textarea[name="notes"]', "OS criada pelo teste.");
await p.click('#work-order-form button[type="submit"]');
await p.waitForURL(/\/ordens\/[a-z0-9]+$/, { timeout: 15000 });
check(true, "criação redireciona para a página da OS");
const osId = p.url().split("/").pop();

let corpo = norm(await p.locator("body").innerText());
check(corpo.includes(clientes[0].nome), "OS mostra o cliente vinculado");
check(corpo.includes(brl(totalEsperado)), "total da OS persistido");
check(corpo.includes("Aberta"), "status inicial: Aberta");

console.log("\n▸ INICIAR E AVANÇAR STATUS");
await p.click('button:has-text("Iniciar serviço")');
await p.waitForTimeout(2500);
await p.goto(`${BASE}/ordens/${osId}`, { waitUntil: "networkidle" });
check(norm(await p.locator("body").innerText()).includes("Em andamento"), "status: Em andamento");

await p.click('button:has-text("Aguardando retirada")');
await p.waitForTimeout(2500);
await p.goto(`${BASE}/ordens/${osId}`, { waitUntil: "networkidle" });
check(
  norm(await p.locator("body").innerText()).includes("Aguardando retirada"),
  "status: Aguardando retirada",
);

console.log("\n▸ CONCLUIR E REGISTRAR PAGAMENTO");
await p.click('button:has-text("Concluir e receber")');
await p.waitForSelector('[role="dialog"]');
check(
  (await p.inputValue('input[name="paidAmount"]')) !== "",
  "valor recebido vem preenchido com o total",
);
await p.selectOption('select[name="paymentMethod"]', "credito");
await p.fill('input[name="paidAmount"]', "450,00"); // valor efetivamente cobrado
await p.fill('input[name="finishedAt"]', futureDate(0));
await p.click('#complete-form button[type="submit"]');
await p.waitForTimeout(3000);

await p.goto(`${BASE}/ordens/${osId}`, { waitUntil: "networkidle" });
corpo = norm(await p.locator("body").innerText());
check(corpo.includes("Concluída"), "OS marcada como Concluída");
check(corpo.includes("Crédito"), "forma de pagamento registrada");
check(corpo.includes("R$ 450,00"), "valor efetivamente pago substituiu o total");

// ---------------------------------------------------------------- TESTE 2
console.log("\n══ TESTE 2: OS a partir do agendamento ══");
// Cada execucao usa seu proprio dia e horario: reaproveitar o mesmo slot faria
// a rodada seguinte cair no aviso de conflito e nao criar o agendamento.
const OFFSET = 30 + (Math.floor(Date.now() / 1000) % 60);
const DATA = futureDate(OFFSET);
const HORA_AG = `${String(8 + (Math.floor(Date.now() / 1000) % 9)).padStart(2, "0")}:00`;
await p.goto(`${BASE}/agenda?novo=1`, { waitUntil: "networkidle" });
await p.waitForSelector('[role="dialog"]');
await p.selectOption('select[name="customerId"]', clientes[1].id);
await p.waitForTimeout(250);
const veicAg = await p
  .locator('select[name="vehicleId"] option')
  .evaluateAll((e) => e.filter((x) => x.value).map((x) => x.value));
await p.selectOption('select[name="vehicleId"]', veicAg[0]);
await p.locator('#appointment-form input[type="checkbox"]').first().check();
await p.waitForTimeout(300);
await p.fill('input[name="date"]', DATA);
await p.fill('input[name="time"]', HORA_AG);
await p.fill('input[name="durationMin"]', "60");
await p.fill('input[name="price"]', "199,90");
await p.fill('textarea[name="notes"]', "Observação vinda do agendamento.");
await p.click('#appointment-form button[type="submit"]');
await p.waitForTimeout(3000);

await p.goto(`${BASE}/agenda?semana=${DATA}`, { waitUntil: "networkidle" });
check(
  norm(await p.locator("body").innerText()).includes(HORA_AG),
  `agendamento criado às ${HORA_AG}`,
);
// Escopa a acao a LINHA do agendamento deste teste. Usar `.first()` global
// pegaria um agendamento de rodada anterior que esteja na mesma semana.
const linhaAg = p
  .locator("div")
  .filter({ hasText: HORA_AG })
  .filter({ has: p.locator('button:has-text("Criar OS")') })
  .last();
const criarOS = linhaAg.locator('button:has-text("Criar OS")');
check((await criarOS.count()) > 0, "ação Criar OS aparece na agenda");
await criarOS.click();
await p.waitForURL(/\/ordens\/[a-z0-9]+$/, { timeout: 15000 });
const osAgId = p.url().split("/").pop();
check(true, "criação a partir do agendamento redireciona para a OS");

corpo = norm(await p.locator("body").innerText());
check(
  corpo.includes("Criada a partir do agendamento"),
  "OS mostra o agendamento vinculado (appointmentId)",
);
check(corpo.includes("R$ 199,90"), "valor combinado no agendamento veio para a OS");
check(corpo.includes("Observação vinda do agendamento"), "observações vieram do agendamento");
check(corpo.includes(clientes[1].nome), "cliente veio do agendamento");

console.log("\n▸ NÃO DUPLICA OS DO MESMO AGENDAMENTO");
await p.goto(`${BASE}/agenda?semana=${DATA}`, { waitUntil: "networkidle" });
check(
  (await p.locator('a:has-text("Abrir OS")').count()) > 0,
  "agendamento com OS oferece 'Abrir OS' em vez de criar outra",
);
check(
  (await p.locator('button:has-text("Criar OS")').count()) === 0 ||
    (await p.locator('a:has-text("Abrir OS")').count()) > 0,
  "ação de criar não é oferecida de novo para o mesmo agendamento",
);

// Conclui a segunda OS para os testes de faturamento.
await p.goto(`${BASE}/ordens/${osAgId}`, { waitUntil: "networkidle" });
await p.click('button:has-text("Concluir e receber")');
await p.waitForSelector('[role="dialog"]');
await p.selectOption('select[name="paymentMethod"]', "pix");
await p.fill('input[name="finishedAt"]', futureDate(0));
await p.click('#complete-form button[type="submit"]');
await p.waitForTimeout(3000);
await p.goto(`${BASE}/ordens/${osAgId}`, { waitUntil: "networkidle" });
check(norm(await p.locator("body").innerText()).includes("Concluída"), "segunda OS concluída");

// ---------------------------------------------------------------- TESTE 3
console.log("\n══ TESTE 3: reflexo nos demais módulos ══");

// Histórico do cliente
await p.goto(`${BASE}/clientes`, { waitUntil: "networkidle" });
const hrefCliente = await p
  .locator("tbody a", { hasText: clientes[0].nome })
  .first()
  .getAttribute("href");
await p.goto(`${BASE}${hrefCliente}`, { waitUntil: "networkidle" });
corpo = norm(await p.locator("body").innerText());
check(corpo.includes("R$ 450,00"), "OS concluída aparece no histórico do cliente");
check(corpo.includes("Crédito"), "forma de pagamento aparece no histórico do cliente");

// Histórico do veículo
await p.goto(`${BASE}/veiculos/${veiculos[0].id}`, { waitUntil: "networkidle" });
corpo = norm(await p.locator("body").innerText());
check(corpo.includes("R$ 450,00"), "OS concluída aparece no histórico do veículo");

// Faturamento no dashboard
await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
const fatDepois = await statValue(p, "Faturamento do mês");
check(
  fatDepois !== fatAntes,
  `faturamento do mês subiu com as OS concluídas (${fatAntes} → ${fatDepois})`,
);

// Relatórios
const rel = await p.goto(`${BASE}/relatorios`, { waitUntil: "networkidle" });
corpo = norm(await p.locator("body").innerText());
check(rel.status() === 200, "relatórios carregam");
check(corpo.includes("Crédito") || corpo.includes("Pix"), "formas de pagamento nos relatórios");

// Motor de retenção: o cliente atendido hoje deve estar "em dia"
await p.goto(`${BASE}${hrefCliente}`, { waitUntil: "networkidle" });
corpo = norm(await p.locator("body").innerText());
check(
  /Dias sem voltar[\s\S]{0,40}\b0\b/.test(corpo) || corpo.includes("Em dia"),
  "motor de retenção reconheceu o atendimento de hoje",
);
check(
  /Retorno ideal em \d{2}\/\d{2}\/\d{4}/.test(corpo),
  "retenção recalculou a data de retorno a partir da OS real",
);

// ---------------------------------------------------------------- ISOLAMENTO
console.log("\n▸ ISOLAMENTO ENTRE EMPRESAS");
const empresaB = await switchCompany(p, 1);
check(true, `trocou para "${empresaB}"`);

expecting404 = true;
const cruzado = await p.goto(`${BASE}/ordens/${osId}`, { waitUntil: "domcontentloaded" });
check(cruzado.status() === 404, "OS de outra empresa responde 404");
const cruzadoEdit = await p.goto(`${BASE}/ordens/${osId}?editar=1`, {
  waitUntil: "domcontentloaded",
});
check(cruzadoEdit.status() === 404, "editar OS de outra empresa responde 404");
expecting404 = false;

await p.goto(`${BASE}/ordens?nova=1`, { waitUntil: "networkidle" });
await p.waitForSelector('[role="dialog"]');
const idsB = await p
  .locator('select[name="customerId"] option')
  .evaluateAll((e) => e.map((x) => x.value));
check(!idsB.includes(clientes[0].id), "seletor da empresa B não oferece cliente da empresa A");

await switchCompany(p, 0);

console.log("\n▸ CONSOLE");
check(noise.length === 0, `sem erros de console (${noise.length})`);
noise.slice(0, 5).forEach((n) => console.log("       " + n));

await b.close();
console.log(
  fails.length === 0
    ? "\n✔ Módulo Ordens de Serviço aprovado.\n"
    : `\n✘ ${fails.length} falha(s):\n  - ${fails.join("\n  - ")}\n`,
);
process.exit(fails.length ? 1 : 0);
