/**
 * Teste do modulo Orcamentos.
 *
 * TESTE 1  cliente -> veiculo -> criar orcamento -> servicos -> desconto -> salvar
 * TESTE 2  editar -> trocar servico -> alterar valor e quantidade -> conferir total
 * TESTE 3  criar -> enviar -> aprovar -> converter em OS
 * TESTE 4  conferir quoteId na WorkOrder e abrir a OS criada
 * TESTE 5  tentar converter de novo -> nao pode duplicar
 * TESTE 6  outra empresa nao acessa nem altera o orcamento
 *
 * Cobre tambem a validade: orcamento vencido nao aprova nem converte sem a
 * acao explicita de revalidar.
 *
 * Requer o servidor rodando (npm run build && npm run start).
 *   CHROMIUM_PATH=/caminho/chrome node scripts/test-orcamentos.mjs
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

const norm = (t) => t.replace(/ /g, " ");
const brl = (cents) =>
  `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const toCents = (v) => Math.round(Number(v.replace(/\./g, "").replace(",", ".")) * 100);

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

const b = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: "pt-BR" });
const p = await ctx.newPage();
p.on("pageerror", (e) => noise.push(`pageerror: ${e.message}`));
p.on("console", (m) => {
  if (m.type() === "error" && !expecting404 && !/facebook\.(net|com)|fbevents/i.test(m.location()?.url ?? "")) noise.push(`console: ${m.text()}`);
});

await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.fill('input[name="email"]', "demo@autovolt.com.br");
await p.fill('input[name="password"]', "autovolt123");
await p.click('button[type="submit"]');
await p.waitForURL("**/dashboard");

// ---------------------------------------------------------------- TESTE 1
console.log("\n══ TESTE 1: criar com serviços e desconto ══");
await p.goto(`${BASE}/orcamentos`, { waitUntil: "networkidle" });
await p.click('a[href="/orcamentos?novo=1"]');
await p.waitForSelector('[role="dialog"]', { timeout: 8000 });
check(true, "botão Novo orçamento abre o formulário");

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
  .evaluateAll((e) => e.filter((x) => x.value).map((x) => x.value));
check(veiculos.length > 0, `veículos do cliente listados (${veiculos.length})`);
await p.selectOption('select[name="vehicleId"]', veiculos[0]);

// Dois serviços, com valor do catálogo preenchido automaticamente.
const boxes = p.locator('#quote-form input[type="checkbox"]');
await boxes.nth(0).check();
await p.waitForTimeout(200);
await boxes.nth(1).check();
await p.waitForTimeout(300);
const precos = await p
  .locator('#quote-form input[name^="price__"]')
  .evaluateAll((e) => e.map((x) => x.value));
check(precos.length === 2, `dois serviços com preço do catálogo (${precos.join(" + ")})`);

// Ajusta o primeiro item e aplica desconto.
await p.locator('#quote-form input[name^="price__"]').first().fill("500,00");
await p.locator('#quote-form input[name^="qty__"]').first().fill("2");
await p.fill('input[name="discount"]', "150,00");
await p.waitForTimeout(400);

const segundo = toCents(precos[1]);
const subtotalEsperado = 2 * 50000 + segundo;
const totalEsperado = subtotalEsperado - 15000;
let form = norm(await p.locator("#quote-form").innerText());
check(form.includes(brl(subtotalEsperado)), `subtotal calculado (${brl(subtotalEsperado)})`);
check(form.includes(brl(totalEsperado)), `total = subtotal − desconto (${brl(totalEsperado)})`);

await p.fill('input[name="validUntil"]', futureDate(20));
await p.fill('textarea[name="notes"]', "Orçamento criado pelo teste.");
await p.click('#quote-form button[type="submit"]');
await p.waitForURL(/\/orcamentos\/[a-z0-9]+$/, { timeout: 15000 });
const quoteId = p.url().split("/").pop();
check(true, "criação redireciona para a página do orçamento");

let corpo = norm(await p.locator("body").innerText());
check(corpo.includes(clientes[0].nome), "orçamento mostra o cliente");
check(corpo.includes(brl(subtotalEsperado)), "subtotal persistido");
check(corpo.includes(brl(15000)), "desconto persistido");
check(corpo.includes(brl(totalEsperado)), "total persistido");
check(corpo.includes("Rascunho"), "status inicial: Rascunho");

// ---------------------------------------------------------------- TESTE 2
console.log("\n══ TESTE 2: editar serviços, valor e quantidade ══");
await p.goto(`${BASE}/orcamentos/${quoteId}?editar=1`, { waitUntil: "networkidle" });
await p.waitForSelector('[role="dialog"]');
check(
  (await p.locator('#quote-form input[name^="price__"]').count()) === 2,
  "formulário de edição abre com os itens",
);
check(
  (await p.inputValue('input[name="discount"]')) === "150,00",
  "desconto carrega no formulário",
);

// Adiciona um terceiro serviço e muda valores.
await boxes.nth(2).check();
await p.waitForTimeout(300);
await p.locator('#quote-form input[name^="price__"]').first().fill("400,00");
await p.locator('#quote-form input[name^="qty__"]').first().fill("3");
await p.fill('input[name="discount"]', "200,00");
await p.waitForTimeout(400);

const precosEdit = await p
  .locator('#quote-form input[name^="price__"]')
  .evaluateAll((e) => e.map((x) => x.value));
const qtysEdit = await p
  .locator('#quote-form input[name^="qty__"]')
  .evaluateAll((e) => e.map((x) => x.value));
const subtotalEdit = precosEdit.reduce(
  (sum, v, i) => sum + toCents(v) * Number(qtysEdit[i] || "1"),
  0,
);
const totalEdit = subtotalEdit - 20000;
form = norm(await p.locator("#quote-form").innerText());
check(form.includes(brl(subtotalEdit)), `subtotal recalculado (${brl(subtotalEdit)})`);
check(form.includes(brl(totalEdit)), `total recalculado (${brl(totalEdit)})`);

await p.click('#quote-form button[type="submit"]');
await p.waitForTimeout(3000);
await p.goto(`${BASE}/orcamentos/${quoteId}`, { waitUntil: "networkidle" });
corpo = norm(await p.locator("body").innerText());
check(corpo.includes(brl(totalEdit)), "total editado persistiu");
check(corpo.includes("3 ×"), "quantidade salva no item");

// ---------------------------------------------------------------- TESTE 3
console.log("\n══ TESTE 3: enviar → aprovar → converter ══");
await p.click('button:has-text("Marcar como enviado")');
await p.waitForTimeout(2500);
await p.goto(`${BASE}/orcamentos/${quoteId}`, { waitUntil: "networkidle" });
check(norm(await p.locator("body").innerText()).includes("Enviado"), "status: Enviado");

await p.click('button:has-text("Aprovar")');
await p.waitForTimeout(2500);
await p.goto(`${BASE}/orcamentos/${quoteId}`, { waitUntil: "networkidle" });
corpo = norm(await p.locator("body").innerText());
check(corpo.includes("Aprovado"), "status: Aprovado");
check(
  (await p.locator('a[href^="/orcamentos/"][href$="editar=1"]').count()) === 0,
  "orçamento aprovado não oferece edição direta",
);

await p.click('button:has-text("Converter em OS")');
await p.waitForURL(/\/ordens\/[a-z0-9]+$/, { timeout: 15000 });
const osId = p.url().split("/").pop();
check(true, "conversão redireciona para a OS criada");

corpo = norm(await p.locator("body").innerText());
check(corpo.includes(clientes[0].nome), "OS herdou o cliente do orçamento");
check(corpo.includes(brl(totalEdit)), "OS herdou o total aprovado");
check(corpo.includes("Aberta"), "OS entra no fluxo normal, como Aberta");

// ---------------------------------------------------------------- TESTE 4
console.log("\n══ TESTE 4: vínculo quoteId ══");
await p.goto(`${BASE}/orcamentos/${quoteId}`, { waitUntil: "networkidle" });
corpo = norm(await p.locator("body").innerText());
check(corpo.includes("Convertido na OS"), "orçamento mostra a OS gerada");
const abrirOS = p.locator('a:has-text("Abrir OS")');
check((await abrirOS.count()) > 0, "ação 'Abrir OS' disponível");
const hrefOS = await p.locator('a[href^="/ordens/"]').first().getAttribute("href");
check(hrefOS.includes(osId), "o link aponta para a OS criada (quoteId ligou os dois)");

// ---------------------------------------------------------------- TESTE 5
console.log("\n══ TESTE 5: não duplica OS ══");
check(
  (await p.locator('button:has-text("Converter em OS")').count()) === 0,
  "botão de converter não aparece mais",
);
const osAntes = await (async () => {
  await p.goto(`${BASE}/ordens`, { waitUntil: "networkidle" });
  return p.locator("tbody tr").count();
})();
// Volta e confirma que a única ação é abrir a OS existente.
await p.goto(`${BASE}/orcamentos/${quoteId}`, { waitUntil: "networkidle" });
await p.locator('a:has-text("Abrir OS")').click();
await p.waitForURL(/\/ordens\/[a-z0-9]+$/, { timeout: 15000 });
check(p.url().endsWith(osId), "'Abrir OS' leva à mesma OS, sem criar outra");
await p.goto(`${BASE}/ordens`, { waitUntil: "networkidle" });
check(
  (await p.locator("tbody tr").count()) === osAntes,
  `nenhuma OS extra foi criada (${osAntes})`,
);

console.log("\n▸ VALIDADE VENCIDA BLOQUEIA APROVAÇÃO");
await p.goto(`${BASE}/orcamentos?novo=1`, { waitUntil: "networkidle" });
await p.waitForSelector('[role="dialog"]');
await p.selectOption('select[name="customerId"]', clientes[1].id);
await p.waitForTimeout(250);
const veic2 = await p
  .locator('select[name="vehicleId"] option')
  .evaluateAll((e) => e.filter((x) => x.value).map((x) => x.value));
await p.selectOption('select[name="vehicleId"]', veic2[0]);
await p.locator('#quote-form input[type="checkbox"]').first().check();
await p.waitForTimeout(300);
await p.fill('input[name="validUntil"]', futureDate(-5)); // já vencido
await p.selectOption('select[name="status"]', "enviado");
await p.click('#quote-form button[type="submit"]');
await p.waitForURL(/\/orcamentos\/[a-z0-9]+$/, { timeout: 15000 });
const vencidoId = p.url().split("/").pop();
corpo = norm(await p.locator("body").innerText());
check(corpo.includes("Vencido"), "orçamento vencido é identificado na interface");

await p.click('button:has-text("Aprovar")');
await p.waitForTimeout(2000);
check(
  norm(await p.locator("body").innerText()).includes("vencido"),
  "aprovar um vencido é recusado com aviso",
);

await p.goto(`${BASE}/orcamentos/${vencidoId}`, { waitUntil: "networkidle" });
await p.click('button:has-text("Revalidar")');
await p.waitForSelector('[role="dialog"]');
await p.fill('#renew-form input[name="validUntil"]', futureDate(30));
await p.click('#renew-form button[type="submit"]');
await p.waitForTimeout(2500);
await p.goto(`${BASE}/orcamentos/${vencidoId}`, { waitUntil: "networkidle" });
corpo = norm(await p.locator("body").innerText());
check(!corpo.includes("Vencido"), "após revalidar, deixa de estar vencido");
await p.click('button:has-text("Aprovar")');
await p.waitForTimeout(2500);
await p.goto(`${BASE}/orcamentos/${vencidoId}`, { waitUntil: "networkidle" });
check(
  norm(await p.locator("body").innerText()).includes("Aprovado"),
  "revalidado, o orçamento pode ser aprovado",
);

// ---------------------------------------------------------------- TESTE 6
console.log("\n══ TESTE 6: isolamento entre empresas ══");
const empresaB = await switchCompany(p, 1);
check(true, `trocou para "${empresaB}"`);

expecting404 = true;
const cruzado = await p.goto(`${BASE}/orcamentos/${quoteId}`, { waitUntil: "domcontentloaded" });
check(cruzado.status() === 404, "orçamento de outra empresa responde 404");
const cruzadoEdit = await p.goto(`${BASE}/orcamentos/${quoteId}?editar=1`, {
  waitUntil: "domcontentloaded",
});
check(cruzadoEdit.status() === 404, "editar orçamento de outra empresa responde 404");
expecting404 = false;

await p.goto(`${BASE}/orcamentos?novo=1`, { waitUntil: "networkidle" });
await p.waitForSelector('[role="dialog"]');
const idsB = await p
  .locator('select[name="customerId"] option')
  .evaluateAll((e) => e.map((x) => x.value));
check(!idsB.includes(clientes[0].id), "seletor da empresa B não oferece cliente da empresa A");

await switchCompany(p, 0);

console.log("\n▸ FUNIL E INDICADORES");
await p.goto(`${BASE}/orcamentos`, { waitUntil: "networkidle" });
corpo = norm(await p.locator("body").innerText());
check(/Taxa de conversão/.test(corpo), "indicador de conversão presente");
check(/Aprovados/.test(corpo), "funil mostra a coluna de aprovados");
check(
  (await p.locator('a[href^="/orcamentos/"]').count()) > 0,
  "listagem linka para a página do orçamento",
);

console.log("\n▸ CONSOLE");
check(noise.length === 0, `sem erros de console (${noise.length})`);
noise.slice(0, 5).forEach((n) => console.log("       " + n));

await b.close();
console.log(
  fails.length === 0
    ? "\n✔ Módulo Orçamentos aprovado.\n"
    : `\n✘ ${fails.length} falha(s):\n  - ${fails.join("\n  - ")}\n`,
);
process.exit(fails.length ? 1 : 0);
