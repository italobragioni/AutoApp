import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { PAYMENT_LABEL } from "@/lib/labels";
import { daysIn, previousPeriod, type Period, type Range } from "@/lib/period";

export {
  DEFAULT_PERIOD,
  PERIOD_PRESETS,
  previousPeriod,
  resolvePeriod,
  type Period,
  type PeriodKey,
  type Range,
} from "@/lib/period";

/**
 * Consultas de Relatorios.
 *
 * Tudo aqui recebe um periodo e um companyId, e nenhuma consulta existe sem os
 * dois. O companyId vem SEMPRE da sessao (a pagina e a rota de exportacao
 * resolvem antes de chamar), nunca do formulario ou da URL.
 *
 * O faturamento tem uma definicao unica, repetida em todas as consultas:
 * Ordem de Servico com `status = "concluida"` e `finishedAt` dentro do periodo.
 * OS aberta, cancelada e orcamento nao entram em nenhum numero.
 *
 * As agregacoes ficam no banco. Onde `groupBy` do Prisma nao alcanca — receita
 * por servico precisa de `SUM(quantidade * preco)` e as series precisam de
 * `date_trunc` — o SQL e escrito a mao com parametros, nunca por concatenacao.
 */

/** Filtro de faturamento: a definicao unica, em um lugar so. */
function completedIn(companyId: string, range: Range) {
  return {
    companyId,
    status: "concluida",
    finishedAt: { gte: range.from, lte: range.to },
  } as const;
}

/* -------------------------------------------------------------------------- */
/* Resumo                                                                      */
/* -------------------------------------------------------------------------- */

export type Summary = {
  revenueCents: number;
  orders: number;
  averageTicketCents: number;
  /** Clientes distintos com pelo menos uma OS concluida no periodo. */
  customersServed: number;
  /** Desses, quantos concluiram mais de uma. */
  returningCustomers: number;
  /** 0 a 1. Zero quando ninguem foi atendido — sem divisao por zero. */
  repurchaseRate: number;
  newCustomers: number;
  /** true quando nao houve nenhuma OS concluida nem cliente novo no periodo. */
  empty: boolean;
};

/**
 * Os numeros do topo, em tres consultas agregadas.
 *
 * O `groupBy` por cliente serve a dois indicadores ao mesmo tempo: quantos
 * clientes foram atendidos (numero de grupos) e quantos voltaram (grupos com
 * mais de uma OS). E tambem alimenta o ranking, sem consulta nova.
 */
export async function reportSummary(companyId: string, range: Range): Promise<Summary> {
  const [totals, byCustomer, newCustomers] = await Promise.all([
    db.workOrder.aggregate({
      where: completedIn(companyId, range),
      _sum: { totalCents: true },
      _count: { _all: true },
    }),
    db.workOrder.groupBy({
      by: ["customerId"],
      where: completedIn(companyId, range),
      _sum: { totalCents: true },
      _count: { _all: true },
    }),
    db.customer.count({
      where: { companyId, createdAt: { gte: range.from, lte: range.to } },
    }),
  ]);

  const revenueCents = totals._sum.totalCents ?? 0;
  const orders = totals._count._all;
  const customersServed = byCustomer.length;
  const returningCustomers = byCustomer.filter((row) => row._count._all > 1).length;

  return {
    revenueCents,
    orders,
    averageTicketCents: orders > 0 ? Math.round(revenueCents / orders) : 0,
    customersServed,
    returningCustomers,
    repurchaseRate: customersServed > 0 ? returningCustomers / customersServed : 0,
    newCustomers,
    empty: orders === 0 && newCustomers === 0,
  };
}

export type Comparison = {
  current: number;
  previous: number;
  /** Diferenca absoluta (atual − anterior). */
  diff: number;
  /**
   * Variacao percentual, ou null quando o periodo anterior foi zero — nesse
   * caso nao existe percentual honesto, e a interface diz isso em palavras.
   */
  percent: number | null;
};

export function compare(current: number, previous: number): Comparison {
  return {
    current,
    previous,
    diff: current - previous,
    percent: previous > 0 ? ((current - previous) / previous) * 100 : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Series                                                                      */
/* -------------------------------------------------------------------------- */

export type SeriesPoint = { label: string; value: number };
type Bucket = "day" | "week" | "month";

/** Granularidade que cabe no periodo: um ponto por dia nao serve para um ano. */
export function bucketFor(range: Range): Bucket {
  const days = daysIn(range);
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
}

function bucketLabel(date: Date, bucket: Bucket) {
  if (bucket === "month") {
    return date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/**
 * `date_trunc` agrupa no banco. O nome da unidade nao vem da URL: e escolhido
 * por `bucketFor` entre tres valores fixos, entao nao ha o que injetar.
 */
function truncUnit(bucket: Bucket) {
  return bucket === "day" ? "day" : bucket === "week" ? "week" : "month";
}

/** Faturamento por dia/semana/mes dentro do periodo. */
export async function revenueSeries(
  companyId: string,
  range: Range,
): Promise<SeriesPoint[]> {
  const bucket = bucketFor(range);
  const rows = await db.$queryRaw<{ periodo: Date; total: bigint | number }[]>(
    Prisma.sql`
      SELECT date_trunc(${truncUnit(bucket)}, "finishedAt") AS periodo,
             SUM("totalCents") AS total
        FROM work_orders
       WHERE "companyId" = ${companyId}
         AND status = 'concluida'
         AND "finishedAt" BETWEEN ${range.from} AND ${range.to}
       GROUP BY periodo
       ORDER BY periodo
    `,
  );

  return rows.map((row) => ({
    label: bucketLabel(new Date(row.periodo), bucket),
    value: Number(row.total ?? 0),
  }));
}

/** Clientes cadastrados por dia/semana/mes dentro do periodo. */
export async function newCustomersSeries(
  companyId: string,
  range: Range,
): Promise<SeriesPoint[]> {
  const bucket = bucketFor(range);
  const rows = await db.$queryRaw<{ periodo: Date; total: bigint | number }[]>(
    Prisma.sql`
      SELECT date_trunc(${truncUnit(bucket)}, "createdAt") AS periodo,
             COUNT(*) AS total
        FROM customers
       WHERE "companyId" = ${companyId}
         AND "createdAt" BETWEEN ${range.from} AND ${range.to}
       GROUP BY periodo
       ORDER BY periodo
    `,
  );

  return rows.map((row) => ({
    label: bucketLabel(new Date(row.periodo), bucket),
    value: Number(row.total ?? 0),
  }));
}

/* -------------------------------------------------------------------------- */
/* Quebras                                                                     */
/* -------------------------------------------------------------------------- */

export type ServiceRow = { name: string; count: number; revenueCents: number };

/**
 * Servicos por receita no periodo.
 *
 * `SUM(quantidade * preco)` nao cabe no `groupBy` do Prisma, e trazer todos os
 * itens para somar em memoria seria pior — entao a conta e feita no banco.
 */
export async function servicesInPeriod(
  companyId: string,
  range: Range,
): Promise<ServiceRow[]> {
  const rows = await db.$queryRaw<
    { name: string; vendas: bigint | number; receita: bigint | number }[]
  >(
    Prisma.sql`
      SELECT i.description AS name,
             SUM(i.quantity) AS vendas,
             SUM(i.quantity * i."unitPriceCents") AS receita
        FROM work_order_items i
        JOIN work_orders o ON o.id = i."workOrderId"
       WHERE o."companyId" = ${companyId}
         AND o.status = 'concluida'
         AND o."finishedAt" BETWEEN ${range.from} AND ${range.to}
       GROUP BY i.description
       ORDER BY receita DESC
    `,
  );

  return rows.map((row) => ({
    name: row.name,
    count: Number(row.vendas ?? 0),
    revenueCents: Number(row.receita ?? 0),
  }));
}

export type PaymentRow = { method: string; label: string; orders: number; revenueCents: number };

/** Formas de pagamento das OS concluidas no periodo. */
export async function paymentsInPeriod(
  companyId: string,
  range: Range,
): Promise<PaymentRow[]> {
  const rows = await db.workOrder.groupBy({
    by: ["paymentMethod"],
    where: completedIn(companyId, range),
    _count: { _all: true },
    _sum: { totalCents: true },
  });

  return rows
    .map((row) => ({
      method: row.paymentMethod ?? "nao_informado",
      label: row.paymentMethod
        ? (PAYMENT_LABEL[row.paymentMethod] ?? row.paymentMethod)
        : "Não informado",
      orders: row._count._all,
      revenueCents: row._sum.totalCents ?? 0,
    }))
    .sort((a, b) => b.revenueCents - a.revenueCents);
}

export type OriginRow = { label: string; value: number };

const ORIGIN_LABEL: Record<string, string> = {
  indicacao: "Indicação",
  instagram: "Instagram",
  google: "Google",
  passagem: "Passagem",
  outro: "Outro",
};

/**
 * Origem dos clientes cadastrados no periodo.
 *
 * Registro sem origem aparece como "Não informado" em vez de desaparecer da
 * conta — o total precisa fechar com o numero de clientes novos.
 */
export async function originsInPeriod(
  companyId: string,
  range: Range,
): Promise<OriginRow[]> {
  const rows = await db.customer.groupBy({
    by: ["origin"],
    where: { companyId, createdAt: { gte: range.from, lte: range.to } },
    _count: { _all: true },
  });

  const merged = new Map<string, number>();
  for (const row of rows) {
    const key = row.origin?.trim() ? row.origin.trim() : "nao_informado";
    const label = ORIGIN_LABEL[key] ?? (key === "nao_informado" ? "Não informado" : key);
    merged.set(label, (merged.get(label) ?? 0) + row._count._all);
  }

  return [...merged.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export type CustomerRow = {
  id: string;
  name: string;
  orders: number;
  revenueCents: number;
  averageTicketCents: number;
};

/**
 * Ranking por receita gerada no periodo.
 *
 * Agrega no banco e busca os nomes so dos que entram no ranking — nao carrega
 * a carteira inteira para ordenar em memoria.
 */
export async function customerRanking(
  companyId: string,
  range: Range,
  limit = 8,
): Promise<CustomerRow[]> {
  const grouped = await db.workOrder.groupBy({
    by: ["customerId"],
    where: completedIn(companyId, range),
    _sum: { totalCents: true },
    _count: { _all: true },
    orderBy: { _sum: { totalCents: "desc" } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  const names = await db.customer.findMany({
    // O companyId entra de novo aqui: nome de cliente de outra empresa nao
    // chega nem por acidente.
    where: { id: { in: grouped.map((row) => row.customerId) }, companyId },
    select: { id: true, name: true },
  });
  const nameById = new Map(names.map((customer) => [customer.id, customer.name]));

  return grouped
    .filter((row) => nameById.has(row.customerId))
    .map((row) => {
      const revenueCents = row._sum.totalCents ?? 0;
      const orders = row._count._all;
      return {
        id: row.customerId,
        name: nameById.get(row.customerId)!,
        orders,
        revenueCents,
        averageTicketCents: orders > 0 ? Math.round(revenueCents / orders) : 0,
      };
    });
}

/* -------------------------------------------------------------------------- */
/* Relatorio completo                                                         */
/* -------------------------------------------------------------------------- */

export type Report = {
  period: Period;
  previous: Range;
  summary: Summary;
  previousSummary: Summary;
  revenue: SeriesPoint[];
  newCustomers: SeriesPoint[];
  services: ServiceRow[];
  payments: PaymentRow[];
  origins: OriginRow[];
  ranking: CustomerRow[];
};

/**
 * Monta o relatorio inteiro do periodo.
 *
 * A tela e a exportacao chamam ESTA funcao — o CSV nao tem consulta propria,
 * entao arquivo e tela nunca divergem.
 */
export async function buildReport(companyId: string, period: Period): Promise<Report> {
  const previous = previousPeriod(period);

  const [summary, previousSummary, revenue, newCustomers, services, payments, origins, ranking] =
    await Promise.all([
      reportSummary(companyId, period),
      reportSummary(companyId, previous),
      revenueSeries(companyId, period),
      newCustomersSeries(companyId, period),
      servicesInPeriod(companyId, period),
      paymentsInPeriod(companyId, period),
      originsInPeriod(companyId, period),
      customerRanking(companyId, period),
    ]);

  return {
    period,
    previous,
    summary,
    previousSummary,
    revenue,
    newCustomers,
    services,
    payments,
    origins,
    ranking,
  };
}
