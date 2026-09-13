import Link from "next/link";
import { prisma } from "@/lib/core/db";
import { bpsToInput } from "@/lib/core/money";
import { createWoodQuote } from "@/app/actions/wood-quotes";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WoodQuoteHeaderForm } from "@/components/forms/WoodQuoteForms";

export async function WoodQuoteNovo({ companyId }: { companyId: string }) {
  const [customers, company] = await Promise.all([
    prisma.customer.findMany({ where: { companyId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.company.findUnique({ where: { id: companyId }, select: { defaultMarginBps: true } }),
  ]);

  if (customers.length === 0) {
    return (
      <>
        <PageHeader title="Novo orçamento" />
        <EmptyState title="Cadastre um cliente primeiro" description="Um orçamento precisa de um cliente." />
        <div className="mt-4">
          <Link href="/clientes/novo"><Button>Cadastrar cliente</Button></Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Novo orçamento" description="Dados gerais; os itens são adicionados por modelo em seguida." />
      <Card className="max-w-2xl">
        <WoodQuoteHeaderForm
          action={createWoodQuote}
          customers={customers}
          submitLabel="Criar orçamento"
          initial={{
            marginValue: bpsToInput(company?.defaultMarginBps ?? 2000),
            installationValue: "",
            travelValue: "",
            otherValue: "",
          }}
        />
      </Card>
    </>
  );
}
