import type { Metadata } from "next";
import { BarChart3, CircleDollarSign, Repeat2, Users } from "lucide-react";

import { BarChart, DonutChart, LineChart } from "@/components/charts";
import { Card, CardBody, CardHeader, EmptyState, Meter, Table, Td, Th, Tr } from "@/components/ui";
import { PageHeader, StatCard } from "@/components/ui/page";
import { db } from "@/lib/db";
import { money, moneyCompact, samePeriodHint } from "@/lib/format";
import { PAYMENT_LABEL } from "@/lib/labels";
import {
  customersByOrigin,
  getDashboardMetrics,
  revenueByMonth,
  startOfMonth,
  topServices,
} from "@/lib/metrics";
import { getRetention } from "@/lib/retention";
import { requireContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Relatórios" };

const ORIGIN_COLORS = ["#12E29B", "#38BDF8", "#FBBF24", "#FB7185", "#A78BFA", "#33445A"];

export default async function ReportsPage() {
  const { company } = await requireContext();
  const companyId = company.id;

  const [metrics, revenue12, services, origins, retention, payments, customers] = await Promise.all([
    getDashboardMetrics(companyId),
    revenueByMonth(companyId, 12),
    topServices(companyId, 180),
    customersByOrigin(companyId),
    getRetention(companyId),
    db.workOrder.groupBy({
      by: ["paymentMethod"],
      where: { companyId, status: "concluida", paymentMethod: { not: null } },
      _count: { _all: true },
      _sum: { totalCents: true },
    }),
    db.customer.findMany({
      where: { companyId },
      select: { createdAt: true },
    }),
  ]);

  const yearRevenue = revenue12.reduce((sum, point) => sum + point.value, 0);
  const bestMonth = [...revenue12].sort((a, b) => b.value - a.value)[0];
  const maxServiceRevenue = services[0]?.revenueCents ?? 1;

  const returningCustomers = retention.customers.filter((customer) => customer.visits > 1).length;
  const retentionRate =
    retention.customers.length > 0
      ? Math.round((returningCustomers / retention.customers.length) * 100)
      : 0;

  // Clientes novos por mês nos últimos 6 meses.
  const now = new Date();
  const newByMonth = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const next = new Date(now.getFullYear(), now.getMonth() - (5 - index) + 1, 1);
    return {
      label: date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      value: customers.filter(
        (customer) => customer.createdAt >= date && customer.createdAt < next,
      ).length,
    };
  });

  const paymentTotal = payments.reduce((sum, row) => sum + (row._sum.totalCents ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Crescimento"
        title="Relatórios"
        description="Os números que mostram se a operação está crescendo — e de onde vem o crescimento."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Faturamento (12 meses)"
          value={money(yearRevenue)}
          hint={bestMonth ? `Melhor mês: ${bestMonth.label} (${moneyCompact(bestMonth.value)})` : undefined}
          icon={<CircleDollarSign size={17} />}
          tone="volt"
        />
        <StatCard
          label="Faturamento do mês"
          value={money(metrics.revenueMonthCents)}
          delta={metrics.revenueDelta}
          hint={
            metrics.monthInProgress
              ? samePeriodHint(metrics.monthElapsedDays)
              : "vs. mês anterior"
          }
        />
        <StatCard
          label="Ticket médio"
          value={money(metrics.averageTicketCents)}
          hint={`${metrics.ordersMonth} serviços no mês`}
          icon={<BarChart3 size={17} />}
        />
        <StatCard
          label="Taxa de recompra"
          value={`${retentionRate}%`}
          hint={`${returningCustomers} clientes voltaram mais de uma vez`}
          icon={<Repeat2 size={17} />}
          tone={retentionRate >= 50 ? "volt" : "warning"}
        />
      </div>

      <Card>
        <CardHeader
          title="Faturamento mês a mês"
          description={
            metrics.monthInProgress
              ? "Ordens concluídas nos últimos 12 meses. O mês atual ainda está em andamento."
              : "Ordens de serviço concluídas nos últimos 12 meses."
          }
        />
        <CardBody>
          <LineChart data={revenue12} format={(value) => moneyCompact(value)} height={220} />
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Serviços que mais faturam"
            description="Últimos 6 meses, por receita gerada."
          />
          {services.length === 0 ? (
            <EmptyState icon={<BarChart3 size={20} />} title="Sem serviços concluídos" />
          ) : (
            <CardBody className="space-y-4">
              {services.slice(0, 8).map((service) => (
                <div key={service.name}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-soft">{service.name}</span>
                    <span className="shrink-0 font-medium text-white">
                      {money(service.revenueCents)}
                    </span>
                  </div>
                  <Meter value={service.revenueCents} max={maxServiceRevenue} />
                  <p className="mt-1 text-[0.68rem] text-muted">
                    {service.count} {service.count === 1 ? "venda" : "vendas"}
                  </p>
                </div>
              ))}
            </CardBody>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Origem dos clientes"
              description="De onde vem quem chega até você."
            />
            <CardBody>
              {origins.length === 0 ? (
                <EmptyState icon={<Users size={20} />} title="Sem dados de origem" />
              ) : (
                <DonutChart
                  data={origins.map((origin, index) => ({
                    ...origin,
                    color: ORIGIN_COLORS[index % ORIGIN_COLORS.length],
                  }))}
                  centerLabel="clientes"
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Novos clientes por mês"
              description="Crescimento da base nos últimos 6 meses."
            />
            <CardBody>
              <BarChart data={newByMonth} height={140} />
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Formas de pagamento" description="Somente ordens concluídas." />
          {payments.length === 0 ? (
            <EmptyState icon={<CircleDollarSign size={20} />} title="Sem pagamentos registrados" />
          ) : (
            <Table className="min-w-0">
              <thead>
                <tr>
                  <Th>Forma</Th>
                  <Th className="text-right">Ordens</Th>
                  <Th className="text-right">Valor</Th>
                  <Th className="text-right">Participação</Th>
                </tr>
              </thead>
              <tbody>
                {payments
                  .sort((a, b) => (b._sum.totalCents ?? 0) - (a._sum.totalCents ?? 0))
                  .map((row) => {
                    const value = row._sum.totalCents ?? 0;
                    const share = paymentTotal > 0 ? Math.round((value / paymentTotal) * 100) : 0;
                    return (
                      <Tr key={row.paymentMethod ?? "outro"}>
                        <Td className="text-sm text-soft">
                          {PAYMENT_LABEL[row.paymentMethod ?? ""] ?? row.paymentMethod}
                        </Td>
                        <Td className="text-right text-sm text-soft">{row._count._all}</Td>
                        <Td className="text-right text-sm font-medium text-white">
                          {money(value)}
                        </Td>
                        <Td className="text-right text-sm text-volt-300">{share}%</Td>
                      </Tr>
                    );
                  })}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Clientes por valor gerado"
            description="Seus 8 clientes mais valiosos."
          />
          {retention.customers.length === 0 ? (
            <EmptyState icon={<Users size={20} />} title="Sem clientes" />
          ) : (
            <Table className="min-w-0">
              <thead>
                <tr>
                  <Th>Cliente</Th>
                  <Th className="text-right">Visitas</Th>
                  <Th className="text-right">Ticket médio</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {[...retention.customers]
                  .sort((a, b) => b.totalSpentCents - a.totalSpentCents)
                  .slice(0, 8)
                  .map((customer) => (
                    <Tr key={customer.id}>
                      <Td className="text-sm text-white">{customer.name}</Td>
                      <Td className="text-right text-sm text-soft">{customer.visits}</Td>
                      <Td className="text-right text-sm text-soft">
                        {money(customer.averageTicketCents)}
                      </Td>
                      <Td className="text-right text-sm font-medium text-white">
                        {money(customer.totalSpentCents)}
                      </Td>
                    </Tr>
                  ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
