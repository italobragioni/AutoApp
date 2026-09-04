/**
 * Ajudantes de assinatura para os testes.
 *
 * O AUTOVOLT e pago: sem assinatura ativa a empresa cai na tela /assinatura. Os
 * testes das outras funcionalidades nao testam pagamento — entao ativam a
 * assinatura direto no banco (como o webhook da Cakto faria) e seguem para o que
 * de fato querem verificar.
 *
 * As credenciais de demonstracao deixaram de ser pre-preenchidas na tela, entao
 * `login()` sempre digita e-mail e senha.
 */

const TRINTA_DIAS = 30 * 24 * 60 * 60 * 1000;

/** Ativa (ou renova) a assinatura da empresa do dono com este e-mail. */
export async function ativarAssinatura(db, email) {
  const company = await db.company.findFirst({
    where: { memberships: { some: { role: "owner", user: { email } } } },
    select: { id: true },
  });
  if (!company) throw new Error(`empresa do dono ${email} não encontrada`);

  const currentPeriodEnd = new Date(Date.now() + TRINTA_DIAS);
  await db.subscription.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      plan: "professional",
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd,
    },
    update: { status: "active", currentPeriodEnd, canceledAt: null },
  });
  return company.id;
}

/** Login pela tela, digitando as credenciais (a tela não pré-preenche mais). */
export async function login(page, base, email, senha) {
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 20000 });
}
