/**
 * Regressao de usabilidade dos formularios no celular.
 *
 * Cobre dois bugs que ja apareceram e nao podem voltar:
 *
 *   1. Teclado fechando a cada letra. O modal tinha um efeito que dependia da
 *      funcao `onClose` — recriada a cada render — e que chamava focus() no
 *      painel. Cada tecla disparava o efeito e tirava o foco do campo.
 *
 *   2. Zoom automatico do iOS. O Safari amplia a tela ao focar campos com
 *      fonte menor que 16px.
 *
 * Simula um iPhone real (viewport, touch e user agent).
 *
 *   CHROMIUM_PATH=/caminho/chrome node scripts/test-mobile-forms.mjs
 */
import { chromium, devices } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const CHROME = process.env.CHROMIUM_PATH;
const fails = [];

function check(ok, label) {
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}`);
  if (!ok) fails.push(label);
}

const b = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const ctx = await b.newContext({ ...devices["iPhone 13"], locale: "pt-BR" });
const p = await ctx.newPage();

/** Digita letra a letra e confirma que o foco nunca sai do campo. */
async function typeKeepingFocus(page, selector, text, label) {
  await page.click(selector);
  let lostFocus = false;

  for (const ch of text) {
    await page.keyboard.type(ch);
    await page.waitForTimeout(90); // dá tempo do re-render acontecer
    const stillFocused = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el !== null && document.activeElement === el;
    }, selector);
    if (!stillFocused) lostFocus = true;
  }

  const value = await page.inputValue(selector);
  check(!lostFocus, `${label}: foco permanece no campo a cada letra`);
  check(value === text, `${label}: texto completo digitado ("${value}")`);
}

/** Um campo com fonte < 16px faz o iOS dar zoom ao focar. */
async function checkFontSize(page, selector, label) {
  const size = await page.evaluate(
    (sel) => parseFloat(getComputedStyle(document.querySelector(sel)).fontSize),
    selector,
  );
  check(size >= 16, `${label}: fonte ${size}px (≥16px, não dispara zoom no iOS)`);
}

console.log("\n▸ TELA DE LOGIN (antes de autenticar)");
await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await checkFontSize(p, 'input[name="email"]', "Login e-mail");
await checkFontSize(p, 'input[name="password"]', "Login senha");

console.log("\n▸ RECUPERAÇÃO DE SENHA");
await p.goto(`${BASE}/esqueci-senha`, { waitUntil: "networkidle" });
await typeKeepingFocus(p, '#forgot-form input[name="email"]', "maria@teste.com", "E-mail");
await checkFontSize(p, '#forgot-form input[name="email"]', "E-mail da recuperação");

await p.click('button[type="submit"]');
await p.waitForURL("**/dashboard");

console.log("\n▸ FORMULÁRIO DE CLIENTE");
await p.goto(`${BASE}/clientes?novo=1`, { waitUntil: "networkidle" });
await p.waitForSelector('[role="dialog"]');
await typeKeepingFocus(p, 'input[name="name"]', "Maria Aparecida", "Nome");
await typeKeepingFocus(p, 'input[name="phone"]', "11987654321", "Telefone");
await typeKeepingFocus(p, 'textarea[name="notes"]', "Observacao de teste", "Observações");
await checkFontSize(p, 'input[name="name"]', "Nome");
await checkFontSize(p, 'textarea[name="notes"]', "Observações");
await checkFontSize(p, 'select[name="origin"]', "Origem");

console.log("\n▸ FORMULÁRIO DE VEÍCULO");
await p.goto(`${BASE}/veiculos?novo=1`, { waitUntil: "networkidle" });
await p.waitForSelector('[role="dialog"]');
await typeKeepingFocus(p, 'input[name="brand"]', "Volkswagen", "Marca");
await typeKeepingFocus(p, 'input[name="plate"]', "BRA2E19", "Placa");
await checkFontSize(p, 'input[name="brand"]', "Marca");
await checkFontSize(p, 'input[name="mileage"]', "Quilometragem");

console.log("\n▸ FORMULÁRIO DE CONTATO (RETENÇÃO)");
await p.goto(`${BASE}/retencao`, { waitUntil: "networkidle" });
const registrar = p.locator('tbody button:has-text("Registrar")').first();
if ((await registrar.count()) > 0) {
  await registrar.click();
  await p.waitForSelector('[role="dialog"]');
  await typeKeepingFocus(p, 'textarea[name="notes"]', "Cliente pediu retorno", "Observação");
  await checkFontSize(p, 'input[name="contactedAt"]', "Data e hora do contato");
  await checkFontSize(p, 'select[name="channel"]', "Tipo de contato");
  await checkFontSize(p, 'select[name="outcome"]', "Status do contato");
  await checkFontSize(p, 'textarea[name="notes"]', "Observação");
} else {
  console.log("  --   nenhum cliente na fila de retenção nesta base; etapa pulada");
}

console.log("\n▸ CAMPOS FORA DE MODAL");
await p.goto(`${BASE}/clientes`, { waitUntil: "networkidle" });
await typeKeepingFocus(p, 'input[name="q"]', "Silva", "Busca de clientes");
await checkFontSize(p, 'input[name="q"]', "Busca de clientes");

console.log("\n▸ ZOOM NÃO FICA BLOQUEADO PARA O USUÁRIO");
const viewport = await p.evaluate(
  () => document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "",
);
check(
  !/maximum-scale|user-scalable\s*=\s*(no|0)/i.test(viewport),
  `viewport permite zoom manual ("${viewport}")`,
);

await b.close();
console.log(
  fails.length === 0
    ? "\n✔ Formulários no celular aprovados.\n"
    : `\n✘ ${fails.length} falha(s):\n  - ${fails.join("\n  - ")}\n`,
);
process.exit(fails.length ? 1 : 0);
