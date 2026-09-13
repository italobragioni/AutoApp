import { notFound } from "next/navigation";
import { requireContext } from "@/lib/core/tenant";
import { prisma } from "@/lib/core/db";
import { formatCents } from "@/lib/core/format";
import { updateWoodTemplate } from "@/app/actions/marcenaria-catalog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { WoodTemplateForm } from "@/components/forms/MarcenariaForms";

export default async function EditarModeloPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireContext();
  const { id } = await params;

  if (ctx.company.niche !== "marcenaria") {
    return (
      <>
        <PageHeader title="Modelo" />
        <EmptyState title="Módulo exclusivo de marcenarias" />
      </>
    );
  }

  const companyId = ctx.company.id;
  const [template, materials, finishes, hardware] = await Promise.all([
    prisma.woodTemplate.findFirst({ where: { id, companyId } }),
    prisma.woodMaterial.findMany({ where: { companyId }, orderBy: [{ name: "asc" }, { thicknessMm: "asc" }] }),
    prisma.woodFinish.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
    prisma.woodHardware.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
  ]);
  if (!template) notFound();

  const tplHardware = Array.isArray(template.hardware)
    ? (template.hardware as { hardwareId?: string; quantity?: number }[])
    : [];
  const hardwareQty: Record<string, number> = {};
  for (const h of tplHardware) {
    if (h && h.hardwareId && typeof h.quantity === "number") hardwareQty[h.hardwareId] = h.quantity;
  }

  return (
    <>
      <PageHeader title="Editar modelo de produto" />
      <Card className="max-w-2xl">
        <WoodTemplateForm
          action={updateWoodTemplate}
          initial={template}
          materials={materials.map((m) => ({ id: m.id, label: `${m.name} ${m.thicknessMm}mm` }))}
          finishes={finishes.map((f) => ({ id: f.id, label: f.name }))}
          hardware={hardware.map((h) => ({ id: h.id, name: h.name, priceLabel: `${formatCents(h.priceCents)}/un` }))}
          hardwareQty={hardwareQty}
        />
      </Card>
    </>
  );
}
