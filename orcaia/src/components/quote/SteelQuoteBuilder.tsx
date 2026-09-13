import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer, Trash2, Copy } from "lucide-react";
import { prisma } from "@/lib/core/db";
import { formatCents } from "@/lib/core/format";
import { bpsToInput, centsToInput } from "@/lib/core/money";
import { serviceTypeLabel, baseUnitLabel } from "@/lib/niches/serralheria/options";
import {
  updateSteelQuoteHeader,
  addSteelQuoteItem,
  deleteSteelQuoteItem,
  deleteSteelQuote,
  setSteelQuoteStatus,
} from "@/app/actions/steel-quotes";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusControl } from "@/components/forms/QuoteForms";
import { duplicateQuote } from "@/app/actions/quote-common";
import { SteelQuoteHeaderForm, SteelAddItemForm } from "@/components/forms/SteelQuoteForms";
import { SteelQuoteDocument } from "@/components/quote/SteelQuoteDocument";

function toDateInput(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

// Construtor do orcamento de serralheria (server component).
export async function SteelQuoteBuilder({ id, companyId }: { id: string; companyId: string }) {
  const [quote, company, customers, products] = await Promise.all([
    prisma.quote.findFirst({
      where: { id, companyId },
      include: { customer: true, items: { orderBy: { id: "asc" } } },
    }),
    prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, document: true, phone: true, email: true, city: true, state: true },
    }),
    prisma.customer.findMany({ where: { companyId }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.steelProduct.findMany({ where: { companyId, active: true }, orderBy: { name: "asc" } }),
  ]);

  if (!quote || !company) notFound();

  const productOptions = products.map((p) => ({
    id: p.id,
    label: `${p.name} — ${serviceTypeLabel(p.serviceType)} (${baseUnitLabel(p.baseUnit)})`,
  }));

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
            <form action={duplicateQuote}>
              <input type="hidden" name="id" value={quote.id} />
              <Button variant="secondary" type="submit"><Copy className="h-4 w-4" /> Duplicar</Button>
            </form>
            <form action={deleteSteelQuote}>
              <input type="hidden" name="id" value={quote.id} />
              <Button variant="ghost" type="submit" className="text-red-600 hover:bg-red-50">
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
            </form>
          </div>
        }
      />

      <div className="mb-4">
        <StatusControl action={setSteelQuoteStatus} id={quote.id} status={quote.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Adicionar item</CardTitle>
          <div className="mt-3">
            {productOptions.length === 0 ? (
              <div>
                <p className="mb-3 text-sm text-ink-faint">
                  Cadastre ao menos um produto/serviço antes de adicionar itens.
                </p>
                <Link href="/serralheria">
                  <Button variant="secondary">Ir para Materiais e produtos</Button>
                </Link>
              </div>
            ) : (
              <SteelAddItemForm action={addSteelQuoteItem} quoteId={quote.id} products={productOptions} />
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>Dados e custos gerais</CardTitle>
          <div className="mt-3">
            <SteelQuoteHeaderForm
              action={updateSteelQuoteHeader}
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
                discountValue: centsToInput(quote.discountCents),
                deliveryTime: quote.deliveryTime,
                paymentTerms: quote.paymentTerms,
                notes: quote.notes,
              }}
            />
          </div>
        </Card>
      </div>

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
                    <span className="ml-2 text-ink-faint">{it.quantity}x · {formatCents(b.materialsCents ?? 0)}</span>
                  </span>
                  <form action={deleteSteelQuoteItem}>
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

      <div className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-ink-soft">Pré-visualização do orçamento</h2>
        <SteelQuoteDocument
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
            discountCents: quote.discountCents,
            notes: quote.notes,
            deliveryTime: quote.deliveryTime,
            paymentTerms: quote.paymentTerms,
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
