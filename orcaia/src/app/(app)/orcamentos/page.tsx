import Link from "next/link";
import { Plus } from "lucide-react";
import { requireContext } from "@/lib/core/tenant";
import { prisma } from "@/lib/core/db";
import { formatCents, formatDate } from "@/lib/core/format";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

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

  if (ctx.company.niche !== "vidracaria") {
    return (
      <>
        <PageHeader title="Orçamentos" />
        <EmptyState
          title="Módulo exclusivo de vidraçarias"
          description="A composição de orçamentos por peça de vidro aparece apenas para o nicho Vidraçaria."
        />
      </>
    );
  }

  const quotes = await prisma.quote.findMany({
    where: { companyId: ctx.company.id },
    include: { customer: { select: { name: true } } },
    orderBy: { number: "desc" },
    take: 200,
  });

  return (
    <>
      <PageHeader
        title="Orçamentos"
        description="Funil de propostas com composição por peça de vidro."
        action={
          <Link href="/orcamentos/novo">
            <Button>
              <Plus className="h-4 w-4" /> Novo orçamento
            </Button>
          </Link>
        }
      />

      {quotes.length === 0 ? (
        <EmptyState
          title="Nenhum orçamento ainda"
          description="Clique em 'Novo orçamento' para montar a primeira proposta."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-surface-border bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface-soft text-left text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-medium">Nº</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Validade</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} className="border-t border-surface-border hover:bg-surface-soft">
                  <td className="px-4 py-3">
                    <Link href={`/orcamentos/${q.id}`} className="font-medium text-brand">
                      #{q.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink">{q.customer.name}</td>
                  <td className="px-4 py-3 text-ink-soft">{STATUS_LABELS[q.status] ?? q.status}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {q.validUntil ? formatDate(q.validUntil) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-ink">{formatCents(q.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
