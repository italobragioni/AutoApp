import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  Car,
  CircleDollarSign,
  FileText,
  Pencil,
  User,
} from "lucide-react";

import { Badge, ButtonLink, Card, CardBody, CardHeader } from "@/components/ui";
import { StatCard } from "@/components/ui/page";
import { db } from "@/lib/db";
import { dateFull, daysBetween, money, plateMask } from "@/lib/format";
import { QUOTE_STATUS, statusOf } from "@/lib/labels";
import { isExpired, isQuoteEditable, quoteSubtotalCents, quoteTotalCents } from "@/lib/quotes";
import { requireContext } from "@/lib/tenant";

import {
  ConvertQuote,
  DeleteQuote,
  QuoteStatusActions,
  RenewQuote,
} from "../QuoteActions";
import { QuoteForm } from "../QuoteForm";

export const metadata: Metadata = { title: "Orçamento" };

export default async function QuoteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editar?: string }>;
}) {
  const { company } = await requireContext();
  const { id } = await params;
  const editing = (await searchParams).editar === "1";

  // findFirst com companyId: orcamento de outra empresa nao existe aqui.
  const quote = await db.quote.findFirst({
    where: { id, companyId: company.id },
    include: {
      customer: { select: { id: true, name: true } },
      vehicle: { select: { id: true, brand: true, model: true, plate: true } },
      items: true,
      workOrders: { select: { id: true, number: true, status: true } },
    },
  });

  if (!quote) notFound();

  const [customerRows, serviceRows] = await Promise.all([
    db.customer.findMany({
      where: { companyId: company.id, vehicles: { some: {} } },
      select: {
        id: true,
        name: true,
        vehicles: { select: { id: true, brand: true, model: true, plate: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.serviceItem.findMany({
      where: { companyId: company.id, active: true },
      select: { id: true, name: true, basePrice: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const customerOptions = customerRows.map((customer) => ({
    id: customer.id,
    name: customer.name,
    vehicles: customer.vehicles.map((v) => ({
      id: v.id,
      label: `${v.brand} ${v.model}${v.plate ? ` · ${v.plate}` : ""}`,
    })),
  }));

  const status = statusOf(QUOTE_STATUS, quote.status);
  const numero = `#${String(quote.number).padStart(4, "0")}`;
  const expired = isExpired(quote.validUntil);
  const editable = isQuoteEditable(quote.status);
  const workOrder = quote.workOrders[0] ?? null;

  // Mesmo calculo do formulario e das actions.
  const subtotal = quoteSubtotalCents(quote.items);
  const total = quoteTotalCents(subtotal, quote.discountCents);
  const diasParaVencer = quote.validUntil ? -daysBetween(quote.validUntil, new Date()) : null;

  return (
    <div className="space-y-6">
      <QuoteForm
        open={editing}
        customers={customerOptions}
        services={serviceRows}
        closeHref={`/orcamentos/${quote.id}`}
        quote={{
          id: quote.id,
          customerId: quote.customerId,
          vehicleId: quote.vehicleId ?? "",
          items: quote.items
            .filter((item) => item.serviceItemId)
            .map((item) => ({
              serviceItemId: item.serviceItemId!,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents,
            })),
          validUntil: quote.validUntil
            ? quote.validUntil.toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10),
          discountCents: quote.discountCents,
          status: quote.status,
          notes: quote.notes,
        }}
      />

      <Link
        href="/orcamentos"
        className="focus-ring inline-flex items-center gap-1.5 rounded text-xs font-medium text-muted transition-colors hover:text-white"
      >
        <ArrowLeft size={14} />
        Voltar para orçamentos
      </Link>

      <Card>
        <CardBody className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-xl font-bold text-white sm:text-2xl">
                Orçamento {numero}
              </h1>
              <Badge tone={status.tone} dot>
                {status.label}
              </Badge>
              {expired && quote.status !== "cancelado" && (
                <Badge tone="warning" dot>
                  Vencido
                </Badge>
              )}
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
              <Link
                href={`/clientes/${quote.customer.id}`}
                className="focus-ring inline-flex items-center gap-1.5 rounded hover:text-volt-300"
              >
                <User size={13} />
                {quote.customer.name}
              </Link>
              {quote.vehicle && (
                <Link
                  href={`/veiculos/${quote.vehicle.id}`}
                  className="focus-ring inline-flex items-center gap-1.5 rounded hover:text-volt-300"
                >
                  <Car size={13} />
                  {quote.vehicle.brand} {quote.vehicle.model} · {plateMask(quote.vehicle.plate)}
                </Link>
              )}
              <span className="inline-flex items-center gap-1.5">
                <FileText size={13} />
                Criado em {dateFull(quote.createdAt)}
              </span>
            </div>

            {workOrder && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-xl border border-volt-400/25 bg-volt-400/10 px-3 py-2 text-xs text-volt-200">
                <FileText size={13} className="shrink-0" />
                Convertido na OS #{String(workOrder.number).padStart(4, "0")}
                <Link
                  href={`/ordens/${workOrder.id}`}
                  className="focus-ring rounded font-medium underline underline-offset-2"
                >
                  abrir
                </Link>
              </p>
            )}

            {expired && !workOrder && quote.status !== "cancelado" && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                <AlertTriangle size={13} className="shrink-0" />
                Validade vencida em {dateFull(quote.validUntil!)}. Atualize a validade para
                aprovar ou converter.
              </p>
            )}

            {quote.notes && (
              <p className="mt-3 max-w-xl rounded-xl border border-line bg-ink-850 px-3.5 py-2.5 text-xs leading-relaxed text-soft">
                {quote.notes}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {editable && (
              <ButtonLink
                href={`/orcamentos/${quote.id}?editar=1`}
                variant="secondary"
                size="md"
              >
                <Pencil size={16} />
                Editar
              </ButtonLink>
            )}
            {expired && !workOrder && (
              <RenewQuote
                quote={{
                  id: quote.id,
                  validUntil: quote.validUntil?.toISOString().slice(0, 10) ?? null,
                }}
              />
            )}
            <ConvertQuote
              quote={{ id: quote.id, status: quote.status, expired }}
              workOrderId={workOrder?.id ?? null}
            />
            {!workOrder && <DeleteQuote quote={{ id: quote.id, number: quote.number }} />}
          </div>
        </CardBody>

        <div className="border-t border-line px-5 py-3">
          <QuoteStatusActions quote={{ id: quote.id, status: quote.status }} />
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Itens" value={quote.items.length} hint="Serviços na proposta" />
        <StatCard label="Subtotal" value={money(subtotal)} hint="Antes do desconto" />
        <StatCard
          label="Desconto"
          value={money(quote.discountCents)}
          hint={
            subtotal > 0
              ? `${((quote.discountCents / subtotal) * 100).toFixed(1)}% do subtotal`
              : "—"
          }
          tone={quote.discountCents > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Total"
          value={money(total)}
          hint={
            quote.validUntil
              ? expired
                ? `Vencido há ${Math.abs(diasParaVencer ?? 0)} dias`
                : `Válido por mais ${diasParaVencer} dias`
              : "Sem validade"
          }
          icon={<CircleDollarSign size={17} />}
          tone="volt"
        />
      </div>

      <Card>
        <CardHeader
          title="Serviços da proposta"
          description="Descrição, quantidade e valor unitário ficam registrados no orçamento."
        />
        <div className="divide-y divide-line">
          {quote.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{item.description}</p>
                <p className="text-xs text-muted">
                  {item.quantity} × {money(item.unitPriceCents)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium text-white">
                {money(item.quantity * item.unitPriceCents)}
              </span>
            </div>
          ))}
        </div>
        <CardBody className="space-y-1.5 border-t border-line">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Subtotal</span>
            <span className="font-medium text-soft">{money(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Desconto</span>
            <span className="font-medium text-amber-300">− {money(quote.discountCents)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-line pt-2 text-sm">
            <span className="font-medium text-white">Total</span>
            <span className="font-display text-lg font-bold text-volt-300">{money(total)}</span>
          </div>
        </CardBody>
      </Card>

      {quote.validUntil && (
        <p className="flex items-center gap-2 text-xs text-muted">
          <CalendarClock size={13} />
          Validade: {dateFull(quote.validUntil)}
        </p>
      )}
    </div>
  );
}
