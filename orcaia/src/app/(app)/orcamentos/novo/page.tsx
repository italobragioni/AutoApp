import Link from "next/link";
import { requireContext } from "@/lib/core/tenant";
import { prisma } from "@/lib/core/db";
import { bpsToInput } from "@/lib/core/money";
import { createQuote } from "@/app/actions/quotes";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QuoteHeaderForm } from "@/components/forms/QuoteForms";

export default async function NovoOrcamentoPage() {
  const ctx = await requireContext();

  if (ctx.company.niche !== "vidracaria") {
    return (
      <>
        <PageHeader title="Novo orçamento" />
        <EmptyState title="Módulo exclusivo de vidraçarias" />
      </>
    );
  }

  const [customers, company] = await Promise.all([
    prisma.customer.findMany({
      where: { companyId: ctx.company.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.company.findUnique({
      where: { id: ctx.company.id },
      select: { defaultMarginBps: true },
    }),
  ]);

  if (customers.length === 0) {
    return (
      <>
        <PageHeader title="Novo orçamento" />
        <EmptyState
          title="Cadastre um cliente primeiro"
          description="Um orçamento precisa de um cliente."
        />
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
      <PageHeader title="Novo orçamento" description="Comece pelos dados gerais; os itens são adicionados em seguida." />
      <Card className="max-w-2xl">
        <QuoteHeaderForm
          action={createQuote}
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
