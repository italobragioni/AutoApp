import Link from "next/link";
import { Pencil } from "lucide-react";
import { requireContext } from "@/lib/core/tenant";
import { prisma } from "@/lib/core/db";
import { formatCents, formatBps } from "@/lib/core/format";
import { areaModeLabel } from "@/lib/niches/marcenaria/options";
import {
  createWoodMaterial,
  deleteWoodMaterial,
  createWoodFinish,
  deleteWoodFinish,
  createWoodHardware,
  deleteWoodHardware,
  createWoodTemplate,
  deleteWoodTemplate,
} from "@/app/actions/marcenaria-catalog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/field";
import { Card, CardTitle } from "@/components/ui/card";
import { DeleteButton } from "@/components/ui/delete-button";
import {
  WoodMaterialForm,
  WoodFinishForm,
  WoodHardwareForm,
  WoodTemplateForm,
} from "@/components/forms/MarcenariaForms";

export default async function MarcenariaPage() {
  const ctx = await requireContext();

  if (ctx.company.niche !== "marcenaria") {
    return (
      <>
        <PageHeader title="Marcenaria" />
        <EmptyState title="Módulo exclusivo de marcenarias" description="Este catálogo aparece apenas para o nicho Marcenaria." />
      </>
    );
  }

  const companyId = ctx.company.id;
  const [materials, finishes, hardware, templates] = await Promise.all([
    prisma.woodMaterial.findMany({ where: { companyId }, orderBy: [{ name: "asc" }, { thicknessMm: "asc" }] }),
    prisma.woodFinish.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.woodHardware.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.woodTemplate.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
  ]);

  const materialOptions = materials.map((m) => ({ id: m.id, label: `${m.name} ${m.thicknessMm}mm` }));
  const finishOptions = finishes.map((f) => ({ id: f.id, label: f.name }));
  const hardwareList = hardware.map((h) => ({ id: h.id, name: h.name, priceLabel: `${formatCents(h.priceCents)}/un` }));

  return (
    <>
      <PageHeader
        title="Marcenaria"
        description="Materiais, acabamentos, ferragens e modelos de produto. Tudo configurável pela empresa."
      />

      <div className="space-y-6">
        {/* Materiais */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle>Novo material (preço por m²)</CardTitle>
            <p className="mt-1 mb-3 text-sm text-ink-faint">MDF, MDP, Compensado… por espessura.</p>
            <WoodMaterialForm action={createWoodMaterial} />
          </Card>
          <Card>
            <CardTitle>Materiais cadastrados</CardTitle>
            {materials.length === 0 ? (
              <p className="mt-3 text-sm text-ink-faint">Nenhum material cadastrado.</p>
            ) : (
              <ul className="mt-3 divide-y divide-surface-border">
                {materials.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-ink">{m.name} · {m.thicknessMm} mm <span className="ml-1 text-ink-faint">{formatCents(m.pricePerM2Cents)}/m²</span></span>
                    <DeleteButton action={deleteWoodMaterial} id={m.id} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Acabamentos + Ferragens */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle>Novo acabamento</CardTitle>
            <div className="mt-3"><WoodFinishForm action={createWoodFinish} /></div>
            {finishes.length > 0 ? (
              <ul className="mt-4 divide-y divide-surface-border border-t border-surface-border pt-2">
                {finishes.map((f) => (
                  <li key={f.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-ink">{f.name} <span className="ml-1 text-ink-faint">{formatCents(f.pricePerM2Cents)}/m²</span></span>
                    <DeleteButton action={deleteWoodFinish} id={f.id} />
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
          <Card>
            <CardTitle>Nova ferragem</CardTitle>
            <div className="mt-3"><WoodHardwareForm action={createWoodHardware} /></div>
            {hardware.length > 0 ? (
              <ul className="mt-4 divide-y divide-surface-border border-t border-surface-border pt-2">
                {hardware.map((h) => (
                  <li key={h.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="text-ink">{h.name} <span className="ml-1 text-ink-faint">{formatCents(h.priceCents)}/un</span></span>
                    <DeleteButton action={deleteWoodHardware} id={h.id} />
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </div>

        {/* Modelos de produto */}
        <Card>
          <CardTitle>Novo modelo de produto</CardTitle>
          <p className="mt-1 mb-3 text-sm text-ink-faint">
            Modelos aceleram o orçamento (ex.: Guarda-roupa, Painel de TV). Definem material, acabamento, ferragens, mão de obra e montagem.
          </p>
          <WoodTemplateForm
            action={createWoodTemplate}
            materials={materialOptions}
            finishes={finishOptions}
            hardware={hardwareList}
          />
        </Card>

        <Card>
          <CardTitle>Modelos cadastrados</CardTitle>
          {templates.length === 0 ? (
            <p className="mt-3 text-sm text-ink-faint">Nenhum modelo cadastrado.</p>
          ) : (
            <ul className="mt-3 divide-y divide-surface-border">
              {templates.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-ink">
                    {t.name}
                    {t.category ? <span className="ml-1 text-ink-faint">· {t.category}</span> : null}
                    <span className="ml-2 text-ink-faint">{areaModeLabel(t.areaMode).split(" ")[0]} · margem {formatBps(t.marginBps)}</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <Link href={`/marcenaria/${t.id}`} className="rounded-lg p-2 text-ink-faint hover:bg-surface-soft hover:text-ink" aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </Link>
                    <DeleteButton action={deleteWoodTemplate} id={t.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
