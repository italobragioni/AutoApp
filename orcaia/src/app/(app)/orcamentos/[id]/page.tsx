import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer, Trash2 } from "lucide-react";
import { requireContext } from "@/lib/core/tenant";
import { prisma } from "@/lib/core/db";
import { formatCents } from "@/lib/core/format";
import { bpsToInput, centsToInput } from "@/lib/core/money";
import { updateQuoteHeader, deleteQuote, addQuoteItem, deleteQuoteItem, setQuoteStatus } from "@/app/actions/quotes";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/field";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { QuoteHeaderForm, AddItemForm, StatusControl } from "@/components/forms/QuoteForms";
import { QuoteDocument } from "@/components/quote/QuoteDocument";

function toDateInput(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function OrcamentoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireContext();
  const { id } = await params;

  if (ctx.company.niche !== "vidracaria") {
    return (
      <>
        <PageHeader title="Orçamento" />
        <EmptyState title="Módulo exclusivo de vidraçarias" />
      </>
    );
  }

  const [quote, company, customers, glass, finishes, hardware] = await Promise.all([
    prisma.quote.findFirst({
      where: { id, companyId: ctx.company.id },
      include: {
        customer: true,
        items: { orderBy: { id: "asc" } },
      },
    }),
    prisma.company.findUnique({
      where: { id: ctx.company.id },
      select: { name: true, document: true, phone: true, email: true, city: true, state: true },
    }),
    prisma.customer.findMany({
      where: { companyId: ctx.company.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.glassOption.findMany({ where: { companyId: ctx.company.id, active: true }, orderBy: [{ glassType: "asc" }, { thicknessMm: "asc" }] }),
    prisma.finishOption.findMany({ where: { companyId: ctx.company.id, active: true }, orderBy: { name: "asc" } }),
    prisma.hardwareOption.findMany({ where: { companyId: ctx.company.id, active: true }, orderBy: { name: "asc" } }),
  ]);

  if (!quote || !company) notFound();

  const glassOptions = glass.map((g) => ({
    id: g.id,
    label: `${g.glassType} ${g.thicknessMm}mm — ${formatCents(g.pricePerM2Cents)}/m²`,
  }));
  const finishOptions = finishes.map((f) => ({ id: f.id, label: `${f.name} (${formatCents(f.priceCents)})` }));
  const hardwareList = hardware.map((h) => ({ id: h.id, name: h.name, priceLabel: `${formatCents(h.priceCents)}/un` }));

  return (
    <>
      <PageHeader
        title={`Orçamento #${quote.number}`}
        description={quote.customer.name}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/orcamentos/${quote.id}/imprimir`}>
              <Button variant="secondary">
                <Printer className="h-4 w-4" /> Imprimir / PDF
              </Button>
            </Link>
            <form action={deleteQuote}>
              <input type="hidden" name="id" value={quote.id} />
              <Button variant="ghost" type="submit" className="text-red-600 hover:bg-red-50">
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            </form>
          </div>
        }
      />

      <div className="mb-4">
        <StatusControl action={setQuoteStatus} id={quote.id} status={quote.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Adicionar item */}
        <Card>
          <CardTitle>Adicionar item</CardTitle>
          <div className="mt-3">
            {glassOptions.length === 0 ? (
              <div>
                <p className="mb-3 text-sm text-ink-faint">
                  Cadastre ao menos um vidro (tipo + espessura + preço/m²) antes de adicionar itens.
                </p>
                <Link href="/vidros">
                  <Button variant="secondary">Ir para Vidros</Button>
                </Link>
              </div>
            ) : (
              <AddItemForm
                action={addQuoteItem}
                quoteId={quote.id}
                glassOptions={glassOptions}
                finishOptions={finishOptions}
                hardware={hardwareList}
              />
            )}
          </div>
        </Card>

        {/* Dados e custos gerais */}
        <Card>
          <CardTitle>Dados e custos gerais</CardTitle>
          <div className="mt-3">
            <QuoteHeaderForm
              action={updateQuoteHeader}
              customers={customers}
              isEdit
              submitLabel="Salvar dados"
              initial={{
                id: quote.id,
                customerId: quote.customerId,
                validUntil: toDateInput(quote.validUntil),
                marginValue: bpsToInput(quote.marginBps),
                installationValue: centsToInput(quote.installationCents),
                travelValue: centsToInput(quote.travelCents),
                otherValue: centsToInput(quote.otherCents),
                notes: quote.notes,
              }}
            />
          </div>
        </Card>
      </div>

      {/* Itens (gerenciar) */}
      {quote.items.length > 0 ? (
        <Card className="mt-6">
          <CardTitle>Itens do orçamento ({quote.items.length})</CardTitle>
          <ul className="mt-3 divide-y divide-surface-border">
            {quote.items.map((it) => {
              const b = (it.breakdown ?? {}) as { materialsCents?: number };
              return (
                <li key={it.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-ink">
                    {it.description}
                    <span className="ml-2 text-ink-faint">
                      {it.quantity}x · {formatCents(b.materialsCents ?? 0)}
                    </span>
                  </span>
                  <form action={deleteQuoteItem}>
                    <input type="hidden" name="id" value={it.id} />
                    <input type="hidden" name="quoteId" value={quote.id} />
                    <button type="submit" className="rounded-lg p-2 text-ink-faint hover:bg-red-50 hover:text-red-600" aria-label="Remover item">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {/* Visualizacao profissional */}
      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-ink-soft">Pré-visualização do orçamento</h2>
        <QuoteDocument
          quote={{
            number: quote.number,
            status: quote.status,
            createdAt: quote.createdAt,
            validUntil: quote.validUntil,
            subtotalCents: quote.subtotalCents,
            installationCents: quote.installationCents,
            travelCents: quote.travelCents,
            otherCents: quote.otherCents,
            marginBps: quote.marginBps,
            totalCents: quote.totalCents,
            notes: quote.notes,
            customer: quote.customer,
            company,
            items: quote.items.map((it) => ({
              id: it.id,
              description: it.description,
              quantity: it.quantity,
              spec: it.spec,
              breakdown: it.breakdown,
            })),
          }}
        />
      </div>
    </>
  );
}
