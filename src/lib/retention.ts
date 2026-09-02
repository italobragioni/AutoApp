import "server-only";

import { db } from "@/lib/db";
import { daysBetween } from "@/lib/format";

/**
 * Motor de retencao do AUTOVOLT.
 *
 * E o que diferencia o produto de um ERP generico: em vez de so registrar o que
 * ja aconteceu, ele olha o historico de cada cliente e responde
 * "quem deveria estar voltando agora e nao voltou?".
 */

export type RetentionStage = "novo" | "em_dia" | "atencao" | "em_risco" | "inativo";

export const STAGE_LABEL: Record<RetentionStage, string> = {
  novo: "Novo",
  em_dia: "Em dia",
  atencao: "Atenção",
  em_risco: "Em risco",
  inativo: "Inativo",
};

export const STAGE_TONE: Record<RetentionStage, "neutral" | "success" | "warning" | "danger" | "muted"> = {
  novo: "neutral",
  em_dia: "success",
  atencao: "warning",
  em_risco: "danger",
  inativo: "muted",
};

export const STAGE_HINT: Record<RetentionStage, string> = {
  novo: "Ainda sem histórico de serviço concluído.",
  em_dia: "Dentro do ciclo ideal de retorno.",
  atencao: "Passou do ciclo ideal. Bom momento para um lembrete.",
  em_risco: "Atrasado no retorno. Contato agora evita a perda.",
  inativo: "Sem retorno há muito tempo. Vale uma oferta de reativação.",
};

export type RetentionCustomer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  /** So transporte: o publico de aniversariantes le daqui. Nao entra em
   *  nenhum calculo de estagio. */
  birthDate: Date | null;
  stage: RetentionStage;
  /** Dias desde o ultimo servico concluido. null = nunca fez servico. */
  daysSinceLastVisit: number | null;
  lastVisitAt: Date | null;
  /** Data em que o cliente "deveria" voltar, com base no ciclo do ultimo servico. */
  dueAt: Date | null;
  /** Quantos dias esta atrasado em relacao ao dueAt (0 quando em dia). */
  overdueDays: number;
  visits: number;
  totalSpentCents: number;
  averageTicketCents: number;
  lastServices: string[];
  vehicleLabel: string | null;
  /** Receita esperada se este cliente voltar (media historica dele). */
  opportunityCents: number;
};

export type RetentionSummary = {
  customers: RetentionCustomer[];
  byStage: Record<RetentionStage, RetentionCustomer[]>;
  counts: Record<RetentionStage, number>;
  /** Soma do ticket medio dos clientes em atencao/risco/inativo. */
  opportunityCents: number;
  /** Estritamente em risco + inativos. */
  atRiskCount: number;
  /**
   * Todos que passaram do ciclo ideal (atencao + em risco + inativos).
   * E o numero de "coisas a fazer" da tela de Retencao — use este sempre que o
   * rotulo for "precisam de contato".
   */
  needsContactCount: number;
};

function stageFor(
  daysSinceLastVisit: number | null,
  overdueDays: number,
  inactiveAfterDays: number,
): RetentionStage {
  if (daysSinceLastVisit === null) return "novo";
  if (daysSinceLastVisit >= inactiveAfterDays) return "inativo";
  if (overdueDays <= 0) return "em_dia";
  if (overdueDays <= 30) return "atencao";
  return "em_risco";
}

/**
 * Calcula o estagio de retencao de todos os clientes da empresa.
 * Sempre escopado por companyId — nunca recebe dados de outro tenant.
 */
export async function getRetention(companyId: string): Promise<RetentionSummary> {
  const company = await db.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { retentionWindowDays: true, inactiveAfterDays: true },
  });

  const customers = await db.customer.findMany({
    where: { companyId },
    include: {
      vehicles: { select: { brand: true, model: true }, take: 1 },
      workOrders: {
        where: { status: "concluida" },
        orderBy: { finishedAt: "desc" },
        include: {
          items: { include: { serviceItem: { select: { name: true, recurrenceDays: true } } } },
        },
      },
    },
  });

  const now = new Date();

  const result: RetentionCustomer[] = customers.map((customer) => {
    const done = customer.workOrders.filter((order) => order.finishedAt);
    const visits = done.length;
    const totalSpentCents = done.reduce((sum, order) => sum + order.totalCents, 0);
    const averageTicketCents = visits > 0 ? Math.round(totalSpentCents / visits) : 0;

    const last = done[0] ?? null;
    const lastVisitAt = last?.finishedAt ?? null;
    const daysSinceLastVisit = lastVisitAt ? daysBetween(lastVisitAt, now) : null;

    // O ciclo de retorno vem do servico mais "recorrente" do ultimo atendimento;
    // se nenhum servico definir recorrencia, cai no padrao da empresa.
    const cycles = (last?.items ?? [])
      .map((item) => item.serviceItem?.recurrenceDays)
      .filter((value): value is number => typeof value === "number" && value > 0);
    const cycleDays = cycles.length > 0 ? Math.min(...cycles) : company.retentionWindowDays;

    let dueAt: Date | null = null;
    let overdueDays = 0;
    if (lastVisitAt) {
      dueAt = new Date(lastVisitAt.getTime() + cycleDays * 24 * 60 * 60 * 1000);
      overdueDays = Math.max(0, daysBetween(dueAt, now));
    }

    const stage = stageFor(daysSinceLastVisit, overdueDays, company.inactiveAfterDays);
    const vehicle = customer.vehicles[0];

    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      birthDate: customer.birthDate,
      stage,
      daysSinceLastVisit,
      lastVisitAt,
      dueAt,
      overdueDays,
      visits,
      totalSpentCents,
      averageTicketCents,
      lastServices: (last?.items ?? []).map((item) => item.description).slice(0, 3),
      vehicleLabel: vehicle ? `${vehicle.brand} ${vehicle.model}` : null,
      opportunityCents: averageTicketCents,
    };
  });

  result.sort((a, b) => b.overdueDays - a.overdueDays || b.totalSpentCents - a.totalSpentCents);

  const byStage: Record<RetentionStage, RetentionCustomer[]> = {
    novo: [],
    em_dia: [],
    atencao: [],
    em_risco: [],
    inativo: [],
  };
  for (const customer of result) byStage[customer.stage].push(customer);

  const counts = Object.fromEntries(
    Object.entries(byStage).map(([stage, list]) => [stage, list.length]),
  ) as Record<RetentionStage, number>;

  const recoverable = [...byStage.atencao, ...byStage.em_risco, ...byStage.inativo];

  return {
    customers: result,
    byStage,
    counts,
    opportunityCents: recoverable.reduce((sum, c) => sum + c.opportunityCents, 0),
    atRiskCount: byStage.em_risco.length + byStage.inativo.length,
    needsContactCount: recoverable.length,
  };
}

/** Publicos-alvo disponiveis para campanhas, derivados do motor de retencao. */
export const AUDIENCE_LABEL: Record<string, string> = {
  todos: "Todos os clientes",
  atencao: "Clientes em atenção",
  em_risco: "Clientes em risco",
  inativos: "Clientes inativos",
  aniversariantes: "Aniversariantes do mês",
  sem_retorno: "Sem retorno no ciclo",
  vip: "Clientes VIP",
};

/**
 * Aniversariantes de um mes, por dia e mes de nascimento.
 *
 * O ano nao entra: o que importa e a data comemorativa, nao a idade. O mes vem
 * por parametro para que outros periodos (proxima semana, intervalo escolhido)
 * possam ser adicionados depois sem mexer em quem chama.
 */
function birthdaysIn(customers: RetentionCustomer[], month: number) {
  return customers
    .filter((customer) => customer.birthDate !== null && customer.birthDate.getMonth() === month)
    .sort((a, b) => (a.birthDate!.getDate() ?? 0) - (b.birthDate!.getDate() ?? 0));
}

/** Publicos oferecidos na criacao de campanha, na ordem em que aparecem. */
export const CAMPAIGN_AUDIENCES = [
  "atencao",
  "em_risco",
  "inativos",
  "vip",
  "aniversariantes",
  "todos",
];

export function audienceFor(
  summary: RetentionSummary,
  audience: string,
  now: Date = new Date(),
): RetentionCustomer[] {
  switch (audience) {
    case "atencao":
      return summary.byStage.atencao;
    case "em_risco":
      return summary.byStage.em_risco;
    case "inativos":
      return summary.byStage.inativo;
    case "sem_retorno":
      return [...summary.byStage.atencao, ...summary.byStage.em_risco];
    case "vip":
      return [...summary.customers]
        .sort((a, b) => b.totalSpentCents - a.totalSpentCents)
        .slice(0, 10);
    case "aniversariantes":
      // Por enquanto sempre o mes corrente — e o periodo pedido nesta etapa.
      return birthdaysIn(summary.customers, now.getMonth());
    default:
      return summary.customers;
  }
}
