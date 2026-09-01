/**
 * Teste do fluxo de escrita do modulo Veiculos.
 *
 * Percorre exatamente o caminho pedido:
 *   cliente -> criar veiculo -> vincular -> editar -> excluir
 *
 * Requer o servidor rodando (npm run build && npm run start).
 *   CHROMIUM_PATH=/caminho/chrome node scripts/test-veiculos.mjs
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

/**
 * Troca a empresa ativa e so retorna quando o cabecalho refletir a mudanca.
 * Esperar por URL nao serve: a action redireciona para /dashboard e, se a
 * pagina ja estiver la, o waitForURL resolve antes da troca acontecer.
 */
/** Le o "N cadastrado(s)." do cartao de Veiculos na ficha do cliente. */
async function vehiclesOnCustomerCard(page) {
  const text = await page.locator("body").innerText();
  const match = text.match(/(\d+)\s+cadastrado\(s\)/);
  return match ? Number(match[1]) : -1;
}

async function switchCompany(page, index) {
  await page.locator("header button").first().click();
  await page.waitForSelector('[role="menu"]');
  const option = page.locator('[role="menu"] form button').nth(index);
  const target = (await option.innerText()).split("\n")[0].trim();
  await option.click();
  await page.waitForFunction(
    (name) => document.querySelector("header button")?.textContent?.includes(name) ?? false,
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
  if (m.type() === "error" && !expecting404) noise.push(`console: ${m.text()}`);
});

await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.click('button[type="submit"]');
await p.waitForURL("**/dashboard");

console.log("\n▸ CLIENTE (ponto de partida)");
await p.goto(`${BASE}/clientes`, { waitUntil: "networkidle" });
const clienteHref = await p.locator('tbody a[href^="/clientes/"]').first().getAttribute("href");
const clienteId = clienteHref.split("/").pop();
await p.goto(BASE + clienteHref, { waitUntil: "networkidle" });
const nomeCliente = (await p.locator("h1").first().innerText()).trim();
const veiculosAntesFicha = await vehiclesOnCustomerCard(p);
check(nomeCliente.length > 0, `cliente escolhido: ${nomeCliente}`);
check(veiculosAntesFicha >= 0, `ficha mostra ${veiculosAntesFicha} veículo(s) antes`);

console.log("\n▸ CRIAR VEÍCULO");
await p.goto(`${BASE}/veiculos`, { waitUntil: "networkidle" });
const antes = await p.locator("tbody tr").count();

await p.click('a[href="/veiculos?novo=1"]');
await p.waitForSelector('[role="dialog"]', { timeout: 5000 });
check(true, "botão Novo veículo abre o formulário");

// o seletor de cliente só deve conter clientes da empresa atual
const opcoes = await p.locator('select[name="customerId"] option').count();
check(opcoes > 1, `seletor lista clientes da empresa (${opcoes - 1} opções)`);

// validação: placa inválida
await p.selectOption('select[name="customerId"]', clienteId);
await p.fill('input[name="brand"]', "Chevrolet");
await p.fill('input[name="model"]', "Tracker");
await p.fill('input[name="plate"]', "XX");
await p.click('#vehicle-form button[type="submit"]');
await p.waitForTimeout(700);
check((await p.locator("#vehicle-form [role=\"alert\"]").count()) > 0, "validação rejeita placa inválida");

// agora válido
await p.fill('input[name="plate"]', "BRA2E19");
await p.fill('input[name="year"]', "2023");
await p.fill('input[name="color"]', "Grafite");
await p.selectOption('select[name="size"]', "suv");
await p.fill('input[name="mileage"]', "38500");
await p.fill('textarea[name="notes"]', "Veículo criado pelo teste automatizado.");
await p.click('#vehicle-form button[type="submit"]');
await p.waitForURL(/\/veiculos\/[a-z0-9]+$/, { timeout: 15000 });
check(true, "criação redireciona para a página do veículo");

const veiculoId = p.url().split("/").pop();

console.log("\n▸ PÁGINA INDIVIDUAL CARREGA DADOS REAIS");
const corpo = await p.locator("body").innerText();
check((await p.locator("h1").first().innerText()).includes("Chevrolet"), "título mostra o veículo");
check(corpo.includes("BRA2E19"), "placa persistida");
check(corpo.includes("Grafite"), "cor persistida");
check(corpo.includes("2023"), "ano persistido");
check(corpo.includes("38.500 km"), "quilometragem persistida e formatada");
check(corpo.includes("SUV"), "porte persistido");
check(corpo.includes(nomeCliente), "vínculo com o cliente aparece na página");

console.log("\n▸ APARECE NA LISTAGEM E NA FICHA DO CLIENTE");
await p.goto(`${BASE}/veiculos`, { waitUntil: "networkidle" });
const depois = await p.locator("tbody tr").count();
check(depois === antes + 1, `listagem atualizada (${antes} → ${depois})`);

await p.goto(BASE + clienteHref, { waitUntil: "networkidle" });
const fichaCliente = await p.locator("body").innerText();
check(fichaCliente.includes("Chevrolet Tracker"), "veículo aparece na ficha do cliente");
check(
  (await vehiclesOnCustomerCard(p)) === veiculosAntesFicha + 1,
  `contador da ficha subiu (${veiculosAntesFicha} → ${veiculosAntesFicha + 1})`,
);

console.log("\n▸ EDITAR");
await p.goto(`${BASE}/veiculos/${veiculoId}?editar=1`, { waitUntil: "networkidle" });
await p.waitForSelector('[role="dialog"]');
check(await p.inputValue('input[name="brand"]') === "Chevrolet", "formulário abre preenchido");
check(await p.inputValue('input[name="mileage"]') === "38500", "quilometragem carrega correta");
check(
  await p.inputValue('select[name="customerId"]') === clienteId,
  "cliente vinculado vem pré-selecionado",
);

await p.fill('input[name="model"]', "Tracker Premier");
await p.fill('input[name="mileage"]', "41200");
await p.click('#vehicle-form button[type="submit"]');
await p.waitForTimeout(2500);
await p.goto(`${BASE}/veiculos/${veiculoId}`, { waitUntil: "networkidle" });
const editado = await p.locator("body").innerText();
check(editado.includes("Tracker Premier"), "modelo atualizado persistiu");
check(editado.includes("41.200 km"), "quilometragem atualizada persistiu");

console.log("\n▸ ISOLAMENTO ENTRE EMPRESAS");
const empresaB = await switchCompany(p, 1);
check(true, `trocou para a empresa "${empresaB}"`);

expecting404 = true;
const cruzado = await p.goto(`${BASE}/veiculos/${veiculoId}`, { waitUntil: "domcontentloaded" });
check(cruzado.status() === 404, "veículo de outra empresa responde 404");
const cruzadoEdit = await p.goto(`${BASE}/veiculos/${veiculoId}?editar=1`, {
  waitUntil: "domcontentloaded",
});
check(cruzadoEdit.status() === 404, "editar veículo de outra empresa responde 404");
expecting404 = false;

await p.goto(`${BASE}/veiculos?q=Tracker`, { waitUntil: "networkidle" });
check((await p.locator("tbody tr").count()) === 0, "busca na outra empresa não encontra o veículo");

// O seletor da empresa B nao pode oferecer o cliente da empresa A.
// A comparacao e por id: o seed usa os mesmos NOMES nas duas empresas, entao
// checar por nome daria falso positivo.
await p.goto(`${BASE}/veiculos?novo=1`, { waitUntil: "networkidle" });
await p.waitForSelector('[role="dialog"]');
const idsB = await p
  .locator('select[name="customerId"] option')
  .evaluateAll((els) => els.map((e) => e.value));
check(!idsB.includes(clienteId), "seletor da empresa B não oferece o cliente da empresa A (por id)");

// Sai do modal antes de trocar de empresa: o overlay intercepta cliques.
await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
const empresaA = await switchCompany(p, 0);
check(true, `voltou para a empresa "${empresaA}"`);

console.log("\n▸ EXCLUIR");
await p.goto(`${BASE}/veiculos/${veiculoId}`, { waitUntil: "networkidle" });
await p.click('button:has-text("Excluir")');
await p.waitForSelector('[role="dialog"]');
check(
  await p.locator('button:has-text("Excluir veículo")').isVisible(),
  "confirmação exibida antes de excluir",
);
await p.click('button:has-text("Excluir veículo")');
await p.waitForURL("**/veiculos?excluido=1", { timeout: 15000 });
check(true, "exclusão redireciona para a listagem");
check((await p.locator("body").innerText()).includes("Veículo excluído"), "mensagem de sucesso");
check((await p.locator("tbody tr").count()) === antes, `listagem voltou ao original (${antes})`);

expecting404 = true;
const removido = await p.goto(`${BASE}/veiculos/${veiculoId}`, { waitUntil: "domcontentloaded" });
check(removido.status() === 404, "página do veículo excluído responde 404");
expecting404 = false;

// Compara o contador da ficha, nao o texto: outros veiculos podem ter nome
// parecido e um `includes` daria falso negativo.
await p.goto(BASE + clienteHref, { waitUntil: "networkidle" });
const depoisExcluir = await vehiclesOnCustomerCard(p);
check(
  depoisExcluir === veiculosAntesFicha,
  `veículo sumiu da ficha do cliente (${depoisExcluir} = original ${veiculosAntesFicha})`,
);

console.log("\n▸ CONSOLE");
check(noise.length === 0, `sem erros de console (${noise.length})`);
noise.slice(0, 5).forEach((n) => console.log("       " + n));

await b.close();
console.log(
  fails.length === 0
    ? "\n✔ CRUD de Veículos aprovado.\n"
    : `\n✘ ${fails.length} falha(s):\n  - ${fails.join("\n  - ")}\n`,
);
process.exit(fails.length ? 1 : 0);
