import { chromium } from "playwright";

const BASE = "http://127.0.0.1:3000";
const CHROME = process.env.CHROMIUM_PATH;
const fails = [];
const noise = [];
/** Os testes de 404 sao intencionais e geram erro de rede esperado. */
let expecting404 = false;

function check(ok, label) {
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}`);
  if (!ok) fails.push(label);
}

const b = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: "pt-BR" });
const p = await ctx.newPage();
p.on("pageerror", (e) => noise.push(`pageerror: ${e.message}`));
p.on("console", (m) => { if (m.type() === "error" && !expecting404) noise.push(`console: ${m.text()}`); });

// login
await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.fill('input[name="email"]', "demo@autovolt.com.br");
await p.fill('input[name="password"]', "autovolt123");
await p.click('button[type="submit"]');
await p.waitForURL("**/dashboard");

console.log("\n▸ CRIAR");
await p.goto(`${BASE}/clientes`, { waitUntil: "networkidle" });
const antes = await p.locator("tbody tr").count();

await p.click('a[href="/clientes?novo=1"]');
await p.waitForSelector('[role="dialog"]', { timeout: 5000 });
check(true, "botão Novo cliente abre o formulário");

// validação: nome curto demais
await p.fill('input[name="name"]', "A");
await p.fill('input[name="phone"]', "11");
await p.click('#customer-form button[type="submit"]');
await p.waitForTimeout(700);
const erroVisivel = await p.locator('#customer-form [role="alert"]').count();
check(erroVisivel > 0, "validação bloqueia dados inválidos e mostra erro");

// agora válido
await p.fill('input[name="name"]', "Teste Da Silva CRUD");
await p.fill('input[name="phone"]', "11988887777");
await p.fill('input[name="email"]', "teste.crud@email.com");
await p.fill('input[name="birthDate"]', "1990-05-20");
await p.selectOption('select[name="origin"]', "instagram");
await p.fill('textarea[name="notes"]', "Cliente criado pelo teste automatizado.");
await p.click('#customer-form button[type="submit"]');
await p.waitForURL(/\/clientes\/[a-z0-9]+$/, { timeout: 15000 });
check(true, "criação redireciona para a ficha do cliente");

const url = p.url();
const novoId = url.split("/").pop();
const h1 = (await p.locator("h1").first().innerText()).trim();
check(h1 === "Teste Da Silva CRUD", `ficha mostra o nome salvo ("${h1}")`);
const corpo = await p.locator("body").innerText();
check(corpo.includes("teste.crud@email.com"), "e-mail persistido");
check(corpo.includes("Instagram"), "origem persistida");
check(corpo.includes("Cliente criado pelo teste automatizado."), "observações persistidas");

await p.goto(`${BASE}/clientes`, { waitUntil: "networkidle" });
const depois = await p.locator("tbody tr").count();
check(depois === antes + 1, `aparece na listagem imediatamente (${antes} → ${depois})`);

console.log("\n▸ EDITAR");
await p.goto(`${BASE}/clientes/${novoId}?editar=1`, { waitUntil: "networkidle" });
await p.waitForSelector('[role="dialog"]');
const nomeCarregado = await p.inputValue('input[name="name"]');
const dataCarregada = await p.inputValue('input[name="birthDate"]');
check(nomeCarregado === "Teste Da Silva CRUD", "formulário abre preenchido");
check(dataCarregada === "1990-05-20", `data de nascimento carrega correta (${dataCarregada})`);

await p.fill('input[name="name"]', "Teste Editado CRUD");
await p.fill('input[name="phone"]', "11955554444");
await p.click('#customer-form button[type="submit"]');
await p.waitForTimeout(2500);
await p.goto(`${BASE}/clientes/${novoId}`, { waitUntil: "networkidle" });
const h1b = (await p.locator("h1").first().innerText()).trim();
check(h1b === "Teste Editado CRUD", `ficha atualizada ("${h1b}")`);

await p.goto(`${BASE}/clientes?q=Teste Editado`, { waitUntil: "networkidle" });
const achou = await p.locator("tbody tr").count();
check(achou === 1, "listagem reflete a edição (busca encontra o novo nome)");

console.log("\n▸ EXCLUIR");
await p.goto(`${BASE}/clientes/${novoId}`, { waitUntil: "networkidle" });
await p.click('button:has-text("Excluir")');
await p.waitForSelector('[role="dialog"]');
const btnConfirmar = p.locator('button:has-text("Excluir definitivamente")');
check(await btnConfirmar.isDisabled(), "confirmação exigida: botão começa desabilitado");

await p.fill('[role="dialog"] input[placeholder="Teste Editado CRUD"]', "nome errado");
await p.waitForTimeout(200);
check(await btnConfirmar.isDisabled(), "nome errado mantém o botão bloqueado");

await p.fill('[role="dialog"] input[placeholder="Teste Editado CRUD"]', "Teste Editado CRUD");
await p.waitForTimeout(200);
check(!(await btnConfirmar.isDisabled()), "nome correto libera a exclusão");

await btnConfirmar.click();
await p.waitForURL("**/clientes?excluido=1", { timeout: 15000 });
check(true, "exclusão redireciona para a listagem");
const aviso = await p.locator("body").innerText();
check(aviso.includes("Cliente excluído"), "mensagem de sucesso exibida");

const final = await p.locator("tbody tr").count();
check(final === antes, `cliente removido da listagem (${final} = original ${antes})`);

expecting404 = true;
const ficha = await p.goto(`${BASE}/clientes/${novoId}`, { waitUntil: "domcontentloaded" });
check(ficha.status() === 404, "ficha do cliente excluído responde 404");

expecting404 = false;
console.log("\n▸ ISOLAMENTO ENTRE EMPRESAS");
// cria um cliente na empresa A, troca para a B e tenta editá-lo de lá
await p.goto(`${BASE}/clientes?novo=1`, { waitUntil: "networkidle" });
await p.waitForSelector('[role="dialog"]');
await p.fill('input[name="name"]', "Cliente Da Empresa A");
await p.click('#customer-form button[type="submit"]');
await p.waitForURL(/\/clientes\/[a-z0-9]+$/, { timeout: 15000 });
const idEmpresaA = p.url().split("/").pop();

await p.locator("header button").first().click();
await p.waitForTimeout(400);
await p.locator('[role="menu"] form button').nth(1).click();
await p.waitForURL("**/dashboard", { timeout: 15000 });

expecting404 = true;
const cruzado = await p.goto(`${BASE}/clientes/${idEmpresaA}?editar=1`, { waitUntil: "domcontentloaded" });
check(cruzado.status() === 404, "editar cliente de outra empresa responde 404");

expecting404 = false;
// A ficha da empresa B não lista o cliente da empresa A.
await p.goto(`${BASE}/clientes?q=Cliente Da Empresa A`, { waitUntil: "networkidle" });
const vazamento = await p.locator("tbody tr").count();
check(vazamento === 0, "busca na empresa B não encontra cliente da empresa A");

// Volta para a empresa dona (a partir de uma página que tem o cabeçalho).
await p.locator("header button").first().click();
await p.waitForTimeout(400);
await p.locator('[role="menu"] form button').nth(0).click();
await p.waitForURL("**/dashboard", { timeout: 15000 });
const voltou = await p.goto(`${BASE}/clientes/${idEmpresaA}`, { waitUntil: "domcontentloaded" });
check(voltou.status() === 200, "o mesmo cliente continua acessível na empresa dona");
const nomeIntacto = (await p.locator("h1").first().innerText()).trim();
check(nomeIntacto === "Cliente Da Empresa A", `nome intacto ("${nomeIntacto}")`);

console.log("\n▸ CONSOLE");
check(noise.length === 0, `sem erros de console (${noise.length})`);
noise.slice(0, 5).forEach((n) => console.log("       " + n));

await b.close();
console.log(fails.length === 0 ? "\n✔ CRUD de Clientes aprovado.\n" : `\n✘ ${fails.length} falha(s):\n  - ${fails.join("\n  - ")}\n`);
process.exit(fails.length ? 1 : 0);
