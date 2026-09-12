import { requireContext } from "@/lib/core/tenant";
import { prisma } from "@/lib/core/db";
import { formatBps } from "@/lib/core/format";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export default async function PrecosPage() {
  const ctx = await requireContext();
  const companyId = ctx.company.id;

  const [priceTables, additionalCosts, company] = await Promise.all([
    prisma.priceTable.findMany({
      where: { companyId },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.additionalCost.count({ where: { companyId } }),
    prisma.company.findUnique({
      where: { id: companyId },
      select: { defaultMarginBps: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Precos"
        description="Tabelas de preco, custos adicionais e margem padrao."
      />

      <Card>
        <CardTitle className="text-ink-faint">Margem de lucro padrao</CardTitle>
        <p className="mt-2 text-2xl font-bold text-ink">
          {formatBps(company?.defaultMarginBps ?? 0)}
        </p>
        <p className="mt-1 text-sm text-ink-faint">
          Aplicada por padrao a novos orcamentos (ajustavel em Configuracoes).
        </p>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardTitle>Tabelas de preco</CardTitle>
          <ul className="mt-3 space-y-2">
            {priceTables.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-lg bg-surface-soft px-3 py-2 text-sm"
              >
                <span className="font-medium text-ink">
                  {t.name}
                  {t.isDefault ? (
                    <span className="ml-2 rounded bg-brand-muted px-1.5 py-0.5 text-xs text-brand">
                      padrao
                    </span>
                  ) : null}
                </span>
                <span className="text-ink-faint">{t._count.items} itens</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardTitle>Custos adicionais</CardTitle>
          <p className="mt-2 text-2xl font-bold text-ink">{additionalCosts}</p>
          <p className="mt-1 text-sm text-ink-faint">
            Frete, deslocamento, taxa de projeto — fixos ou percentuais.
          </p>
        </Card>
      </div>
    </>
  );
}
