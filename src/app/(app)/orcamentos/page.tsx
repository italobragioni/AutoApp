import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, FileText, Plus, Send, TrendingUp } from "lucide-react";

import {
  Badge,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui";
import { PageHeader, StatCard } from "@/components/ui/page";
import { db } from "@/lib/db";
import { daysBetween, dateFull, money } from "@/lib/format";
import { QUOTE_STATUS, statusOf } from "@/lib/labels";
import { requireContext } from "@/lib/tenant";

import { QuoteForm } from "./QuoteForm";

export const metadata: Metadata = { title: "Orçamentos" };

const FUNNEL = ["rascunho", "enviado", "aprovado", "recusado", "expirado", "cancelado"] as const;

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; novo?: string; excluido?: string }>;
}) {
  const { company } = await requireContext();
  const params = await searchParams;
  const statusFilter = params.status ?? "";
  const creating = params.novo === "1";

  const quotes = await db.quote.findMany({
    where: {
      companyId: company.id,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { id: true, name: true } },
      vehicle: { select: { brand: true, model: true } },
      items: true,
    },
  });

  const all = await db.quote.findMany({
    where: { companyId: company.id },
    select: { status: true, totalCents: true },
  });

  const countByStatus = Object.fromEntries(
    FUNNEL.map((status) => [status, all.filter((quote) => quote.status === status).length]),
  ) as Record<(typeof FUNNEL)[number], number>;

  const open = all.filter((quote) => quote.status === "rascunho" || quote.status === "enviado");
  const approved = all.filter((quote) => quote.status === "aprovado");
  const decided = all.filter((quote) => ["aprovado", "recusado"].includes(quote.status));
  const conversion =
    decided.length > 0 ? Math.round((approved.length / decided.length) * 100) : 0;

  // Opcoes do formulario — sempre escopadas pela empresa da sessao.
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

  return (
    <div className="space-y-6">
      <QuoteForm
        open={creating}
        customers={customerOptions}
        services={serviceRows}
        closeHref="/orcamentos"
      />

      <PageHeader
        eyebrow="Operação"
        title="Orçamentos"
        description="Monte a proposta, envie e acompanhe a resposta — sem deixar follow-up cair no esquecimento."
        actions={
          <ButtonLink href="/orcamentos?novo=1" size="md">
            <Plus size={16} />
            Novo orçamento
          </ButtonLink>
        }
      />

      {params.excluido === "1" && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl border border-volt-400/25 bg-volt-400/10 px-3.5 py-3 text-sm text-volt-200"
        >
          <CheckCircle2 size={15} className="shrink-0" />
          Orçamento excluído.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Em aberto"
          value={open.length}
          hint={`${money(open.reduce((sum, quote) => sum + quote.totalCents, 0))} aguardando`}
          icon={<Send size={17} />}
          tone={open.length > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Aprovados"
          value={approved.length}
          hint={money(approved.reduce((sum, quote) => sum + quote.totalCents, 0))}
          icon={<CheckCircle2 size={17} />}
          tone="volt"
        />
        <StatCard
          label="Taxa de conversão"
          value={`${conversion}%`}
          hint={`${decided.length} orçamentos decididos`}
          icon={<TrendingUp size={17} />}
        />
        <StatCard label="Total emitido" value={all.length} hint="Desde o início" icon={<FileText size={17} />} />
      </div>

      {/* Funil visual */}
      <Card>
        <CardHeader title="Funil de orçamentos" description="Onde suas propostas estão parando." />
        <div className="grid gap-3 p-4 sm:grid-cols-3 xl:grid-cols-5">
          {FUNNEL.map((status) => {
            const meta = statusOf(QUOTE_STATUS, status);
            const count = countByStatus[status];
            const active = statusFilter === status;
            return (
              <Link
                key={status}
                href={active ? "/orcamentos" : `/orcamentos?status=${status}`}
                className={`focus-ring rounded-xl border p-4 transition-colors ${
                  active
                    ? "border-volt-400/40 bg-volt-400/10"
                    : "border-line bg-ink-850/60 hover:border-ink-600"
                }`}
              >
                <Badge tone={meta.tone}>{meta.label}</Badge>
                <p className="mt-3 font-display text-2xl font-bold text-white">{count}</p>
                <p className="mt-0.5 text-[0.7rem] text-muted">
                  {money(
                    all
                      .filter((quote) => quote.status === status)
                      .reduce((sum, quote) => sum + quote.totalCents, 0),
                  )}
                </p>
              </Link>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader
          title={statusFilter ? `Orçamentos: ${statusOf(QUOTE_STATUS, statusFilter).label}` : "Todos os orçamentos"}
          description={`${quotes.length} ${quotes.length === 1 ? "registro" : "registros"}.`}
          action={
            statusFilter ? (
              <Link
                href="/orcamentos"
                className="focus-ring rounded text-xs font-medium text-volt-400 hover:text-volt-300"
              >
                Limpar filtro
              </Link>
            ) : undefined
          }
        />

        {quotes.length === 0 ? (
          <EmptyState
            icon={<FileText size={20} />}
            title="Nenhum orçamento"
            description="Crie propostas a partir do catálogo de serviços e acompanhe a aprovação aqui."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Nº</Th>
                <Th>Cliente</Th>
                <Th>Serviços</Th>
                <Th>Criado</Th>
                <Th>Validade</Th>
                <Th className="text-right">Valor</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => {
                const meta = statusOf(QUOTE_STATUS, quote.status);
                const expiresIn = quote.validUntil
                  ? -daysBetween(quote.validUntil, new Date())
                  : null;
                return (
                  <Tr key={quote.id}>
                    <Td>
                      <Link
                        href={`/orcamentos/${quote.id}`}
                        className="focus-ring rounded font-display text-xs font-bold text-volt-400 hover:text-volt-300"
                      >
                        #{String(quote.number).padStart(4, "0")}
                      </Link>
                    </Td>
                    <Td>
                      <Link
                        href={`/clientes/${quote.customer.id}`}
                        className="focus-ring rounded text-sm font-medium text-white hover:text-volt-300"
                      >
                        {quote.customer.name}
                      </Link>
                      <span className="block text-xs text-muted">
                        {quote.vehicle
                          ? `${quote.vehicle.brand} ${quote.vehicle.model}`
                          : "Sem veículo"}
                      </span>
                    </Td>
                    <Td className="max-w-xs">
                      <span className="block truncate text-sm text-soft">
                        {quote.items.map((item) => item.description).join(", ")}
                      </span>
                      {quote.discountCents > 0 && (
                        <span className="block text-xs text-volt-300">
                          Desconto de {money(quote.discountCents)}
                        </span>
                      )}
                    </Td>
                    <Td className="text-sm text-soft">{dateFull(quote.createdAt)}</Td>
                    <Td className="text-sm">
                      {quote.validUntil ? (
                        <>
                          <span className="block text-soft">{dateFull(quote.validUntil)}</span>
                          {expiresIn !== null && (
                            <span
                              className={`block text-xs ${expiresIn < 0 ? "text-rose-300" : expiresIn <= 3 ? "text-amber-300" : "text-muted"}`}
                            >
                              {expiresIn < 0
                                ? `vencido há ${Math.abs(expiresIn)}d`
                                : `vence em ${expiresIn}d`}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                    <Td className="text-right font-medium text-white">{money(quote.totalCents)}</Td>
                    <Td>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
