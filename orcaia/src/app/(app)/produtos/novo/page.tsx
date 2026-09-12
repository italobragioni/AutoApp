import { requireContext } from "@/lib/core/tenant";
import { createProduct } from "@/app/actions/catalog";
import { getNiche, ALL_UNITS } from "@/lib/niches";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { ProductForm } from "@/components/forms/ProductForm";

export default async function NovoProdutoPage() {
  const ctx = await requireContext();
  const units = getNiche(ctx.company.niche)?.units ?? ALL_UNITS;
  return (
    <>
      <PageHeader title="Novo produto / servico" />
      <Card className="max-w-2xl">
        <ProductForm action={createProduct} units={units} />
      </Card>
    </>
  );
}
