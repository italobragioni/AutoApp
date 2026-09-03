import type { Metadata } from "next";
import Link from "next/link";
import { Car, CheckCircle2, Search, UserPlus, Users } from "lucide-react";

import {
  Avatar,
  Badge,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui";
import { PageHeader, StatCard } from "@/components/ui/page";
import { db } from "@/lib/db";
import { dateFull, money, phoneMask } from "@/lib/format";
import { ORIGIN_LABEL } from "@/lib/labels";
import { STAGE_LABEL, STAGE_TONE, getRetention } from "@/lib/retention";
import { requireContext } from "@/lib/tenant";

import { CustomerForm } from "./CustomerForm";

export const metadata: Metadata = { title: "Clientes" };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estagio?: string; novo?: string; excluido?: string }>;
}) {
  const { company } = await requireContext();
  const params = await searchParams;
  const query = (params.q ?? "").trim();
  const stageFilter = params.estagio ?? "";
  // O botao "Novo cliente" ja apontava para ?novo=1; agora esse parametro abre
  // de fato o formulario, sem mudar o link nem a navegacao existente.
  const creating = params.novo === "1";

  const [customers, retention, totals] = await Promise.all([
    db.customer.findMany({
      // O filtro de empresa vem sempre primeiro — nenhum dado cruza tenants.
      where: {
        companyId: company.id,
        ...(query
          ? {
              OR: [
                { name: { contains: query } },
                { phone: { contains: query } },
                { email: { contains: query } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      include: {
        vehicles: { select: { brand: true, model: true, plate: true } },
        _count: { select: { workOrders: true } },
      },
    }),
    getRetention(company.id),
    db.customer.count({ where: { companyId: company.id } }),
  ]);

  const stageById = new Map(retention.customers.map((item) => [item.id, item]));

  const rows = customers
    .map((customer) => ({ customer, retention: stageById.get(customer.id) }))
    .filter((row) => !stageFilter || row.retention?.stage === stageFilter);

  const newThisMonth = customers.filter(
    (customer) => customer.createdAt >= new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  ).length;

  const lifetimeValue = retention.customers.reduce((sum, item) => sum + item.totalSpentCents, 0);

  const FILTERS = [
    { key: "", label: "Todos", count: totals },
    { key: "em_dia", label: "Em dia", count: retention.counts.em_dia },
    { key: "atencao", label: "Atenção", count: retention.counts.atencao },
    { key: "em_risco", label: "Em risco", count: retention.counts.em_risco },
    { key: "inativo", label: "Inativos", count: retention.counts.inativo },
    { key: "novo", label: "Novos", count: retention.counts.novo },
  ];

  return (
    <div className="space-y-6">
      <CustomerForm open={creating} closeHref="/clientes" />

      <PageHeader
        eyebrow="Operação"
        title="Clientes"
        description="A base da sua estética. Cada cliente com histórico, veículos e estágio de retorno."
        actions={
          <ButtonLink href="/clientes?novo=1" size="md">
            <UserPlus size={16} />
            Novo cliente
          </ButtonLink>
        }
      />

      {params.excluido === "1" && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl border border-volt-400/25 bg-volt-400/10 px-3.5 py-3 text-sm text-volt-200"
        >
          <CheckCircle2 size={15} className="shrink-0" />
          Cliente excluído.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total de clientes" value={totals} hint={`${newThisMonth} novos neste mês`} icon={<Users size={17} />} />
        <StatCard label="Em dia" value={retention.counts.em_dia} hint="Dentro do ciclo de retorno" tone="volt" />
        <StatCard label="Precisam de contato" value={retention.needsContactCount} hint="Atenção, risco e inativos" tone="warning" />
        <StatCard label="Valor gerado" value={money(lifetimeValue)} hint="Soma histórica de serviços" />
      </div>

      {/* Busca + filtros por estagio */}
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <form className="relative min-w-0 flex-1" action="/clientes">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            />
            {stageFilter && <input type="hidden" name="estagio" value={stageFilter} />}
            <Input
              name="q"
              defaultValue={query}
              placeholder="Buscar por nome, telefone ou e-mail..."
              className="pl-10"
              aria-label="Buscar clientes"
            />
          </form>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-line p-4">
          {FILTERS.map((filter) => {
            const active = stageFilter === filter.key;
            const href = filter.key
              ? `/clientes?estagio=${filter.key}${query ? `&q=${encodeURIComponent(query)}` : ""}`
              : `/clientes${query ? `?q=${encodeURIComponent(query)}` : ""}`;
            return (
              <Link
                key={filter.key || "todos"}
                href={href}
                className={`focus-ring rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-volt-400 text-ink-950"
                    : "border border-line bg-ink-850 text-soft hover:border-ink-600 hover:text-white"
                }`}
              >
                {filter.label}
                <span className={active ? "ml-1.5 opacity-70" : "ml-1.5 text-muted"}>
                  {filter.count}
                </span>
              </Link>
            );
          })}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<Users size={20} />}
            title={query ? "Nenhum cliente encontrado" : "Nenhum cliente ainda"}
            description={
              query
                ? `Não encontramos resultados para "${query}".`
                : "Cadastre o primeiro cliente para começar a construir o histórico da sua estética."
            }
            action={
              query ? (
                <ButtonLink href="/clientes" size="sm" variant="secondary">
                  Limpar busca
                </ButtonLink>
              ) : (
                <ButtonLink href="/clientes?novo=1" size="sm">
                  Novo cliente
                </ButtonLink>
              )
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Cliente</Th>
                <Th>Veículo</Th>
                <Th>Contato</Th>
                <Th>Último serviço</Th>
                <Th className="text-right">Total gasto</Th>
                <Th>Retenção</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ customer, retention: info }) => {
                const vehicle = customer.vehicles[0];
                return (
                  <Tr key={customer.id}>
                    <Td>
                      <Link
                        href={`/clientes/${customer.id}`}
                        className="focus-ring flex items-center gap-3 rounded"
                      >
                        <Avatar name={customer.name} size={34} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-white">
                            {customer.name}
                          </span>
                          <span className="block text-xs text-muted">
                            {ORIGIN_LABEL[customer.origin] ?? customer.origin} ·{" "}
                            {customer._count.workOrders}{" "}
                            {customer._count.workOrders === 1 ? "serviço" : "serviços"}
                          </span>
                        </span>
                      </Link>
                    </Td>
                    <Td>
                      {vehicle ? (
                        <span className="flex items-center gap-2 text-sm text-soft">
                          <Car size={15} className="shrink-0 text-muted" />
                          <span className="min-w-0">
                            <span className="block truncate">
                              {vehicle.brand} {vehicle.model}
                            </span>
                            {customer.vehicles.length > 1 && (
                              <span className="block text-[0.7rem] text-muted">
                                +{customer.vehicles.length - 1} veículo(s)
                              </span>
                            )}
                          </span>
                        </span>
                      ) : (
                        <span className="text-sm text-muted">—</span>
                      )}
                    </Td>
                    <Td>
                      <span className="block text-sm text-soft">{phoneMask(customer.phone)}</span>
                      <span className="block truncate text-xs text-muted">
                        {customer.email ?? "—"}
                      </span>
                    </Td>
                    <Td>
                      {info?.lastVisitAt ? (
                        <>
                          <span className="block text-sm text-soft">
                            {dateFull(info.lastVisitAt)}
                          </span>
                          <span className="block text-xs text-muted">
                            há {info.daysSinceLastVisit} dias
                          </span>
                        </>
                      ) : (
                        <span className="text-sm text-muted">Nunca</span>
                      )}
                    </Td>
                    <Td className="text-right text-sm font-medium text-white">
                      {money(info?.totalSpentCents ?? 0)}
                    </Td>
                    <Td>
                      {info && (
                        <Badge tone={STAGE_TONE[info.stage]} dot>
                          {STAGE_LABEL[info.stage]}
                        </Badge>
                      )}
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
