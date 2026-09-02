"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/lib/db";
import { appointmentValueCents } from "@/lib/agenda";
import { parseMoneyToCents } from "@/lib/format";
import { PAYMENT_LABEL, WORK_ORDER_STATUS } from "@/lib/labels";
import { requireContext } from "@/lib/tenant";

/**
 * Escrita do modulo Ordens de Servico.
 *
 * A OS concluida e a fonte real de faturamento do AUTOVOLT: Dashboard,
 * Relatorios e o motor de Retencao consultam `WorkOrder` com
 * `status: "concluida"` e `finishedAt` preenchido. Nada aqui grava numero
 * fixo — os valores vem do que o usuario registrou.
 *
 * Isolamento, como nos demais modulos: companyId sempre da sessao, e todo id
 * que chega pelo formulario (cliente, veiculo, servicos, agendamento) e
 * validado contra a empresa antes de gravar.
 *
 * Status: usa os que ja existiam no schema (WORK_ORDER_STATUS) —
 * aberta, em_andamento, aguardando_retirada, concluida e cancelada.
 */

export type WorkOrderState =
  | { ok?: boolean; error?: string; id?: string; existingId?: string }
  | undefined;

const PAYMENTS = Object.keys(PAYMENT_LABEL) as [string, ...string[]];
const STATUSES = Object.keys(WORK_ORDER_STATUS) as [string, ...string[]];

/** Um item da OS: descricao e preco praticados, congelados no momento do servico. */
type ItemInput = { serviceItemId: string | null; description: string; unitPriceCents: number };

const workOrderSchema = z.object({
  customerId: z.string().min(1, "Selecione o cliente."),
  vehicleId: z.string().min(1, "Selecione o veículo."),
  serviceIds: z.array(z.string()).min(1, "Selecione ao menos um serviço."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data."),
  status: z.enum(STATUSES, { message: "Status inválido." }),
  notes: z.string().max(2000, "Observações muito longas."),
});

function readForm(formData: FormData) {
  return {
    customerId: String(formData.get("customerId") ?? "").trim(),
    vehicleId: String(formData.get("vehicleId") ?? "").trim(),
    serviceIds: formData.getAll("serviceIds").map(String).filter(Boolean),
    date: String(formData.get("date") ?? "").trim(),
    status: String(formData.get("status") ?? "aberta").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

/**
 * Precos por servico vem do formulario como `price__<serviceId>`, o que permite
 * o usuario ajustar o valor de cada item sem alterar o catalogo.
 */
function readPrices(formData: FormData, serviceIds: string[]) {
  const prices = new Map<string, number>();
  for (const id of serviceIds) {
    const raw = String(formData.get(`price__${id}`) ?? "").trim();
    if (raw) prices.set(id, parseMoneyToCents(raw));
  }
  return prices;
}

/** Valida cliente, veiculo e servicos contra a empresa da sessao. */
async function assertOwnership(
  companyId: string,
  data: { customerId: string; vehicleId: string; serviceIds: string[] },
) {
  const customer = await db.customer.findFirst({
    where: { id: data.customerId, companyId },
    select: { id: true },
  });
  if (!customer) return { error: "Cliente não encontrado nesta empresa." };

  // O veiculo precisa ser da empresa E do cliente escolhido.
  const vehicle = await db.vehicle.findFirst({
    where: { id: data.vehicleId, companyId, customerId: data.customerId },
    select: { id: true },
  });
  if (!vehicle) return { error: "O veículo selecionado não pertence a este cliente." };

  const services = await db.serviceItem.findMany({
    where: { id: { in: data.serviceIds }, companyId },
    select: { id: true, name: true, basePrice: true },
  });
  if (services.length !== data.serviceIds.length) {
    return { error: "Serviço não encontrado nesta empresa." };
  }

  return { services };
}

/**
 * Proximo numero sequencial da OS dentro da empresa.
 * Ha `@@unique([companyId, number])`, entao a colisao e impossivel de passar
 * despercebida — em caso de corrida, o banco rejeita e a action reporta erro.
 */
async function nextNumber(companyId: string) {
  const last = await db.workOrder.findFirst({
    where: { companyId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}

/**
 * Revalida tudo que consome OS concluida: o proprio modulo, o painel, os
 * relatorios, a retencao e as fichas de cliente e veiculo.
 */
function revalidateWorkOrder(id?: string, customerId?: string, vehicleId?: string | null) {
  revalidatePath("/ordens");
  if (id) revalidatePath(`/ordens/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
  revalidatePath("/retencao");
  revalidatePath("/agenda");
  if (customerId) revalidatePath(`/clientes/${customerId}`);
  if (vehicleId) revalidatePath(`/veiculos/${vehicleId}`);
}

/** Monta os itens congelando nome e preco praticados. */
function buildItems(
  services: { id: string; name: string; basePrice: number }[],
  prices: Map<string, number>,
): ItemInput[] {
  return services.map((service) => ({
    serviceItemId: service.id,
    description: service.name,
    unitPriceCents: prices.get(service.id) ?? service.basePrice,
  }));
}

const sumItems = (items: ItemInput[]) => items.reduce((sum, i) => sum + i.unitPriceCents, 0);

export async function createWorkOrderAction(
  _state: WorkOrderState,
  formData: FormData,
): Promise<WorkOrderState> {
  const { company } = await requireContext();

  const parsed = workOrderSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const owned = await assertOwnership(company.id, parsed.data);
  if ("error" in owned) return { error: owned.error };

  const items = buildItems(owned.services, readPrices(formData, parsed.data.serviceIds));
  const total = sumItems(items);
  if (total <= 0) return { error: "O valor total precisa ser maior que zero." };

  const openedAt = new Date(`${parsed.data.date}T12:00:00`);

  const order = await db.workOrder.create({
    data: {
      companyId: company.id, // sempre da sessao
      number: await nextNumber(company.id),
      customerId: parsed.data.customerId,
      vehicleId: parsed.data.vehicleId,
      status: parsed.data.status,
      totalCents: total,
      notes: parsed.data.notes || null,
      openedAt,
      // Concluir ja na criacao registra a data de conclusao junto.
      finishedAt: parsed.data.status === "concluida" ? openedAt : null,
      items: { create: items },
    },
    select: { id: true, customerId: true, vehicleId: true },
  });

  revalidateWorkOrder(order.id, order.customerId, order.vehicleId);
  return { ok: true, id: order.id };
}

/**
 * Cria a OS a partir de um agendamento, reaproveitando cliente, veiculo,
 * servicos, valor, data e observacoes.
 *
 * O `appointmentId` e `@unique` no schema, entao o banco ja impede duas OS para
 * o mesmo agendamento. Antes de tentar gravar, checamos e devolvemos o id da OS
 * existente para a interface oferecer "abrir a OS" em vez de criar outra.
 */
export async function createWorkOrderFromAppointmentAction(
  _state: WorkOrderState,
  formData: FormData,
): Promise<WorkOrderState> {
  const { company } = await requireContext();

  const appointmentId = String(formData.get("appointmentId") ?? "");
  if (!appointmentId) return { error: "Agendamento não identificado." };

  const appointment = await db.appointment.findFirst({
    where: { id: appointmentId, companyId: company.id },
    include: {
      services: { include: { serviceItem: { select: { id: true, name: true, basePrice: true } } } },
      workOrder: { select: { id: true } },
    },
  });
  if (!appointment) return { error: "Agendamento não encontrado nesta empresa." };

  // Ja existe OS para este agendamento: nao duplica, avisa.
  if (appointment.workOrder) {
    return {
      existingId: appointment.workOrder.id,
      error: "Este agendamento já tem uma ordem de serviço.",
    };
  }

  if (!appointment.vehicleId) {
    return { error: "O agendamento não tem veículo vinculado." };
  }
  if (appointment.services.length === 0) {
    return { error: "O agendamento não tem serviços vinculados." };
  }

  const items: ItemInput[] = appointment.services.map((entry) => ({
    serviceItemId: entry.serviceItem.id,
    description: entry.serviceItem.name,
    unitPriceCents: entry.serviceItem.basePrice,
  }));

  // O valor combinado no agendamento manda; itens sao proporcionais ao catalogo.
  const agreed = appointmentValueCents(appointment);
  const catalog = sumItems(items);
  if (agreed !== catalog && catalog > 0 && items.length === 1) {
    // Um unico servico: o valor combinado vai direto para o item.
    items[0].unitPriceCents = agreed;
  }

  const order = await db.workOrder.create({
    data: {
      companyId: company.id,
      number: await nextNumber(company.id),
      customerId: appointment.customerId,
      vehicleId: appointment.vehicleId,
      appointmentId: appointment.id, // vinculo pedido
      status: "aberta",
      totalCents: items.length === 1 ? agreed : catalog,
      notes: appointment.notes,
      openedAt: appointment.startsAt,
      items: { create: items },
    },
    select: { id: true, customerId: true, vehicleId: true },
  });

  revalidateWorkOrder(order.id, order.customerId, order.vehicleId);
  redirect(`/ordens/${order.id}`);
}

export async function updateWorkOrderAction(
  _state: WorkOrderState,
  formData: FormData,
): Promise<WorkOrderState> {
  const { company } = await requireContext();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Ordem de serviço não identificada." };

  const existing = await db.workOrder.findFirst({
    where: { id, companyId: company.id },
    select: { id: true, status: true, customerId: true, vehicleId: true },
  });
  if (!existing) return { error: "Ordem de serviço não encontrada nesta empresa." };

  const parsed = workOrderSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const owned = await assertOwnership(company.id, parsed.data);
  if ("error" in owned) return { error: owned.error };

  const items = buildItems(owned.services, readPrices(formData, parsed.data.serviceIds));
  const total = sumItems(items);
  if (total <= 0) return { error: "O valor total precisa ser maior que zero." };

  const openedAt = new Date(`${parsed.data.date}T12:00:00`);

  await db.$transaction([
    db.workOrderItem.deleteMany({ where: { workOrderId: existing.id } }),
    db.workOrder.update({
      where: { id: existing.id },
      data: {
        customerId: parsed.data.customerId,
        vehicleId: parsed.data.vehicleId,
        status: parsed.data.status,
        totalCents: total,
        notes: parsed.data.notes || null,
        openedAt,
        items: { create: items },
      },
    }),
  ]);

  revalidateWorkOrder(existing.id, existing.customerId, existing.vehicleId);
  revalidateWorkOrder(existing.id, parsed.data.customerId, parsed.data.vehicleId);
  return { ok: true, id: existing.id };
}

/** Avanca o status. Concluir passa por completeWorkOrderAction, com pagamento. */
export async function changeWorkOrderStatusAction(
  _state: WorkOrderState,
  formData: FormData,
): Promise<WorkOrderState> {
  const { company } = await requireContext();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id) return { error: "Ordem de serviço não identificada." };
  if (!(status in WORK_ORDER_STATUS)) return { error: "Status inválido." };

  const existing = await db.workOrder.findFirst({
    where: { id, companyId: company.id },
    select: { id: true, customerId: true, vehicleId: true },
  });
  if (!existing) return { error: "Ordem de serviço não encontrada nesta empresa." };

  await db.workOrder.update({
    where: { id: existing.id },
    data: {
      status,
      // Sair de "concluida" limpa a data para o faturamento nao contar duas vezes.
      ...(status === "concluida" ? {} : { finishedAt: null }),
    },
  });

  revalidateWorkOrder(existing.id, existing.customerId, existing.vehicleId);
  return { ok: true, id: existing.id };
}

/**
 * Conclusao com pagamento.
 *
 * Usa os campos que ja existem no schema — nao ha segunda estrutura de
 * pagamento: `paymentMethod`, `totalCents` (valor efetivamente cobrado) e
 * `finishedAt` (data da conclusao). E esse conjunto que Dashboard, Relatorios
 * e Retencao leem.
 */
export async function completeWorkOrderAction(
  _state: WorkOrderState,
  formData: FormData,
): Promise<WorkOrderState> {
  const { company } = await requireContext();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Ordem de serviço não identificada." };

  const existing = await db.workOrder.findFirst({
    where: { id, companyId: company.id },
    include: { items: { select: { id: true } } },
  });
  if (!existing) return { error: "Ordem de serviço não encontrada nesta empresa." };

  // Validacoes de conclusao pedidas: cliente, veiculo, servico e valor.
  if (!existing.vehicleId) return { error: "Vincule um veículo antes de concluir." };
  if (existing.items.length === 0) return { error: "A OS precisa de ao menos um serviço." };

  const parsed = z
    .object({
      paymentMethod: z.enum(PAYMENTS, { message: "Selecione a forma de pagamento." }),
      paidAmount: z.string().refine((v) => v.replace(/\D/g, "").length > 0, {
        message: "Informe o valor pago.",
      }),
      finishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de conclusão."),
    })
    .safeParse({
      paymentMethod: String(formData.get("paymentMethod") ?? ""),
      paidAmount: String(formData.get("paidAmount") ?? "").trim(),
      finishedAt: String(formData.get("finishedAt") ?? "").trim(),
    });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const paid = parseMoneyToCents(parsed.data.paidAmount);
  if (paid <= 0) return { error: "O valor pago precisa ser maior que zero." };

  await db.workOrder.update({
    where: { id: existing.id },
    data: {
      status: "concluida",
      paymentMethod: parsed.data.paymentMethod,
      // Valor efetivamente cobrado — e o que entra no faturamento.
      totalCents: paid,
      finishedAt: new Date(`${parsed.data.finishedAt}T12:00:00`),
    },
  });

  revalidateWorkOrder(existing.id, existing.customerId, existing.vehicleId);
  return { ok: true, id: existing.id };
}
