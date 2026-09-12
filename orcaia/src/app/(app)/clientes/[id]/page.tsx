import { notFound } from "next/navigation";
import { requireContext } from "@/lib/core/tenant";
import { prisma } from "@/lib/core/db";
import { updateCustomer } from "@/app/actions/customers";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { CustomerForm } from "@/components/forms/CustomerForm";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireContext();
  const { id } = await params;

  // Escopado por companyId: cliente de outra empresa "nao existe" (404).
  const customer = await prisma.customer.findFirst({
    where: { id, companyId: ctx.company.id },
  });
  if (!customer) notFound();

  return (
    <>
      <PageHeader title="Editar cliente" />
      <Card className="max-w-2xl">
        <CustomerForm action={updateCustomer} initial={customer} />
      </Card>
    </>
  );
}
