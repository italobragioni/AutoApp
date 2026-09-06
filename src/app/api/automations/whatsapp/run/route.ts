import { timingSafeEqual } from "node:crypto";

import { db } from "@/lib/db";
import { runAutomationsForCompany } from "@/lib/whatsapp/engine";

/**
 * Execução do Automation Engine sem depender de tela aberta.
 *
 * Feito para ser chamado por um cron (Vercel Cron envia
 * `Authorization: Bearer <CRON_SECRET>`) ou por um cron externo com o mesmo
 * cabeçalho. Protegido: sem CRON_SECRET configurado, recusa tudo (fail closed);
 * requisição sem o segredo correto recebe 401. Nunca é público.
 *
 * Percorre as empresas com WhatsApp CONECTADO e roda o motor de cada uma,
 * escopado por companyId. Nesta fase o provider é o mock — nenhuma mensagem real
 * sai. Nada aqui altera pagamento, assinatura, webhook ou isolamento.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Margem para processar várias empresas numa execução de cron.
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false; // fail closed
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const integrations = await db.whatsAppIntegration.findMany({
    where: { status: "connected" },
    select: { companyId: true },
  });

  // `force=1` (só autorizado) ignora a janela de horário — para execução manual
  // do admin e para testes deterministas. Nunca é público.
  const url = new URL(request.url);
  const enforceWindow = url.searchParams.get("force") !== "1";

  let companies = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const { companyId } of integrations) {
    try {
      const result = await runAutomationsForCompany(companyId, { enforceWindow });
      if (result.ran) {
        companies += 1;
        sent += result.sent;
        failed += result.failed;
        skipped += result.skipped;
      }
    } catch (error) {
      // Uma empresa com erro não pode derrubar a execução das demais.
      console.error(`[whatsapp] falha ao rodar automações da empresa ${companyId}:`, error);
    }
  }

  console.info(
    `[whatsapp] cron: ${companies} empresa(s), ${sent} enviada(s), ${failed} falha(s), ${skipped} ignorada(s).`,
  );
  return Response.json({ ok: true, companies, sent, failed, skipped }, { status: 200 });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
