import { requireContext } from "@/lib/core/tenant";
import { createCustomer } from "@/app/actions/customers";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { CustomerForm } from "@/components/forms/CustomerForm";

export default async function NovoClientePage() {
  await requireContext();
  return (
    <>
      <PageHeader title="Novo cliente" />
      <Card className="max-w-2xl">
        <CustomerForm action={createCustomer} />
      </Card>
    </>
  );
}
