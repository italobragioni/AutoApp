import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireContext } from "@/lib/core/tenant";
import { prisma } from "@/lib/core/db";
import { QuoteDocument } from "@/components/quote/QuoteDocument";
import { SteelQuoteDocument } from "@/components/quote/SteelQuoteDocument";
import { WoodQuoteDocument } from "@/components/quote/WoodQuoteDocument";
import { PrintButton } from "@/components/forms/QuoteForms";

export default async function ImprimirOrcamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireContext();
  const { id } = await params;

  if (ctx.company.niche === "serralheria") {
    const [quote, company] = await Promise.all([
      prisma.quote.findFirst({
        where: { id, companyId: ctx.company.id },
        include: { customer: true, items: { orderBy: { id: "asc" } } },
      }),
      prisma.company.findUnique({
        where: { id: ctx.company.id },
        select: { name: true, document: true, phone: true, email: true, city: true, state: true },
      }),
    ]);
    if (!quote || !company) notFound();
    return (
      <div>
        <div className="mb-4 flex items-center justify-between print:hidden">
          <Link href={`/orcamentos/${quote.id}`} className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <PrintButton />
        </div>
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
    );
  }

  if (ctx.company.niche === "marcenaria") {
    const [quote, company] = await Promise.all([
      prisma.quote.findFirst({
        where: { id, companyId: ctx.company.id },
        include: { customer: true, items: { orderBy: { id: "asc" } } },
      }),
      prisma.company.findUnique({
        where: { id: ctx.company.id },
        select: { name: true, document: true, phone: true, email: true, city: true, state: true },
      }),
    ]);
    if (!quote || !company) notFound();
    return (
      <div>
        <div className="mb-4 flex items-center justify-between print:hidden">
          <Link href={`/orcamentos/${quote.id}`} className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <PrintButton />
        </div>
        <WoodQuoteDocument
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
    );
  }

  if (ctx.company.niche !== "vidracaria") notFound();

  const [quote, company] = await Promise.all([
    prisma.quote.findFirst({
      where: { id, companyId: ctx.company.id },
      include: { customer: true, items: { orderBy: { id: "asc" } } },
    }),
    prisma.company.findUnique({
      where: { id: ctx.company.id },
      select: { name: true, document: true, phone: true, email: true, city: true, state: true },
    }),
  ]);

  if (!quote || !company) notFound();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={`/orcamentos/${quote.id}`} className="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <PrintButton />
      </div>

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
  );
}
