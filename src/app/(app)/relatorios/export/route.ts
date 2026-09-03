import type { NextRequest } from "next/server";

import { csvFileName, reportToCsv } from "@/lib/csv";
import { can } from "@/lib/permissions";
import { buildReport, resolvePeriod } from "@/lib/reports";
import { getCurrentContext } from "@/lib/tenant";

/**
 * Exportacao do relatorio em CSV.
 *
 * E uma rota, e nao um botao que monta o arquivo no navegador, justamente para
 * a checagem acontecer aqui: chamar a URL direto passa pelas mesmas travas que
 * a tela.
 *
 *   sem sessao          -> 401
 *   sem reports.finance -> 403
 *   com permissao       -> CSV da empresa DA SESSAO, no periodo pedido
 *
 * A empresa nunca vem da URL. Os unicos parametros aceitos sao os do periodo,
 * e `resolvePeriod` valida cada um deles.
 */
export async function GET(request: NextRequest) {
  const context = await getCurrentContext();
  if (!context) {
    return new Response("Não autenticado.", { status: 401 });
  }

  // A mesma permissao que protege a pagina. Sem ela, nao ha arquivo.
  if (!can(context.role, "reports.finance")) {
    return new Response("Você não tem permissão para exportar relatórios.", { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const period = resolvePeriod({
    periodo: params.get("periodo") ?? undefined,
    de: params.get("de") ?? undefined,
    ate: params.get("ate") ?? undefined,
  });

  const report = await buildReport(context.company.id, period);
  const csv = reportToCsv(report, context.company.name);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFileName(report)}"`,
      // Relatorio e sempre do instante em que foi pedido.
      "Cache-Control": "no-store",
    },
  });
}
