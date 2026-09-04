import "server-only";

import { redirect } from "next/navigation";

import { CAKTO_EVENTS, type CaktoEvent } from "@/lib/cakto";
import { db } from "@/lib/db";

/**
 * Assinatura: a fonte de verdade do acesso operacional.
 *
 * O AUTOVOLT e um SaaS pago. Sem assinatura ativa da EMPRESA, ninguem opera —
 * dono ou funcionario, tanto faz. Este modulo responde a duas perguntas:
 *
 *   1. Esta empresa pode operar agora?  (hasOperationalAccess / companyHasAccess)
 *   2. Como um evento valido da Cakto muda o estado da assinatura? (applyCaktoEvent)
 *
 * O status so muda por aqui — chamado por uma action autenticada (que cria a
 * linha PENDENTE ao iniciar o checkout) ou pelo processamento de um webhook
 * autenticado. O navegador nunca escreve status.
 */

export const SUBSCRIPTION_STATUS = {
  pending: "pending",
  active: "active",
  pastDue: "past_due",
  canceled: "canceled",
  expired: "expired",
} as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];

/** Recusa unica quando a action operacional roda sem assinatura ativa. */
export const SUBSCRIPTION_REQUIRED =
  "Esta empresa não tem uma assinatura ativa. Regularize em Assinatura para continuar.";

export const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando pagamento",
  active: "Ativa",
  past_due: "Pagamento pendente",
  canceled: "Cancelada",
  expired: "Expirada",
};

/** Forma minima usada para decidir acesso — o que qualquer chamador precisa. */
export type AccessView = {
  status: string;
  currentPeriodEnd: Date | null;
} | null;

/**
 * A empresa pode operar?
 *
 *   active   — acesso enquanto o periodo pago valer (ou se nao houver periodo
 *              informado, em que a Cakto nao mandou data e nao inventamos uma).
 *   canceled — acesso ate o fim do periodo JA pago. Cancelar nao apaga nada nem
 *              corta na hora: respeita o que o cliente pagou.
 *   demais   — sem acesso (pending, past_due, expired).
 */
export function hasOperationalAccess(sub: AccessView): boolean {
  if (!sub) return false;
  const now = new Date();
  const end = sub.currentPeriodEnd;

  if (sub.status === SUBSCRIPTION_STATUS.active) {
    if (end && end.getTime() <= now.getTime()) return false;
    return true;
  }

  if (sub.status === SUBSCRIPTION_STATUS.canceled) {
    return Boolean(end && end.getTime() > now.getTime());
  }

  return false;
}

/** Carrega a assinatura de uma empresa (ou null). */
export async function getSubscription(companyId: string) {
  return db.subscription.findUnique({ where: { companyId } });
}

/** Atalho: a empresa tem acesso operacional agora? Uma consulta so. */
export async function companyHasAccess(companyId: string): Promise<boolean> {
  const sub = await db.subscription.findUnique({
    where: { companyId },
    select: { status: true, currentPeriodEnd: true },
  });
  return hasOperationalAccess(sub);
}

/**
 * Trava de assinatura para paginas/layout. Redireciona para /assinatura quando a
 * empresa da sessao nao tem acesso. NAO valida sessao — quem chama ja passou por
 * requireContext (o layout da area logada faz isso).
 */
export async function requireActiveSubscription(companyId: string): Promise<void> {
  if (!(await companyHasAccess(companyId))) redirect("/assinatura");
}

// -------------------------------------------------------------------------
// Processamento de eventos da Cakto
// -------------------------------------------------------------------------

export type ApplyResult = { result: "processed" | "ignored" | "error"; companyId: string | null };

/**
 * Encontra a assinatura que um evento deve atingir, do criterio mais forte ao
 * mais fraco. NUNCA adivinha uma empresa quando ha ambiguidade — prefere deixar
 * pendente a vincular a errada.
 *
 *   1. checkoutRef — a referencia que geramos e enviamos ao checkout. Definitiva.
 *   2. caktoSubscriptionId — para renovacoes/cancelamentos de uma assinatura ja
 *      vinculada.
 *   3. e-mail do dono, entre as PENDENTES — so quando ha exatamente uma. Fallback
 *      para o caso de o parametro de rastreamento nao voltar no webhook.
 */
async function resolveSubscription(event: CaktoEvent) {
  if (event.ref) {
    const byRef = await db.subscription.findUnique({ where: { checkoutRef: event.ref } });
    if (byRef) return byRef;
  }

  if (event.caktoSubscriptionId) {
    const bySub = await db.subscription.findUnique({
      where: { caktoSubscriptionId: event.caktoSubscriptionId },
    });
    if (bySub) return bySub;
  }

  if (event.customerEmail) {
    const pendings = await db.subscription.findMany({
      where: {
        status: SUBSCRIPTION_STATUS.pending,
        company: {
          memberships: { some: { role: "owner", user: { email: event.customerEmail } } },
        },
      },
      take: 2,
    });
    if (pendings.length === 1) return pendings[0];
  }

  return null;
}

/** Campos a gravar conforme o tipo de evento. */
function statusPatch(event: CaktoEvent): {
  status: SubscriptionStatus;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  canceledAt?: Date | null;
} {
  const now = new Date();

  switch (event.type) {
    case CAKTO_EVENTS.purchaseApproved:
    case CAKTO_EVENTS.subscriptionCreated:
    case CAKTO_EVENTS.subscriptionRenewed:
      return {
        status: SUBSCRIPTION_STATUS.active,
        // So grava periodo quando a Cakto informou — nunca inventamos datas.
        ...(event.periodStart ? { currentPeriodStart: event.periodStart } : {}),
        ...(event.periodEnd ? { currentPeriodEnd: event.periodEnd } : {}),
        canceledAt: null,
      };

    case CAKTO_EVENTS.subscriptionCanceled:
      // Cancela, mas preserva o periodo pago: o acesso segue ate currentPeriodEnd.
      return {
        status: SUBSCRIPTION_STATUS.canceled,
        canceledAt: event.canceledAt ?? now,
      };

    case CAKTO_EVENTS.subscriptionRenewalRefused:
      // Renovacao falhou: acesso termina quando o periodo vigente lapsar.
      return { status: SUBSCRIPTION_STATUS.pastDue };

    case CAKTO_EVENTS.refund:
    case CAKTO_EVENTS.chargeback:
      // Reembolso/chargeback revoga o acesso imediatamente — mas nao apaga dados.
      return {
        status: SUBSCRIPTION_STATUS.canceled,
        canceledAt: now,
        currentPeriodEnd: now,
      };

    default:
      return { status: SUBSCRIPTION_STATUS.pending };
  }
}

/**
 * Aplica um evento normalizado a assinatura correspondente.
 *
 * A idempotencia (nao aplicar o mesmo evento duas vezes) e responsabilidade do
 * endpoint, via WebhookEvent.externalId. Aqui a operacao ja e, por si, segura de
 * repetir: e um update de status/periodo por empresa, nao um insert que
 * acumula.
 */
export async function applyCaktoEvent(event: CaktoEvent): Promise<ApplyResult> {
  const known = (Object.values(CAKTO_EVENTS) as string[]).includes(event.type);
  if (!known) return { result: "ignored", companyId: null };

  const sub = await resolveSubscription(event);
  if (!sub) return { result: "ignored", companyId: null };

  const patch = statusPatch(event);

  // Espelha ids da Cakto sem sobrescrever com nulos nem "roubar" um contrato de
  // outra empresa (caktoSubscriptionId e @unique).
  const mirror: Record<string, string> = {};
  if (event.caktoCustomerId && !sub.caktoCustomerId) mirror.caktoCustomerId = event.caktoCustomerId;
  if (event.caktoProductId) mirror.caktoProductId = event.caktoProductId;
  if (event.caktoSubscriptionId && !sub.caktoSubscriptionId) {
    mirror.caktoSubscriptionId = event.caktoSubscriptionId;
  }

  try {
    await db.subscription.update({
      where: { id: sub.id },
      data: { ...patch, ...mirror },
    });
  } catch (error) {
    console.error("[cakto] falha ao aplicar evento à assinatura:", error);
    return { result: "error", companyId: sub.companyId };
  }

  return { result: "processed", companyId: sub.companyId };
}
