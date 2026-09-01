import type { Metadata } from "next";
import Link from "next/link";
import { CircleDollarSign, Plus, Wrench } from "lucide-react";

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
import { dateFull, money, time } from "@/lib/format";
import { PAYMENT_LABEL, WORK_ORDER_STATUS, statusOf } from "@/lib/labels";
import { startOfMonth } from "@/lib/metrics";
import { requireContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Ordens de Serviço" };

const BOARD = ["aberta", "em_andamento", "aguardando_retirada"] as const;

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { company } = await requireContext();
  const statusFilter = (await searchParams).status ?? "";

  const [orders, active, monthOrders] = await Promise.all([
    db.workOrder.findMany({
      where: { companyId: company.id, ...(statusFilter ? { status: statusFilter } : {}) },
      orderBy: [{ finishedAt: "desc" }, { openedAt: "desc" }],
      take: 60,
      include: {
        customer: { select: { id: true, name: true } },
        vehicle: { select: { brand: true, model: true, plate: true } },
        items: true,
      },
    }),
    db.workOrder.findMany({
      where: { companyId: company.id, status: { in: [...BOARD] } },
      orderBy: { openedAt: "asc" },
      include: {
        customer: { select: { id: true, name: true } },
        vehicle: { select: { brand: true, model: true } },
        items: true,
      },
    }),
    db.workOrder.findMany({
      where: { companyId: company.id, status: "concluida", finishedAt: { gte: startOfMonth() } },
      select: { totalCents: true },
    }),
  ]);

  const monthRevenue = monthOrders.reduce((sum, order) => sum + order.totalCents, 0);
  const inProgressValue = active.reduce((sum, order) => sum + order.totalCents, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operação"
        title="Ordens de Serviço"
        description="Da entrada do carro à entrega. Cada OS concluída alimenta o histórico e o ciclo de retorno do cliente."
        actions={
          <ButtonLink href="/ordens?nova=1" size="md">
            <Plus size={16} />
            Nova OS
          </ButtonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="No pátio agora" value={active.length} hint="Abertas, em andamento e aguardando" icon={<Wrench size={17} />} tone={active.length > 0 ? "volt" : "default"} />
        <StatCard label="Valor em execução" value={money(inProgressValue)} hint="A faturar quando entregar" />
        <StatCard label="Concluídas no mês" value={monthOrders.length} hint="Serviços entregues" />
        <StatCard label="Faturamento do mês" value={money(monthRevenue)} hint="Somente OS concluídas" icon={<CircleDollarSign size={17} />} tone="volt" />
      </div>

      {/* Quadro operacional */}
      <div className="grid gap-4 lg:grid-cols-3">
        {BOARD.map((status) => {
          const meta = statusOf(WORK_ORDER_STATUS, status);
          const list = active.filter((order) => order.status === status);
          return (
            <Card key={status} className="flex flex-col">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <Badge tone={meta.tone} dot>
                  {meta.label}
                </Badge>
                <span className="font-display text-sm font-bold text-white">{list.length}</span>
              </div>
              <div className="flex-1 space-y-2.5 p-3">
                {list.length === 0 ? (
                  <p className="px-2 py-8 text-center text-xs text-muted">Nada nesta etapa</p>
                ) : (
                  list.map((order) => (
                    <div
                      key={order.id}
                      className="rounded-xl border border-line bg-ink-850/60 p-3.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-[0.7rem] font-bold text-muted">
                          OS #{String(order.number).padStart(4, "0")}
                        </span>
                        <span className="text-sm font-medium text-white">
                          {money(order.totalCents)}
                        </span>
                      </div>
                      <Link
                        href={`/clientes/${order.customer.id}`}
                        className="focus-ring mt-1.5 block truncate rounded text-sm font-medium text-white hover:text-volt-300"
                      >
                        {order.customer.name}
                      </Link>
                      <p className="truncate text-xs text-muted">
                        {order.vehicle
                          ? `${order.vehicle.brand} ${order.vehicle.model}`
                          : "Sem veículo"}
                      </p>
                      <p className="mt-2 truncate text-[0.7rem] text-soft">
                        {order.items.map((item) => item.description).join(", ")}
                      </p>
                      <p className="mt-2 text-[0.68rem] text-muted">
                        Aberta em {dateFull(order.openedAt)} às {time(order.openedAt)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader
          title={statusFilter ? `OS: ${statusOf(WORK_ORDER_STATUS, statusFilter).label}` : "Histórico de ordens"}
          description={`${orders.length} ${orders.length === 1 ? "registro" : "registros"} mais recentes.`}
          action={
            <div className="flex flex-wrap gap-1.5">
              <Link
                href="/ordens"
                className={`focus-ring rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  !statusFilter ? "bg-volt-400 text-ink-950" : "border border-line text-soft hover:text-white"
                }`}
              >
                Todas
              </Link>
              {Object.entries(WORK_ORDER_STATUS).map(([key, meta]) => (
                <Link
                  key={key}
                  href={`/ordens?status=${key}`}
                  className={`focus-ring rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    statusFilter === key
                      ? "bg-volt-400 text-ink-950"
                      : "border border-line text-soft hover:text-white"
                  }`}
                >
                  {meta.label}
                </Link>
              ))}
            </div>
          }
        />

        {orders.length === 0 ? (
          <EmptyState
            icon={<Wrench size={20} />}
            title="Nenhuma ordem de serviço"
            description="Abra a primeira OS para começar a registrar o faturamento e o histórico dos clientes."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Nº</Th>
                <Th>Cliente</Th>
                <Th>Veículo</Th>
                <Th>Serviços</Th>
                <Th>Conclusão</Th>
                <Th>Pagamento</Th>
                <Th className="text-right">Valor</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const meta = statusOf(WORK_ORDER_STATUS, order.status);
                return (
                  <Tr key={order.id}>
                    <Td className="font-display text-xs font-bold text-muted">
                      #{String(order.number).padStart(4, "0")}
                    </Td>
                    <Td>
                      <Link
                        href={`/clientes/${order.customer.id}`}
                        className="focus-ring rounded text-sm font-medium text-white hover:text-volt-300"
                      >
                        {order.customer.name}
                      </Link>
                    </Td>
                    <Td className="text-sm text-soft">
                      {order.vehicle ? (
                        <>
                          <span className="block">
                            {order.vehicle.brand} {order.vehicle.model}
                          </span>
                          <span className="block font-mono text-[0.7rem] text-muted">
                            {order.vehicle.plate ?? "—"}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                    <Td className="max-w-xs">
                      <span className="block truncate text-sm text-soft">
                        {order.items.map((item) => item.description).join(", ")}
                      </span>
                    </Td>
                    <Td className="text-sm text-soft">
                      {order.finishedAt ? (
                        dateFull(order.finishedAt)
                      ) : (
                        <span className="text-muted">Em aberto</span>
                      )}
                    </Td>
                    <Td className="text-sm text-soft">
                      {order.paymentMethod ? (
                        PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                    <Td className="text-right font-medium text-white">{money(order.totalCents)}</Td>
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
