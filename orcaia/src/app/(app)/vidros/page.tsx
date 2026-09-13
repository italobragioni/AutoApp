import { requireContext } from "@/lib/core/tenant";
import { prisma } from "@/lib/core/db";
import { formatCents } from "@/lib/core/format";
import { finishUnitLabel } from "@/lib/niches/vidracaria/options";
import {
  createGlassOption,
  deleteGlassOption,
  createFinishOption,
  deleteFinishOption,
  createHardwareOption,
  deleteHardwareOption,
} from "@/app/actions/vidracaria-catalog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/field";
import { Card, CardTitle } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import {
  GlassOptionForm,
  FinishOptionForm,
  HardwareOptionForm,
} from "@/components/forms/VidracariaForms";

export default async function VidrosPage() {
  const ctx = await requireContext();

  if (ctx.company.niche !== "vidracaria") {
    return (
      <>
        <PageHeader title="Vidros" />
        <EmptyState
          title="Módulo exclusivo de vidraçarias"
          description="Este catálogo aparece apenas para empresas do nicho Vidraçaria."
        />
      </>
    );
  }

  const companyId = ctx.company.id;
  const [glass, finishes, hardware] = await Promise.all([
    prisma.glassOption.findMany({ where: { companyId }, orderBy: [{ glassType: "asc" }, { thicknessMm: "asc" }] }),
    prisma.finishOption.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.hardwareOption.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Vidros"
        description="Preços de vidros, acabamentos e ferragens. Todos configuráveis pela empresa."
      />

      <div className="space-y-6">
        {/* Tipos de vidro / preço por m² */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle>Novo vidro (preço por m²)</CardTitle>
            <p className="mt-1 mb-3 text-sm text-ink-faint">
              Ex.: Temperado · 8 mm · R$ X/m². Você define o valor.
            </p>
            <GlassOptionForm action={createGlassOption} />
          </Card>
          <Card>
            <CardTitle>Vidros cadastrados</CardTitle>
            {glass.length === 0 ? (
              <p className="mt-3 text-sm text-ink-faint">Nenhum vidro cadastrado.</p>
            ) : (
              <ul className="mt-3 divide-y divide-surface-border">
                {glass.map((g) => (
                  <li key={g.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-ink">
                      {g.glassType} · {g.thicknessMm} mm
                      <span className="ml-2 text-ink-faint">{formatCents(g.pricePerM2Cents)}/m²</span>
                    </span>
                    <DeleteButton action={deleteGlassOption} id={g.id} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Acabamentos */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle>Novo acabamento</CardTitle>
            <p className="mt-1 mb-3 text-sm text-ink-faint">
              Ex.: Lapidado, Bisotê. Cobrança por metro linear, m² ou fixo.
            </p>
            <FinishOptionForm action={createFinishOption} />
          </Card>
          <Card>
            <CardTitle>Acabamentos cadastrados</CardTitle>
            {finishes.length === 0 ? (
              <p className="mt-3 text-sm text-ink-faint">Nenhum acabamento cadastrado.</p>
            ) : (
              <ul className="mt-3 divide-y divide-surface-border">
                {finishes.map((f) => (
                  <li key={f.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-ink">
                      {f.name}
                      <span className="ml-2 text-ink-faint">
                        {formatCents(f.priceCents)} · {finishUnitLabel(f.unit)}
                      </span>
                    </span>
                    <DeleteButton action={deleteFinishOption} id={f.id} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Ferragens */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle>Nova ferragem</CardTitle>
            <p className="mt-1 mb-3 text-sm text-ink-faint">
              Ex.: Dobradiça, Puxador, Roldana. Preço por unidade.
            </p>
            <HardwareOptionForm action={createHardwareOption} />
          </Card>
          <Card>
            <CardTitle>Ferragens cadastradas</CardTitle>
            {hardware.length === 0 ? (
              <p className="mt-3 text-sm text-ink-faint">Nenhuma ferragem cadastrada.</p>
            ) : (
              <ul className="mt-3 divide-y divide-surface-border">
                {hardware.map((h) => (
                  <li key={h.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-ink">
                      {h.name}
                      <span className="ml-2 text-ink-faint">{formatCents(h.priceCents)}/un</span>
                    </span>
                    <DeleteButton action={deleteHardwareOption} id={h.id} />
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
