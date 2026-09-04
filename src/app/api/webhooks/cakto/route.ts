import { authenticateWebhook, digestPayload, normalizeEvent } from "@/lib/cakto";
import { db } from "@/lib/db";
import { applyCaktoEvent } from "@/lib/subscription";

/**
 * Webhook da Cakto — a unica fonte de verdade para liberar acesso.
 *
 * O acesso NUNCA e liberado pela URL de retorno do checkout nem por um parametro
 * do navegador. So um evento que chega aqui, autenticado, muda o status de uma
 * assinatura.
 *
 * Ordem de trabalho:
 *   1. Le o corpo cru (precisamos dele intacto para autenticar e para o digest).
 *   2. Autentica pelo `secret` do corpo (src/lib/cakto.ts). Sem prova de origem,
 *      recusa — fail closed.
 *   3. Normaliza o evento.
 *   4. Idempotencia: se o externalId ja foi processado, responde 200 e para.
 *   5. Aplica o evento a assinatura correspondente e registra o resultado.
 *
 * Responde rapido e sempre com um status claro — a Cakto espera resposta em
 * poucos segundos, senao reenvia (e a idempotencia cobre o reenvio).
 */

// Handler dinamico: nunca cacheado, roda no runtime Node (usa crypto/Prisma).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const raw = await request.text();

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    console.warn("[cakto] webhook ignorado: corpo não é JSON válido.");
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const auth = authenticateWebhook(body);
  if (!auth.ok) {
    // Log tecnico sem vazar o secret nem o corpo.
    console.warn(`[cakto] webhook recusado: ${auth.reason}.`);
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const event = normalizeEvent(body);
  if (!event) {
    console.warn("[cakto] webhook autenticado, mas sem campo de evento — ignorado.");
    return Response.json({ ok: true, result: "ignored" }, { status: 200 });
  }

  // Chave de deduplicacao. Usa o id do dado; se faltar, o digest do corpo — uma
  // reentrega identica cai no mesmo externalId de qualquer forma.
  const externalId = `${event.type}:${event.dataId ?? digestPayload(raw)}`;

  const already = await db.webhookEvent.findUnique({ where: { externalId } });
  if (already) {
    console.info(`[cakto] evento ${event.type} reentregue — já processado, ignorado.`);
    return Response.json({ ok: true, result: "duplicate" }, { status: 200 });
  }

  const applied = await applyCaktoEvent(event);

  try {
    await db.webhookEvent.create({
      data: {
        externalId,
        event: event.type,
        result: applied.result,
        companyId: applied.companyId ?? undefined,
        payloadDigest: digestPayload(raw),
      },
    });
  } catch {
    // Corrida com uma reentrega simultanea: o externalId unico ja foi gravado.
    // Aplicar o mesmo evento de novo e seguro (update idempotente), entao ok.
    console.info(`[cakto] evento ${event.type} já registrado em paralelo — ok.`);
  }

  console.info(
    `[cakto] evento ${event.type} → ${applied.result}` +
      (applied.companyId ? ` (empresa ${applied.companyId})` : " (empresa não resolvida)"),
  );

  return Response.json({ ok: true, result: applied.result }, { status: 200 });
}
