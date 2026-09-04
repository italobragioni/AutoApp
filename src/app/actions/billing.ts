"use server";

import { randomBytes } from "node:crypto";

import { redirect } from "next/navigation";

import { permit } from "@/lib/authorize";
import { buildCheckoutUrl } from "@/lib/cakto";
import { db } from "@/lib/db";
import { DEFAULT_PLAN_ID, defaultPlan, getPlan } from "@/lib/plans";

export type BillingState = { error?: string } | undefined;

/**
 * Inicia o checkout da Cakto para a empresa da sessao.
 *
 * Tudo acontece no servidor:
 *
 *   - Autoriza por `billing.manage` (so o dono), SEM exigir assinatura ativa —
 *     seria um beco sem saida pedir assinatura para poder assinar.
 *   - Gera uma referencia opaca e a grava na assinatura (linha PENDENTE). E por
 *     ela que o webhook vai reconhecer, com certeza, qual empresa pagou — nunca
 *     confiamos em companyId ou e-mail vindos do navegador.
 *   - Monta a URL do checkout hospedado e redireciona. Nenhum segredo vai para o
 *     cliente: a chave da Cakto e o secret do webhook ficam no servidor.
 *
 * O acesso operacional NAO e liberado aqui: so o webhook de pagamento aprovado
 * muda o status para ACTIVE.
 */
export async function startCheckoutAction(
  _state: BillingState,
  formData: FormData,
): Promise<BillingState> {
  const gate = await permit("billing.manage", { subscription: false });
  if (!gate.ok) return { error: gate.error };
  const { company, user } = gate;

  const planId = String(formData.get("plan") ?? DEFAULT_PLAN_ID);
  const plan = getPlan(planId) ?? defaultPlan();

  if (!plan.checkoutBaseUrl) {
    return {
      error: "O checkout ainda não está configurado. Fale com o administrador da plataforma.",
    };
  }

  // Referencia segura, gerada e guardada pelo backend.
  const ref = randomBytes(24).toString("base64url");

  await db.subscription.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      plan: plan.id,
      status: "pending",
      checkoutRef: ref,
      ...(plan.caktoProductId ? { caktoProductId: plan.caktoProductId } : {}),
    },
    // Novo checkout: renova a referencia e o plano escolhido. NAO mexe no status —
    // se ja estiver ativa, quem muda isso e sempre o webhook.
    update: {
      checkoutRef: ref,
      plan: plan.id,
      ...(plan.caktoProductId ? { caktoProductId: plan.caktoProductId } : {}),
    },
  });

  const url = buildCheckoutUrl(plan, { ref, email: user.email, name: user.name });
  if (!url) {
    return { error: "Não foi possível montar o checkout. Tente novamente em instantes." };
  }

  // Redireciona para o checkout hospedado da Cakto (fora do try: redirect lanca).
  redirect(url);
}
