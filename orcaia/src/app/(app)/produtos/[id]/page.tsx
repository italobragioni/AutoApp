import { notFound } from "next/navigation";
import { requireContext } from "@/lib/core/tenant";
import { prisma } from "@/lib/core/db";
import { updateProduct } from "@/app/actions/catalog";
import { getNiche, ALL_UNITS } from "@/lib/niches";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { ProductForm } from "@/components/forms/ProductForm";

export default async function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireContext();
  const { id } = await params;

  const product = await prisma.product.findFirst({
    where: { id, companyId: ctx.company.id },
  });
  if (!product) notFound();

  const units = getNiche(ctx.company.niche)?.units ?? ALL_UNITS;

  return (
    <>
      <PageHeader title="Editar produto / servico" />
      <Card className="max-w-2xl">
        <ProductForm action={updateProduct} units={units} initial={product} />
      </Card>
    </>
  );
}
