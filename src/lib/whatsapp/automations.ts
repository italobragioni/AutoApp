import "server-only";

import { db } from "@/lib/db";
import { getRetention } from "@/lib/retention";
import {
  ACTIVE_APPOINTMENT_STATUSES,
  POST_SERVICE_MAX_DAYS,
  POST_SERVICE_MIN_DAYS,
  REMINDER_LOOKAHEAD_HOURS,
  type AutomationType,
} from "@/lib/whatsapp/config";
import { normalizePhoneBR } from "@/lib/whatsapp/phone";
import type { MessageVars } from "@/lib/whatsapp/templates";

/**
 * Geração de candidatos por automação.
 *
 * Cada função devolve uma lista de "candidatos" a envio — a decisão final
 * (cooldown, janela de horário, deduplicação, template, provider) fica no
 * engine. Tudo escopado por companyId; nenhum dado de outra empresa é lido.
 */

export type Candidate = {
  type: AutomationType;
  customerId: string;
  vehicleId?: string | null;
  appointmentId?: string | null;
  workOrderId?: string | null;
  /** Chave de idempotência (única por empresa). */
  dedupeKey: string;
  /** Telefone normalizado (E.164) ou null quando não há número válido. */
  phone: string | null;
  vars: Partial<MessageVars>;
};

export type AutomationContext = {
  companyId: string;
  companyName: string;
  timezone: string;
  now: Date;
};

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function fmtDate(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit" }).format(
    date,
  );
}

function fmtTime(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(
    date,
  );
}

function baseVars(
  companyName: string,
  customerName: string,
  vehicle: { brand: string; model: string; plate: string | null } | null,
): Partial<MessageVars> {
  const veiculo = vehicle ? `${vehicle.brand} ${vehicle.model}`.trim() : "seu veículo";
  return {
    nome: customerName,
    primeiro_nome: firstName(customerName),
    empresa: companyName,
    veiculo,
    marca: vehicle?.brand ?? "",
    modelo: vehicle?.model ?? "",
    placa: vehicle?.plate ?? "",
  };
}

/** Veículo principal (mais antigo) de cada cliente, numa query só. */
async function primaryVehicles(companyId: string, customerIds: string[]) {
  const map = new Map<string, { id: string; brand: string; model: string; plate: string | null }>();
  if (customerIds.length === 0) return map;
  const vehicles = await db.vehicle.findMany({
    where: { companyId, customerId: { in: customerIds } },
    orderBy: { createdAt: "asc" },
    select: { id: true, customerId: true, brand: true, model: true, plate: true },
  });
  for (const v of vehicles) {
    if (!map.has(v.customerId)) {
      map.set(v.customerId, { id: v.id, brand: v.brand, model: v.model, plate: v.plate });
    }
  }
  return map;
}

/** Clientes com agendamento futuro ativo — não devem ser cutucados por retenção. */
async function customersWithFutureAppointment(companyId: string, now: Date) {
  const rows = await db.appointment.findMany({
    where: {
      companyId,
      startsAt: { gt: now },
      status: { in: ACTIVE_APPOINTMENT_STATUSES },
    },
    select: { customerId: true },
  });
  return new Set(rows.map((r) => r.customerId));
}

/** Automações 1 e 2: clientes em risco / inativos (motor de retenção). */
async function retentionCandidates(
  ctx: AutomationContext,
  stage: "em_risco" | "inativo",
  type: AutomationType,
): Promise<Candidate[]> {
  const retention = await getRetention(ctx.companyId);
  const list = retention.byStage[stage];
  if (list.length === 0) return [];

  const ids = list.map((c) => c.id);
  const [vehicles, futureAppt] = await Promise.all([
    primaryVehicles(ctx.companyId, ids),
    customersWithFutureAppointment(ctx.companyId, ctx.now),
  ]);

  const dayBucket = fmtDate(ctx.now, ctx.timezone).replace("/", "-");

  const candidates: Candidate[] = [];
  for (const customer of list) {
    // Já tem horário marcado: não precisa de mensagem de retenção.
    if (futureAppt.has(customer.id)) continue;
    const vehicle = vehicles.get(customer.id) ?? null;
    candidates.push({
      type,
      customerId: customer.id,
      vehicleId: vehicle?.id ?? null,
      dedupeKey: `${type}:${customer.id}:${dayBucket}`,
      phone: normalizePhoneBR(customer.phone),
      vars: baseVars(ctx.companyName, customer.name, vehicle),
    });
  }
  return candidates;
}

export function riskCandidates(ctx: AutomationContext) {
  return retentionCandidates(ctx, "em_risco", "risco");
}

export function inactiveCandidates(ctx: AutomationContext) {
  return retentionCandidates(ctx, "inativo", "inativo");
}

/** Automação 3: lembrete ~24h antes do agendamento. */
export async function reminderCandidates(ctx: AutomationContext): Promise<Candidate[]> {
  const until = new Date(ctx.now.getTime() + REMINDER_LOOKAHEAD_HOURS * MS_PER_HOUR);
  const appointments = await db.appointment.findMany({
    where: {
      companyId: ctx.companyId,
      startsAt: { gt: ctx.now, lte: until },
      status: { in: ACTIVE_APPOINTMENT_STATUSES },
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      vehicle: { select: { id: true, brand: true, model: true, plate: true } },
    },
  });

  return appointments.map((appt) => {
    const vehicle = appt.vehicle
      ? { brand: appt.vehicle.brand, model: appt.vehicle.model, plate: appt.vehicle.plate }
      : null;
    return {
      type: "lembrete" as const,
      customerId: appt.customerId,
      vehicleId: appt.vehicleId ?? null,
      appointmentId: appt.id,
      dedupeKey: `lembrete:${appt.id}`,
      phone: normalizePhoneBR(appt.customer.phone),
      vars: {
        ...baseVars(ctx.companyName, appt.customer.name, vehicle),
        data: fmtDate(appt.startsAt, ctx.timezone),
        horario: fmtTime(appt.startsAt, ctx.timezone),
      },
    };
  });
}

/** Automação 4: pós-serviço, alguns dias após a OS concluída. */
export async function postServiceCandidates(ctx: AutomationContext): Promise<Candidate[]> {
  const maxAgo = new Date(ctx.now.getTime() - POST_SERVICE_MAX_DAYS * MS_PER_DAY);
  const minAgo = new Date(ctx.now.getTime() - POST_SERVICE_MIN_DAYS * MS_PER_DAY);
  const orders = await db.workOrder.findMany({
    where: {
      companyId: ctx.companyId,
      status: "concluida",
      finishedAt: { gte: maxAgo, lte: minAgo },
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      vehicle: { select: { id: true, brand: true, model: true, plate: true } },
    },
  });

  return orders.map((order) => {
    const vehicle = order.vehicle
      ? { brand: order.vehicle.brand, model: order.vehicle.model, plate: order.vehicle.plate }
      : null;
    return {
      type: "pos_servico" as const,
      customerId: order.customerId,
      vehicleId: order.vehicleId ?? null,
      workOrderId: order.id,
      dedupeKey: `pos_servico:${order.id}`,
      phone: normalizePhoneBR(order.customer.phone),
      vars: baseVars(ctx.companyName, order.customer.name, vehicle),
    };
  });
}
