import { requireContext } from "@/lib/core/tenant";
import { prisma } from "@/lib/core/db";
import { formatCents, formatDate } from "@/lib/core/format";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/field";

// Rotulos e ordem do funil de status. Fonte unica para exibicao.
const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
  expirado: "Expirado",
  cancelado: "Cancelado",
};

export default async function OrcamentosPage() {
  const ctx = await requireContext();

  const quotes = await prisma.quote.findMany({
    where: { companyId: ctx.company.id },
    include: { customer: { select: { name: true } } },
    orderBy: { number: "desc" },
    take: 100,
  });

  return (
    <>
      <PageHeader
        title="Orcamentos"
        description="Funil de propostas: rascunho, enviado, aprovado."
      />

      {quotes.length === 0 ? (
        <EmptyState
          title="Nenhum orcamento ainda"
          description="A criacao de orcamentos com itens por nicho entra na proxima etapa."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-surface-border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-surface-soft text-left text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-medium">N</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Validade</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} className="border-t border-surface-border">
                  <td className="px-4 py-3 text-ink">#{q.number}</td>
                  <td className="px-4 py-3 text-ink">{q.customer.name}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {STATUS_LABELS[q.status] ?? q.status}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {q.validUntil ? formatDate(q.validUntil) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-ink">
                    {formatCents(q.totalCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
