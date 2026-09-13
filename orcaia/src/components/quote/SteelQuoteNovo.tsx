import Link from "next/link";
import { prisma } from "@/lib/core/db";
import { bpsToInput } from "@/lib/core/money";
import { createSteelQuote } from "@/app/actions/steel-quotes";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SteelQuoteHeaderForm } from "@/components/forms/SteelQuoteForms";

// Tela "Novo orcamento" da serralheria (server component).
export async function SteelQuoteNovo({ companyId }: { companyId: string }) {
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
          <Link href="/clientes/novo">
            <Button>Cadastrar cliente</Button>
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Novo orçamento" description="Dados gerais; os itens são adicionados em seguida." />
      <Card className="max-w-2xl">
        <SteelQuoteHeaderForm
          action={createSteelQuote}
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
