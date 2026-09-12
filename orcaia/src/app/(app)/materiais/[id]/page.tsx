import { notFound } from "next/navigation";
import { requireContext } from "@/lib/core/tenant";
import { prisma } from "@/lib/core/db";
import { updateMaterial } from "@/app/actions/catalog";
import { ALL_UNITS } from "@/lib/niches";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { MaterialForm } from "@/components/forms/MaterialForm";

export default async function EditarMaterialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireContext();
  const { id } = await params;

  const material = await prisma.material.findFirst({
    where: { id, companyId: ctx.company.id },
  });
  if (!material) notFound();

  return (
    <>
      <PageHeader title="Editar material" />
      <Card className="max-w-2xl">
        <MaterialForm action={updateMaterial} units={ALL_UNITS} initial={material} />
      </Card>
    </>
  );
}
