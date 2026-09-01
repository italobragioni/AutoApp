import "server-only";

import { db } from "@/lib/db";

/** Consultas agregadas usadas no Dashboard e nos Relatórios. Sempre por companyId. */

const DAY = 24 * 60 * 60 * 1000;

export function startOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

export function endOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

export type RevenuePoint = { label: string; value: number };

/** Faturamento (ordens concluídas) dos últimos N meses. */
export async function revenueByMonth(companyId: string, months = 6): Promise<RevenuePoint[]> {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const orders = await db.workOrder.findMany({
    where: { companyId, status: "concluida", finishedAt: { gte: from } },
    select: { finishedAt: true, totalCents: true },
  });

  const buckets: RevenuePoint[] = [];
  for (let index = 0; index < months; index++) {
    const date = new Date(now.getFullYear(), now.getMonth() - (months - 1 - index), 1);
    buckets.push({ label: monthLabel(date), value: 0 });
  }

  for (const order of orders) {
    if (!order.finishedAt) continue;
    const diff =
      (order.finishedAt.getFullYear() - from.getFullYear()) * 12 +
      (order.finishedAt.getMonth() - from.getMonth());
    if (diff >= 0 && diff < months) buckets[diff].value += order.totalCents;
  }

  return buckets;
}

export type DashboardMetrics = {
  revenueMonthCents: number;
  revenuePreviousMonthCents: number;
  revenueDelta: number | null;
  ordersMonth: number;
  averageTicketCents: number;
  appointmentsToday: number;
  appointmentsWeek: number;
  openQuotes: number;
  openQuotesValueCents: number;
  activeWorkOrders: number;
  customersTotal: number;
  customersNewMonth: number;
  vehiclesTotal: number;
  /** true enquanto o mes corrente nao terminou — o comparativo e parcial. */
  monthInProgress: boolean;
  /** Dias ja decorridos do mes corrente. */
  monthElapsedDays: number;
};

export async function getDashboardMetrics(companyId: string): Promise<DashboardMetrics> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // O mes corrente esta em andamento. Compara-lo com um mes anterior COMPLETO
  // faria o painel mostrar uma queda enorme todo dia 1. Por isso o comparativo
  // usa o mesmo intervalo de dias do mes passado (dia 1 ate hoje), limitado ao
  // ultimo dia daquele mes.
  const previousMonthLastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const previousSamePeriodEnd = endOfDay(
    new Date(
      previousStart.getFullYear(),
      previousStart.getMonth(),
      Math.min(now.getDate(), previousMonthLastDay),
    ),
  );

  const [
    monthOrders,
    previousOrders,
    appointmentsToday,
    appointmentsWeek,
    openQuotes,
    activeWorkOrders,
    customersTotal,
    customersNewMonth,
    vehiclesTotal,
  ] = await Promise.all([
    db.workOrder.findMany({
      where: { companyId, status: "concluida", finishedAt: { gte: monthStart } },
      select: { totalCents: true },
    }),
    db.workOrder.findMany({
      where: {
        companyId,
        status: "concluida",
        finishedAt: { gte: previousStart, lte: previousSamePeriodEnd },
      },
      select: { totalCents: true },
    }),
    db.appointment.count({
      where: {
        companyId,
        startsAt: { gte: startOfDay(now), lte: endOfDay(now) },
        status: { notIn: ["cancelado"] },
      },
    }),
    db.appointment.count({
      where: {
        companyId,
        startsAt: { gte: startOfDay(now), lte: endOfDay(new Date(now.getTime() + 7 * DAY)) },
        status: { notIn: ["cancelado"] },
      },
    }),
    db.quote.findMany({
      where: { companyId, status: { in: ["rascunho", "enviado"] } },
      select: { totalCents: true },
    }),
    db.workOrder.count({
      where: { companyId, status: { in: ["aberta", "em_andamento", "aguardando_retirada"] } },
    }),
    db.customer.count({ where: { companyId } }),
    db.customer.count({ where: { companyId, createdAt: { gte: monthStart } } }),
    db.vehicle.count({ where: { companyId } }),
  ]);

  const revenueMonthCents = monthOrders.reduce((sum, order) => sum + order.totalCents, 0);
  const revenuePreviousMonthCents = previousOrders.reduce((sum, order) => sum + order.totalCents, 0);

  return {
    revenueMonthCents,
    revenuePreviousMonthCents,
    revenueDelta:
      revenuePreviousMonthCents > 0
        ? ((revenueMonthCents - revenuePreviousMonthCents) / revenuePreviousMonthCents) * 100
        : null,
    ordersMonth: monthOrders.length,
    averageTicketCents:
      monthOrders.length > 0 ? Math.round(revenueMonthCents / monthOrders.length) : 0,
    appointmentsToday,
    appointmentsWeek,
    openQuotes: openQuotes.length,
    openQuotesValueCents: openQuotes.reduce((sum, quote) => sum + quote.totalCents, 0),
    activeWorkOrders,
    customersTotal,
    customersNewMonth,
    vehiclesTotal,
    monthInProgress: now.getDate() < new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    monthElapsedDays: now.getDate(),
  };
}

/** Ranking de serviços por receita no período (usado em Relatórios). */
export async function topServices(companyId: string, sinceDays = 180) {
  const since = new Date(Date.now() - sinceDays * DAY);

  const items = await db.workOrderItem.findMany({
    where: { workOrder: { companyId, status: "concluida", finishedAt: { gte: since } } },
    select: { description: true, quantity: true, unitPriceCents: true },
  });

  const map = new Map<string, { name: string; count: number; revenueCents: number }>();
  for (const item of items) {
    const current = map.get(item.description) ?? {
      name: item.description,
      count: 0,
      revenueCents: 0,
    };
    current.count += item.quantity;
    current.revenueCents += item.quantity * item.unitPriceCents;
    map.set(item.description, current);
  }

  return [...map.values()].sort((a, b) => b.revenueCents - a.revenueCents);
}

/** Distribuição de clientes por origem — de onde vem o faturamento novo. */
export async function customersByOrigin(companyId: string) {
  const grouped = await db.customer.groupBy({
    by: ["origin"],
    where: { companyId },
    _count: { _all: true },
  });

  const LABEL: Record<string, string> = {
    indicacao: "Indicação",
    instagram: "Instagram",
    google: "Google",
    passagem: "Passagem",
    outro: "Outro",
  };

  return grouped
    .map((row) => ({ label: LABEL[row.origin] ?? row.origin, value: row._count._all }))
    .sort((a, b) => b.value - a.value);
}
