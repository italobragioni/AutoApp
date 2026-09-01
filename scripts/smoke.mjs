/**
 * Smoke test do AUTOVOLT.
 *
 * Sobe contra um servidor ja rodando (npm run build && npm run start) e valida:
 *  - landing e login;
 *  - as 11 paginas do menu respondem 200 com o titulo certo;
 *  - a ficha de cliente (rota dinamica) abre;
 *  - o isolamento entre empresas: um registro de outra empresa devolve 404;
 *  - o menu mobile abre;
 *  - nenhum erro de console/hidratacao.
 *
 * Uso:
 *   npm run build && npm run start &
 *   node scripts/smoke.mjs
 *
 * Em ambientes com um Chromium ja instalado fora do Playwright, aponte:
 *   CHROMIUM_PATH=/caminho/para/chrome node scripts/smoke.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const CREDENTIALS = {
  email: process.env.DEMO_EMAIL ?? "demo@autovolt.com.br",
  password: process.env.DEMO_PASSWORD ?? "autovolt123",
};

const failures = [];
const noise = [];
/** Durante os testes de 404 o navegador registra erros de rede esperados. */
let expecting404 = false;

function check(ok, label) {
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}`);
  if (!ok) failures.push(label);
}

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "pt-BR" });
const page = await context.newPage();
page.on("pageerror", (error) => noise.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error" && !expecting404) noise.push(`console: ${message.text()}`);
});

console.log("\n▸ Público");
const landing = await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
check(landing.status() === 200, "landing responde 200");
check((await page.title()).includes("AUTOVOLT"), "título da landing");

const guarded = await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
check(guarded.url().includes("/login"), "rota protegida redireciona para /login");

console.log("\n▸ Autenticação");
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', CREDENTIALS.email);
await page.fill('input[name="password"]', CREDENTIALS.password);
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard", { timeout: 20000 });
check(page.url().endsWith("/dashboard"), "login com credenciais de demonstração");

console.log("\n▸ Páginas do menu");
const ROUTES = [
  ["dashboard", "Olá,"],
  ["agenda", "Agenda"],
  ["clientes", "Clientes"],
  ["veiculos", "Veículos"],
  ["servicos", "Serviços"],
  ["orcamentos", "Orçamentos"],
  ["ordens", "Ordens de Serviço"],
  ["retencao", "Retenção"],
  ["campanhas", "Campanhas"],
  ["relatorios", "Relatórios"],
  ["configuracoes", "Configurações"],
];
for (const [route, expected] of ROUTES) {
  const response = await page.goto(`${BASE}/${route}`, { waitUntil: "networkidle" });
  const heading = (await page.locator("h1").first().innerText()).trim();
  check(response.status() === 200 && heading.startsWith(expected), `/${route} → "${heading}"`);
}

console.log("\n▸ Rota dinâmica e isolamento entre empresas");
await page.goto(`${BASE}/clientes`, { waitUntil: "networkidle" });
const firstCustomer = await page.locator('tbody a[href^="/clientes/"]').first().getAttribute("href");
const detail = await page.goto(BASE + firstCustomer, { waitUntil: "networkidle" });
check(detail.status() === 200, "ficha de cliente da própria empresa abre");

// Troca para a segunda empresa e tenta abrir o mesmo registro.
expecting404 = true;
await page.locator("header button").first().click();
await page.waitForTimeout(300);
const companyOptions = page.locator('[role="menu"] form button');
if ((await companyOptions.count()) > 1) {
  await companyOptions.nth(1).click();
  await page.waitForURL("**/dashboard", { timeout: 20000 });
  const crossTenant = await page.goto(BASE + firstCustomer, { waitUntil: "domcontentloaded" });
  check(crossTenant.status() === 404, "registro de outra empresa devolve 404");
} else {
  console.log("  --   apenas uma empresa na conta; teste de isolamento ignorado");
}

const missing = await page.goto(`${BASE}/clientes/nao-existe`, { waitUntil: "domcontentloaded" });
check(missing.status() === 404, "id inexistente devolve 404");
expecting404 = false;

console.log("\n▸ Mobile");
const mobile = await context.newPage();
await mobile.setViewportSize({ width: 390, height: 844 });
await mobile.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await mobile.locator("nav button").last().click();
// A sidebar do desktop continua no DOM (apenas oculta), entao filtramos por
// visibilidade para pegar o link que esta de fato dentro da folha do mobile.
const sheetLink = mobile.locator('a[href="/configuracoes"]:visible');
await sheetLink.first().waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
check((await sheetLink.count()) > 0, "menu inferior abre a lista completa");

console.log("\n▸ Console");
check(noise.length === 0, `sem erros de console (${noise.length})`);
for (const line of noise.slice(0, 10)) console.log(`       ${line}`);

await browser.close();

console.log(
  failures.length === 0
    ? "\n✔ Smoke test passou.\n"
    : `\n✘ ${failures.length} verificação(ões) falharam:\n  - ${failures.join("\n  - ")}\n`,
);
process.exit(failures.length === 0 ? 0 : 1);
