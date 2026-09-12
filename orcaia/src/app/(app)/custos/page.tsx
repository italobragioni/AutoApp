import { requireContext } from "@/lib/core/tenant";
import { prisma } from "@/lib/core/db";
import { formatCents, formatBps } from "@/lib/core/format";
import { UNIT_LABELS, isUnit } from "@/lib/niches";
import {
  createLabor,
  deleteLabor,
  createAdditionalCost,
  deleteAdditionalCost,
} from "@/app/actions/catalog";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import { LaborForm, AdditionalCostForm } from "@/components/forms/CostForms";

export default async function CustosPage() {
  const ctx = await requireContext();
  const companyId = ctx.company.id;

  const [labor, costs] = await Promise.all([
    prisma.laborRate.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.additionalCost.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Custos"
        description="Mao de obra, deslocamento e outros custos usados nos orcamentos."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Mao de obra */}
        <div className="space-y-4">
          <Card>
            <CardTitle>Nova mao de obra</CardTitle>
            <div className="mt-3">
              <LaborForm action={createLabor} />
            </div>
          </Card>

          <Card>
            <CardTitle>Mao de obra cadastrada</CardTitle>
            {labor.length === 0 ? (
              <p className="mt-3 text-sm text-ink-faint">Nenhuma mao de obra cadastrada.</p>
            ) : (
              <ul className="mt-3 divide-y divide-surface-border">
                {labor.map((l) => (
                  <li key={l.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-ink">
                      {l.name}
                      <span className="ml-2 text-ink-faint">
                        {formatCents(l.rateCents)} / {isUnit(l.unit) ? UNIT_LABELS[l.unit] : l.unit}
                      </span>
                    </span>
                    <DeleteButton action={deleteLabor} id={l.id} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Custos adicionais */}
        <div className="space-y-4">
          <Card>
            <CardTitle>Novo custo adicional</CardTitle>
            <p className="mt-1 text-sm text-ink-faint">
              Ex.: deslocamento (fixo) ou taxa de projeto (percentual).
            </p>
            <div className="mt-3">
              <AdditionalCostForm action={createAdditionalCost} />
            </div>
          </Card>

          <Card>
            <CardTitle>Custos adicionais cadastrados</CardTitle>
            {costs.length === 0 ? (
              <p className="mt-3 text-sm text-ink-faint">Nenhum custo adicional cadastrado.</p>
            ) : (
              <ul className="mt-3 divide-y divide-surface-border">
                {costs.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-ink">
                      {c.name}
                      <span className="ml-2 text-ink-faint">
                        {c.kind === "fixo"
                          ? formatCents(c.amountCents ?? 0)
                          : formatBps(c.percentBps ?? 0)}
                      </span>
                    </span>
                    <DeleteButton action={deleteAdditionalCost} id={c.id} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
