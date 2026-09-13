import { notFound } from "next/navigation";
import { requireContext } from "@/lib/core/tenant";
import { prisma } from "@/lib/core/db";
import { updateSteelProduct } from "@/app/actions/serralheria-catalog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { SteelProductForm } from "@/components/forms/SerralheriaForms";

export default async function EditarSteelProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireContext();
  const { id } = await params;

  if (ctx.company.niche !== "serralheria") {
    return (
      <>
        <PageHeader title="Produto" />
        <EmptyState title="Módulo exclusivo de serralherias" />
      </>
    );
  }

  const [product, materials] = await Promise.all([
    prisma.steelProduct.findFirst({ where: { id, companyId: ctx.company.id } }),
    prisma.steelMaterial.findMany({ where: { companyId: ctx.company.id }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!product) notFound();

  return (
    <>
      <PageHeader title="Editar produto / serviço" />
      <Card className="max-w-2xl">
        <SteelProductForm
          action={updateSteelProduct}
          initial={product}
          materialNames={materials.map((m) => m.name)}
        />
      </Card>
    </>
  );
}
