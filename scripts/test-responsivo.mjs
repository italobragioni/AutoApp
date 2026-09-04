/**
 * Teste de responsividade mobile e experiência de uso.
 *
 * TESTE 1  todas as rotas, em 3 larguras, sem scroll horizontal de página
 * TESTE 2  menu mobile: abre, navega, fecha ao escolher, respeita permissões
 * TESTE 3  formulário em modal no celular: campos e botão Salvar alcançáveis
 * TESTE 4  Agenda no celular: grade escondida, lista cronológica é a visão
 * TESTE 5  tabela larga rola dentro do card, não estica a página
 * TESTE 6  permissão preservada: staff não vê nem alcança Relatórios
 *
 * Mede o overflow real (documentElement.scrollWidth − clientWidth), não a
 * aparência. Requer o servidor rodando (npm run build && npm run start).
 *   CHROMIUM_PATH=/caminho/chrome node scripts/test-responsivo.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const CHROME = process.env.CHROMIUM_PATH;
const fails = [];

function check(ok, label) {
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}`);
  if (!ok) fails.push(label);
}

const ROTAS_APP = [
  "/dashboard", "/clientes", "/veiculos", "/servicos", "/agenda",
  "/orcamentos", "/ordens", "/retencao", "/campanhas", "/relatorios", "/configuracoes",
];
const ROTAS_PUB = ["/login", "/cadastro", "/esqueci-senha"];

const LARGURAS = [
  { nome: "pequeno", w: 320, h: 720 },
  { nome: "comum", w: 390, h: 844 },
  { nome: "tablet", w: 768, h: 1024 },
];

async function overflow(page) {
  await page.waitForTimeout(250);
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

const b = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

// ---------------------------------------------------------------- TESTE 1
console.log("\n══ TESTE 1: sem scroll horizontal em nenhuma rota ══");

for (const vp of LARGURAS) {
  const ctx = await b.newContext({
    viewport: { width: vp.w, height: vp.h },
    locale: "pt-BR",
    isMobile: vp.w < 700,
    hasTouch: vp.w < 700,
  });
  const p = await ctx.newPage();

  // Rotas públicas antes de logar.
  for (const rota of ROTAS_PUB) {
    await p.goto(`${BASE}${rota}`, { waitUntil: "networkidle" });
    check((await overflow(p)) <= 1, `${vp.nome} ${rota} sem overflow`);
  }

  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.fill('input[name="email"]', "demo@autovolt.com.br");
  await p.fill('input[name="password"]', "autovolt123");
  await p.click('button[type="submit"]');
  await p.waitForURL("**/dashboard", { timeout: 15000 });

  for (const rota of ROTAS_APP) {
    await p.goto(`${BASE}${rota}`, { waitUntil: "networkidle" });
    const o = await overflow(p);
    check(o <= 1, `${vp.nome} ${rota} sem overflow${o > 1 ? ` (${o}px)` : ""}`);
  }
  await ctx.close();
}

// A partir daqui, um celular comum.
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 },
  locale: "pt-BR",
  isMobile: true,
  hasTouch: true,
});
const p = await ctx.newPage();
await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.fill('input[name="email"]', "demo@autovolt.com.br");
await p.fill('input[name="password"]', "autovolt123");
await p.click('button[type="submit"]');
await p.waitForURL("**/dashboard");

// ---------------------------------------------------------------- TESTE 2
console.log("\n══ TESTE 2: menu mobile ══");

// A sidebar de desktop fica escondida no celular.
check(
  !(await p.locator("aside").first().isVisible().catch(() => false)),
  "sidebar de desktop escondida no celular",
);
// A barra inferior existe.
check(await p.locator("nav.fixed.bottom-0").isVisible(), "barra de navegação inferior visível");

// Abre o menu completo pelo "Mais".
await p.click('button:has-text("Mais")');
await p.waitForTimeout(400);
check(await p.locator('text=Menu').first().isVisible(), "botão Mais abre a folha do menu");

// Navega para Configurações pelo menu e confirma que ele fecha. O seletor usa
// :visible porque o link também existe na sidebar de desktop (escondida).
await p.click('a[href="/configuracoes"]:visible');
await p.waitForURL("**/configuracoes", { timeout: 10000 });
await p.waitForTimeout(500);
check(p.url().endsWith("/configuracoes"), "menu navega para a rota escolhida");
check(
  !(await p.locator('text=Menu').first().isVisible().catch(() => false)),
  "o menu fecha depois de escolher a página",
);

// ---------------------------------------------------------------- TESTE 3
console.log("\n══ TESTE 3: formulário em modal no celular ══");

const TAG = `resp${Math.floor(Date.now() / 1000) % 100000}`;
await p.goto(`${BASE}/clientes?novo=1`, { waitUntil: "networkidle" });
await p.waitForSelector('[role="dialog"]', { timeout: 8000 });

// O modal não ultrapassa a largura da tela.
const modalOverflow = await overflow(p);
check(modalOverflow <= 1, `modal aberto não gera scroll horizontal${modalOverflow > 1 ? ` (${modalOverflow}px)` : ""}`);

// O botão Salvar é alcançável pelo scroll interno do modal (padrão para
// formulário longo). Rola até ele e confirma que fica visível dentro da tela.
const nome = p.locator('input[name="name"]');
await nome.fill(`Cliente ${TAG}`);
const salvar = p.locator('#customer-form button[type="submit"]').first();
await salvar.scrollIntoViewIfNeeded();
const box = await salvar.boundingBox();
const vh = p.viewportSize().height;
check(
  Boolean(box) && box.y >= 0 && box.y + box.height <= vh + 1,
  `botão Salvar alcançável e visível após rolar o modal (y=${box ? Math.round(box.y) : "?"}, tela=${vh})`,
);
// O campo tem 16px (não dá zoom no iOS) — regra do design system.
const fontSize = await nome.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
check(fontSize >= 16, `campo com fonte ${fontSize}px (≥16px)`);

await salvar.click();
await p.waitForTimeout(2500);
await p.goto(`${BASE}/clientes`, { waitUntil: "networkidle" });
check(
  (await p.locator("body").innerText()).includes(`Cliente ${TAG}`),
  "cliente criado pelo modal no celular aparece na lista",
);

// ---------------------------------------------------------------- TESTE 4
console.log("\n══ TESTE 4: Agenda no celular ══");

await p.goto(`${BASE}/agenda`, { waitUntil: "networkidle" });
await p.waitForTimeout(400);
// A grade semanal (7 colunas) fica escondida no celular.
const gradeVisivel = await p.evaluate(() => {
  const grade = document.querySelector(".lg\\:grid-cols-7");
  if (!grade) return false;
  return getComputedStyle(grade).display !== "none";
});
check(!gradeVisivel, "grade semanal escondida no celular");
check(
  (await p.locator("body").innerText()).includes("Detalhamento da semana"),
  "lista cronológica é a visão de agenda no celular",
);
// Consegue abrir o formulário de novo agendamento.
await p.goto(`${BASE}/agenda?novo=1`, { waitUntil: "networkidle" });
check(
  (await p.locator('[role="dialog"]').count()) > 0,
  "formulário de novo agendamento abre no celular",
);
check((await overflow(p)) <= 1, "formulário de agendamento sem overflow");

// ---------------------------------------------------------------- TESTE 5
console.log("\n══ TESTE 5: tabela larga rola dentro do card ══");

await p.goto(`${BASE}/ordens`, { waitUntil: "networkidle" });
await p.waitForTimeout(400);
check((await overflow(p)) <= 1, "Ordens não gera scroll horizontal de página");
const scrollavel = await p.evaluate(() => {
  const wrap = [...document.querySelectorAll("div")].find(
    (d) => d.querySelector("table") && d.scrollWidth > d.clientWidth + 1,
  );
  return wrap ? { sw: wrap.scrollWidth, cw: wrap.clientWidth } : null;
});
check(
  Boolean(scrollavel) && scrollavel.sw > scrollavel.cw,
  `a tabela rola dentro do próprio container (${scrollavel ? `${scrollavel.cw}<${scrollavel.sw}` : "?"})`,
);

// ---------------------------------------------------------------- TESTE 6
console.log("\n══ TESTE 6: permissão preservada no mobile ══");

const staff = await b.newContext({
  viewport: { width: 390, height: 844 },
  locale: "pt-BR",
  isMobile: true,
  hasTouch: true,
});
const ps = await staff.newPage();
await ps.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await ps.fill('input[name="email"]', "diego.nakamura@garage77.com.br");
await ps.fill('input[name="password"]', "autovolt123");
await ps.click('button[type="submit"]');
await ps.waitForURL("**/dashboard", { timeout: 15000 });

// O menu mobile não oferece Relatórios/Orçamentos/Campanhas ao operacional.
await ps.click('button:has-text("Mais")');
await ps.waitForTimeout(400);
const linksMenu = await ps.locator("a[href]").evaluateAll((els) => els.map((e) => e.getAttribute("href")));
check(!linksMenu.includes("/relatorios"), "menu mobile do staff não mostra Relatórios");
check(!linksMenu.includes("/orcamentos"), "menu mobile do staff não mostra Orçamentos");
check(linksMenu.includes("/clientes"), "menu mobile do staff mantém Clientes");
// E a rota continua bloqueada no servidor.
await ps.goto(`${BASE}/relatorios`, { waitUntil: "networkidle" });
check(ps.url().endsWith("/dashboard"), `staff redirecionado de /relatorios (${ps.url()})`);
await staff.close();

// ---------------------------------------------------------------------------
console.log("\n──────────────────────────────────────────");
if (fails.length === 0) {
  console.log("TODOS OS TESTES PASSARAM");
} else {
  console.log(`${fails.length} FALHA(S):`);
  fails.forEach((f) => console.log(`   - ${f}`));
}

await b.close();
process.exit(fails.length === 0 ? 0 : 1);
