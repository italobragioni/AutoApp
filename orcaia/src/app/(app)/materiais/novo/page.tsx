import { requireContext } from "@/lib/core/tenant";
import { createMaterial } from "@/app/actions/catalog";
import { ALL_UNITS } from "@/lib/niches";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { MaterialForm } from "@/components/forms/MaterialForm";

export default async function NovoMaterialPage() {
  await requireContext();
  return (
    <>
      <PageHeader title="Novo material" />
      <Card className="max-w-2xl">
        <MaterialForm action={createMaterial} units={ALL_UNITS} />
      </Card>
    </>
  );
}
