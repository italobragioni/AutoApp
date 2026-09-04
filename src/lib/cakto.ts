import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import type { Plan } from "@/lib/plans";

/**
 * Integracao com a Cakto — o processador de pagamentos do AUTOVOLT.
 *
 * Este modulo concentra tudo que fala "cakto": a validacao do webhook, a
 * montagem da URL de checkout hospedado e a leitura (tolerante) do corpo dos
 * eventos. Nenhuma regra de acesso mora aqui — isso e src/lib/subscription.ts.
 *
 * Duas decisoes importantes:
 *
 *   1. Validacao por SECRET no corpo. A Cakto envia um campo `secret` no JSON do
 *      webhook, configurado no painel dela. A validacao compara esse valor com
 *      CAKTO_WEBHOOK_SECRET em tempo constante. Sem secret configurado, o
 *      endpoint recusa tudo (fail closed) — nunca processa um webhook nao
 *      autenticado.
 *
 *   2. Leitura tolerante. Os payloads variam entre eventos (compra unica x
 *      assinatura). Em vez de assumir um formato rigido, os extratores procuram
 *      cada dado nos caminhos conhecidos e seguem em frente quando um campo nao
 *      vem — nunca inventamos valores (datas, principalmente).
 *
 * Os nomes exatos de alguns campos (em especial o parametro de rastreamento que
 * volta no webhook e os campos de periodo da assinatura) devem ser conferidos
 * com um webhook de teste real da Cakto antes de ir a producao. O codigo foi
 * escrito para funcionar com os nomes documentados e para degradar com
 * seguranca (assinatura fica PENDENTE) se algum vier diferente.
 */

/** sandbox | production — separa credenciais e evita misturar eventos. */
export function caktoEnvironment(): "sandbox" | "production" {
  const raw = process.env.CAKTO_ENVIRONMENT?.trim().toLowerCase();
  return raw === "production" ? "production" : "sandbox";
}

// -------------------------------------------------------------------------
// Eventos
// -------------------------------------------------------------------------

/**
 * Eventos que o AUTOVOLT trata. Os nomes seguem a documentacao da Cakto. Um
 * evento fora desta lista e recebido, registrado e ignorado — nunca derruba o
 * endpoint.
 */
export const CAKTO_EVENTS = {
  purchaseApproved: "purchase_approved",
  subscriptionCreated: "subscription_created",
  subscriptionRenewed: "subscription_renewed",
  subscriptionCanceled: "subscription_canceled",
  subscriptionRenewalRefused: "subscription_renewal_refused",
  refund: "refund",
  chargeback: "chargeback",
} as const;

export type CaktoEventType = (typeof CAKTO_EVENTS)[keyof typeof CAKTO_EVENTS];

/** Dados que o AUTOVOLT precisa de um evento, ja normalizados. */
export type CaktoEvent = {
  type: string;
  /** Id do dado na Cakto (data.id). Base da idempotencia. */
  dataId: string | null;
  /** Nossa referencia de checkout, se voltou no evento. Correlacao primaria. */
  ref: string | null;
  customerEmail: string | null;
  caktoCustomerId: string | null;
  caktoSubscriptionId: string | null;
  caktoProductId: string | null;
  /** Inicio/fim do periodo pago, se a Cakto informar. Nunca inventado. */
  periodStart: Date | null;
  periodEnd: Date | null;
  canceledAt: Date | null;
};

type Json = Record<string, unknown>;

function asObject(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return null;
}

/** Le uma data ISO com tolerancia. Datas invalidas viram null — nunca inventadas. */
function asDate(value: unknown): Date | null {
  const s = asString(value);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Primeiro valor de texto encontrado entre varios caminhos possiveis. */
function firstString(obj: Json | null, keys: string[]): string | null {
  if (!obj) return null;
  for (const key of keys) {
    const v = asString(obj[key]);
    if (v) return v;
  }
  return null;
}

/**
 * Procura a nossa referencia de checkout (parametro de rastreamento) nos lugares
 * onde a Cakto pode devolve-la. Best-effort: se nao vier, a correlacao cai para
 * os proximos criterios (assinatura ja vinculada, e-mail do dono).
 */
function extractRef(body: Json, data: Json | null): string | null {
  const tracking = asObject(data?.["tracking"]) ?? asObject(data?.["utm"]) ?? null;
  const checkout = asObject(data?.["checkout"]) ?? null;
  return (
    firstString(data, ["src", "sck", "ref", "reference", "external_reference"]) ??
    firstString(tracking, ["src", "sck", "ref"]) ??
    firstString(checkout, ["src", "sck", "ref"]) ??
    firstString(body, ["src", "sck", "ref"])
  );
}

/**
 * Normaliza o corpo cru de um webhook nos dados que o processamento precisa.
 * Nunca lanca: um campo ausente vira null.
 */
export function normalizeEvent(body: unknown): CaktoEvent | null {
  const root = asObject(body);
  if (!root) return null;

  const type = asString(root["event"]);
  if (!type) return null;

  const data = asObject(root["data"]);
  const customer = asObject(data?.["customer"]);
  const product = asObject(data?.["product"]);
  const subscription = asObject(data?.["subscription"]);

  return {
    type,
    dataId: firstString(data, ["id", "transaction", "refId"]),
    ref: extractRef(root, data),
    customerEmail: firstString(customer, ["email"])?.toLowerCase() ?? null,
    caktoCustomerId: firstString(customer, ["id", "customer_id"]),
    caktoSubscriptionId: firstString(subscription, ["id", "subscription_id", "code"]),
    caktoProductId: firstString(product, ["id", "short_id", "product_id"]),
    periodStart: asDate(subscription?.["current_period_start"] ?? subscription?.["startedAt"]),
    periodEnd: asDate(
      subscription?.["next_payment_date"] ??
        subscription?.["current_period_end"] ??
        subscription?.["expiresAt"],
    ),
    canceledAt: asDate(subscription?.["canceledAt"] ?? data?.["canceledAt"]),
  };
}

// -------------------------------------------------------------------------
// Validacao do webhook
// -------------------------------------------------------------------------

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export type WebhookAuth =
  | { ok: true }
  | { ok: false; reason: "sem_secret_configurado" | "secret_invalido" };

/**
 * Autentica o webhook comparando o `secret` do corpo com CAKTO_WEBHOOK_SECRET.
 *
 * Fail closed: sem a env configurada, todo webhook e recusado. E melhor uma
 * assinatura ficar pendente do que liberar acesso a partir de um evento que nao
 * conseguimos provar que veio da Cakto.
 */
export function authenticateWebhook(body: unknown): WebhookAuth {
  const configured = process.env.CAKTO_WEBHOOK_SECRET?.trim();
  if (!configured) return { ok: false, reason: "sem_secret_configurado" };

  const root = asObject(body);
  const received = root ? asString(root["secret"]) : null;
  if (!received || !safeEqual(received, configured)) {
    return { ok: false, reason: "secret_invalido" };
  }
  return { ok: true };
}

// -------------------------------------------------------------------------
// Checkout
// -------------------------------------------------------------------------

/**
 * Monta a URL do checkout hospedado da Cakto para um plano.
 *
 * Anexa `src` com a nossa referencia segura (para reconhecer a empresa quando o
 * webhook chegar) e pre-preenche nome/e-mail do usuario para agilizar. Nenhum
 * segredo vai na URL — so a referencia opaca e dados que o proprio usuario ja
 * digitaria no checkout.
 */
export function buildCheckoutUrl(
  plan: Plan,
  opts: { ref: string; email?: string; name?: string },
): string | null {
  if (!plan.checkoutBaseUrl) return null;

  let url: URL;
  try {
    url = new URL(plan.checkoutBaseUrl);
  } catch {
    return null;
  }

  url.searchParams.set("src", opts.ref);
  if (opts.email) url.searchParams.set("email", opts.email);
  if (opts.name) url.searchParams.set("name", opts.name);

  return url.toString();
}

/** SHA-256 do corpo cru — auditoria de reentregas sem guardar o conteudo. */
export function digestPayload(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
