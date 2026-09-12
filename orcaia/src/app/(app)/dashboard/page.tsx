import { requireContext } from "@/lib/core/tenant";
import { prisma } from "@/lib/core/db";
import { formatCents } from "@/lib/core/format";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default async function DashboardPage() {
  const ctx = await requireContext();
  const companyId = ctx.company.id;

  // Agregacoes basicas do funil de orcamentos. Tudo escopado por companyId.
  const [byStatus, aprovados, clientes] = await Promise.all([
    prisma.quote.groupBy({
      by: ["status"],
      where: { companyId },
      _count: { _all: true },
    }),
    prisma.quote.aggregate({
      where: { companyId, status: "aprovado" },
      _sum: { totalCents: true },
    }),
    prisma.customer.count({ where: { companyId } }),
  ]);

  const total = byStatus.reduce((s, r) => s + r._count._all, 0);
  const count = (status: string) =>
    byStatus.find((r) => r.status === status)?._count._all ?? 0;

  const cards = [
    { title: "Orcamentos", value: String(total) },
    { title: "Rascunhos", value: String(count("rascunho")) },
    { title: "Enviados", value: String(count("enviado")) },
    { title: "Aprovados", value: String(count("aprovado")) },
    { title: "Clientes", value: String(clientes) },
    { title: "Valor aprovado", value: formatCents(aprovados._sum.totalCents ?? 0) },
  ];

  return (
    <>
      <PageHeader
        title={`Ola, ${ctx.user.name.split(" ")[0]}`}
        description="Visao geral da sua operacao de orcamentos."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardTitle className="text-ink-faint">{c.title}</CardTitle>
            <p className="mt-2 text-2xl font-bold text-ink">{c.value}</p>
          </Card>
        ))}
      </div>
    </>
  );
}
