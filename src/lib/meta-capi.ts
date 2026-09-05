import "server-only";

import { createHash } from "node:crypto";

/**
 * Meta Conversions API (server-side) — apenas para o evento Purchase.
 *
 * Por que server-side: a compra é confirmada pelo WEBHOOK da Cakto, quando não
 * há navegador ativo. Um Pixel de navegador não pode registrar essa conversão de
 * forma confiável. A Conversions API envia o evento direto do servidor.
 *
 * Segurança e robustez:
 *   - O token (META_CONVERSIONS_API_TOKEN) é secreto e vive só no servidor.
 *   - Sem token/ID configurados, a função é NO-OP (só registra um aviso) — o
 *     fluxo de pagamento e assinatura segue normal.
 *   - Nunca lança e tem timeout curto: falha aqui jamais afeta o webhook.
 *   - O e-mail vai HASHEADO (SHA-256), como a Meta exige. Nada de senha, token,
 *     cookie ou segredo é enviado.
 *
 * Deduplicação: o `event_id` é o id único do evento da Cakto (o mesmo usado na
 * idempotência do webhook). Se um dia houver também um Purchase pelo navegador,
 * a Meta deduplica os dois pelo mesmo event_id.
 */

const GRAPH_VERSION = "v21.0";
const TIMEOUT_MS = 4000;

function pixelId(): string | null {
  return (
    process.env.META_PIXEL_ID?.trim() ||
    process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ||
    null
  );
}

function accessToken(): string | null {
  return process.env.META_CONVERSIONS_API_TOKEN?.trim() || null;
}

function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export type PurchaseResult = { sent: boolean; reason?: string };

/**
 * Envia o evento Purchase pela Conversions API. Idempotente por `eventId`.
 */
export async function sendServerPurchase(opts: {
  eventId: string;
  value: number;
  currency?: string;
  email?: string | null;
}): Promise<PurchaseResult> {
  const id = pixelId();
  const token = accessToken();

  if (!id || !token) {
    console.info(
      "[meta] Purchase (Conversions API) não enviado: META_CONVERSIONS_API_TOKEN e/ou Pixel ID não configurados.",
    );
    return { sent: false, reason: "not_configured" };
  }

  const payload = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        // Chave de deduplicação (id do evento da Cakto).
        event_id: opts.eventId,
        custom_data: { value: opts.value, currency: opts.currency ?? "BRL" },
        user_data: opts.email ? { em: [sha256(opts.email)] } : {},
      },
    ],
    ...(process.env.META_TEST_EVENT_CODE
      ? { test_event_code: process.env.META_TEST_EVENT_CODE.trim() }
      : {}),
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${id}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      console.warn(`[meta] Purchase (Conversions API) falhou: HTTP ${res.status}.`);
      return { sent: false, reason: `http_${res.status}` };
    }
    console.info(`[meta] Purchase (Conversions API) enviado (event_id ${opts.eventId}).`);
    return { sent: true };
  } catch (error) {
    // Rede indisponível/timeout: não afeta o webhook nem a assinatura.
    console.warn("[meta] Purchase (Conversions API) não enviado (erro de rede/timeout).", error);
    return { sent: false, reason: "network" };
  }
}
