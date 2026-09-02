"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { permit } from "@/lib/authorize";
import { db } from "@/lib/db";
import { BLOCKING_STATUSES } from "@/lib/agenda";
import { parseMoneyToCents } from "@/lib/format";
import { APPOINTMENT_STATUS } from "@/lib/labels";

/**
 * Escrita do modulo Agenda.
 *
 * Sao QUATRO pontos de isolamento, nao dois. Alem do companyId vindo da sessao
 * e da posse do proprio agendamento, o formulario envia tres ids que precisam
 * ser validados contra a empresa antes de gravar:
 *
 *   customerId -> tem que ser cliente desta empresa
 *   vehicleId  -> tem que ser desta empresa E do cliente escolhido
 *   serviceIds -> todos tem que ser servicos desta empresa
 *
 * Sem essas checagens seria possivel montar um agendamento que atravessa
 * tenants pelas relacoes.
 *
 * Os status usados sao os que ja existiam no schema (APPOINTMENT_STATUS):
 * agendado, confirmado, em_andamento, concluido, cancelado e nao_compareceu.
 * Nao existe uma segunda estrutura de status neste arquivo.
 */

export type ConflictInfo = {
  customerName: string;
  startsAt: string;
  endsAt: string;
};

export type AppointmentState =
  | { ok?: boolean; error?: string; id?: string; conflicts?: ConflictInfo[] }
  | undefined;

const STATUSES = Object.keys(APPOINTMENT_STATUS) as [string, ...string[]];

const appointmentSchema = z.object({
  customerId: z.string().min(1, "Selecione o cliente."),
  vehicleId: z.string().min(1, "Selecione o veículo."),
  serviceIds: z.array(z.string()).min(1, "Selecione ao menos um serviço."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Informe o horário."),
  durationMin: z
    .string()
    .refine((v) => /^\d{1,4}$/.test(v.replace(/\D/g, "")), {
      message: "Informe a duração em minutos.",
    })
    .refine((v) => Number(v.replace(/\D/g, "")) >= 5, {
      message: "A duração mínima é de 5 minutos.",
    }),
  price: z.string().refine((v) => v.replace(/\D/g, "").length > 0, {
    message: "Informe o valor.",
  }),
  status: z.enum(STATUSES, { message: "Status inválido." }),
  notes: z.string().max(2000, "Observações muito longas."),
});

function readForm(formData: FormData) {
  return {
    customerId: String(formData.get("customerId") ?? "").trim(),
    vehicleId: String(formData.get("vehicleId") ?? "").trim(),
    serviceIds: formData.getAll("serviceIds").map((v) => String(v)).filter(Boolean),
    date: String(formData.get("date") ?? "").trim(),
    time: String(formData.get("time") ?? "").trim(),
    durationMin: String(formData.get("durationMin") ?? "").trim(),
    price: String(formData.get("price") ?? "").trim(),
    status: String(formData.get("status") ?? "agendado").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

/** Monta o intervalo a partir de data + hora local + duracao. */
function buildRange(date: string, time: string, durationMin: string) {
  const startsAt = new Date(`${date}T${time}:00`);
  const minutes = Number(durationMin.replace(/\D/g, ""));
  const endsAt = new Date(startsAt.getTime() + minutes * 60 * 1000);
  return { startsAt, endsAt };
}

/**
 * Valida que cliente, veiculo e servicos pertencem a empresa — e que o veiculo
 * e do cliente escolhido. Retorna a mensagem de erro ou null.
 */
async function assertOwnership(
  companyId: string,
  data: { customerId: string; vehicleId: string; serviceIds: string[] },
) {
  const customer = await db.customer.findFirst({
    where: { id: data.customerId, companyId },
    select: { id: true },
  });
  if (!customer) return "Cliente não encontrado nesta empresa.";

  // O veiculo precisa ser da empresa E do cliente selecionado.
  const vehicle = await db.vehicle.findFirst({
    where: { id: data.vehicleId, companyId, customerId: data.customerId },
    select: { id: true },
  });
  if (!vehicle) return "O veículo selecionado não pertence a este cliente.";

  const services = await db.serviceItem.findMany({
    where: { id: { in: data.serviceIds }, companyId },
    select: { id: true },
  });
  if (services.length !== data.serviceIds.length) {
    return "Serviço não encontrado nesta empresa.";
  }

  return null;
}

/**
 * Procura agendamentos que ocupam o mesmo intervalo.
 *
 * Nao ha entidade de box/recurso no schema, entao o conflito e por empresa: dois
 * atendimentos ao mesmo tempo. Cancelado e nao compareceu liberam o horario e
 * ficam de fora. O resultado e um AVISO — quem decide e o usuario.
 */
async function findConflicts(
  companyId: string,
  range: { startsAt: Date; endsAt: Date },
  ignoreId?: string,
): Promise<ConflictInfo[]> {
  const overlapping = await db.appointment.findMany({
    where: {
      companyId,
      status: { in: [...BLOCKING_STATUSES] },
      ...(ignoreId ? { id: { not: ignoreId } } : {}),
      // Sobreposicao: comeca antes do fim do novo E termina depois do inicio.
      startsAt: { lt: range.endsAt },
      endsAt: { gt: range.startsAt },
    },
    include: { customer: { select: { name: true } } },
    orderBy: { startsAt: "asc" },
    take: 5,
  });

  return overlapping.map((item) => ({
    customerName: item.customer.name,
    startsAt: item.startsAt.toISOString(),
    endsAt: item.endsAt.toISOString(),
  }));
}

function revalidateAgenda(customerId?: string, vehicleId?: string | null) {
  revalidatePath("/agenda");
  revalidatePath("/dashboard");
  if (customerId) revalidatePath(`/clientes/${customerId}`);
  if (vehicleId) revalidatePath(`/veiculos/${vehicleId}`);
}

export async function createAppointmentAction(
  _state: AppointmentState,
  formData: FormData,
): Promise<AppointmentState> {
  const gate = await permit("appointments.write");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;

  const parsed = appointmentSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ownershipError = await assertOwnership(company.id, parsed.data);
  if (ownershipError) return { error: ownershipError };

  const range = buildRange(parsed.data.date, parsed.data.time, parsed.data.durationMin);
  if (Number.isNaN(range.startsAt.getTime())) {
    return { error: "Data ou horário inválidos." };
  }

  // Aviso de conflito: so bloqueia na primeira tentativa. O usuario pode
  // confirmar e salvar mesmo assim (dois boxes, dois profissionais etc.).
  if (formData.get("force") !== "1") {
    const conflicts = await findConflicts(company.id, range);
    if (conflicts.length > 0) return { conflicts };
  }

  const appointment = await db.appointment.create({
    data: {
      companyId: company.id, // sempre da sessao
      customerId: parsed.data.customerId,
      vehicleId: parsed.data.vehicleId,
      startsAt: range.startsAt,
      endsAt: range.endsAt,
      status: parsed.data.status,
      priceCents: parseMoneyToCents(parsed.data.price),
      notes: parsed.data.notes || null,
      services: {
        create: parsed.data.serviceIds.map((serviceItemId) => ({ serviceItemId })),
      },
    },
    select: { id: true, customerId: true, vehicleId: true },
  });

  revalidateAgenda(appointment.customerId, appointment.vehicleId);
  return { ok: true, id: appointment.id };
}

export async function updateAppointmentAction(
  _state: AppointmentState,
  formData: FormData,
): Promise<AppointmentState> {
  const gate = await permit("appointments.write");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Agendamento não identificado." };

  const existing = await db.appointment.findFirst({
    where: { id, companyId: company.id },
    select: { id: true, customerId: true, vehicleId: true },
  });
  if (!existing) return { error: "Agendamento não encontrado nesta empresa." };

  const parsed = appointmentSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const ownershipError = await assertOwnership(company.id, parsed.data);
  if (ownershipError) return { error: ownershipError };

  const range = buildRange(parsed.data.date, parsed.data.time, parsed.data.durationMin);
  if (Number.isNaN(range.startsAt.getTime())) {
    return { error: "Data ou horário inválidos." };
  }

  if (formData.get("force") !== "1") {
    const conflicts = await findConflicts(company.id, range, existing.id);
    if (conflicts.length > 0) return { conflicts };
  }

  // Troca de servicos: apaga os vinculos antigos e recria. A tabela de juncao
  // nao guarda nada alem do par, entao nao ha informacao a preservar.
  await db.$transaction([
    db.appointmentService.deleteMany({ where: { appointmentId: existing.id } }),
    db.appointment.update({
      where: { id: existing.id },
      data: {
        customerId: parsed.data.customerId,
        vehicleId: parsed.data.vehicleId,
        startsAt: range.startsAt,
        endsAt: range.endsAt,
        status: parsed.data.status,
        priceCents: parseMoneyToCents(parsed.data.price),
        notes: parsed.data.notes || null,
        services: {
          create: parsed.data.serviceIds.map((serviceItemId) => ({ serviceItemId })),
        },
      },
    }),
  ]);

  // Se o cliente ou o veiculo mudou, as duas fichas precisam ser atualizadas.
  revalidateAgenda(existing.customerId, existing.vehicleId);
  revalidateAgenda(parsed.data.customerId, parsed.data.vehicleId);

  return { ok: true, id: existing.id };
}

/**
 * Troca apenas o status — confirmar, iniciar, finalizar, cancelar ou marcar
 * como nao compareceu. Usa os mesmos status do schema.
 */
export async function changeAppointmentStatusAction(
  _state: AppointmentState,
  formData: FormData,
): Promise<AppointmentState> {
  const gate = await permit("appointments.write");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id) return { error: "Agendamento não identificado." };
  if (!(status in APPOINTMENT_STATUS)) return { error: "Status inválido." };

  const existing = await db.appointment.findFirst({
    where: { id, companyId: company.id },
    select: { id: true, customerId: true, vehicleId: true },
  });
  if (!existing) return { error: "Agendamento não encontrado nesta empresa." };

  await db.appointment.update({ where: { id: existing.id }, data: { status } });

  revalidateAgenda(existing.customerId, existing.vehicleId);
  return { ok: true, id: existing.id };
}
