"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { permit } from "@/lib/authorize";
import { db } from "@/lib/db";
import { parseMoneyToCents } from "@/lib/format";
import { QUOTE_STATUS } from "@/lib/labels";

/**
 * Escrita do modulo Orcamentos.
 *
 * Financeiro: tudo em centavos, inteiros — nunca ponto flutuante. O calculo e
 * o mesmo em toda parte (src/lib/quotes.ts): subtotal = soma dos itens,
 * total = subtotal - desconto. `discountCents` ja existia no schema; nao ha
 * segunda logica financeira aqui.
 *
 * Status: usa os do schema (QUOTE_STATUS). "cancelado" foi acrescentado ao
 * mesmo conjunto do campo String, sem estrutura paralela.
 *
 * Isolamento: companyId sempre da sessao; cliente, veiculo (que precisa ser do
 * cliente) e servicos sao validados contra a empresa antes de gravar.
 */

export type QuoteState =
  | { ok?: boolean; error?: string; id?: string; workOrderId?: string }
  | undefined;

const STATUSES = Object.keys(QUOTE_STATUS) as [string, ...string[]];

/** Estados em que o orcamento ainda pode ter valores alterados. */
const EDITABLE = ["rascunho", "enviado", "expirado"];

type ItemInput = {
  serviceItemId: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
};

const quoteSchema = z.object({
  customerId: z.string().min(1, "Selecione o cliente."),
  vehicleId: z.string().min(1, "Selecione o veículo."),
  serviceIds: z.array(z.string()).min(1, "Selecione ao menos um serviço."),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de validade."),
  status: z.enum(STATUSES, { message: "Status inválido." }),
  notes: z.string().max(2000, "Observações muito longas."),
});

function readForm(formData: FormData) {
  return {
    customerId: String(formData.get("customerId") ?? "").trim(),
    vehicleId: String(formData.get("vehicleId") ?? "").trim(),
    serviceIds: formData.getAll("serviceIds").map(String).filter(Boolean),
    validUntil: String(formData.get("validUntil") ?? "").trim(),
    status: String(formData.get("status") ?? "rascunho").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

/** Preco e quantidade por servico chegam como `price__<id>` e `qty__<id>`. */
function readItemFields(formData: FormData, serviceIds: string[]) {
  const prices = new Map<string, number>();
  const quantities = new Map<string, number>();
  for (const id of serviceIds) {
    const price = String(formData.get(`price__${id}`) ?? "").trim();
    if (price) prices.set(id, parseMoneyToCents(price));
    const qty = Number(String(formData.get(`qty__${id}`) ?? "1").replace(/\D/g, ""));
    quantities.set(id, Number.isFinite(qty) && qty > 0 ? qty : 1);
  }
  return { prices, quantities };
}

async function assertOwnership(
  companyId: string,
  data: { customerId: string; vehicleId: string; serviceIds: string[] },
) {
  const customer = await db.customer.findFirst({
    where: { id: data.customerId, companyId },
    select: { id: true },
  });
  if (!customer) return { error: "Cliente não encontrado nesta empresa." };

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

async function nextNumber(companyId: string) {
  const last = await db.quote.findFirst({
    where: { companyId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}

function buildItems(
  services: { id: string; name: string; basePrice: number }[],
  prices: Map<string, number>,
  quantities: Map<string, number>,
): ItemInput[] {
  return services.map((service) => ({
    serviceItemId: service.id,
    description: service.name,
    quantity: quantities.get(service.id) ?? 1,
    unitPriceCents: prices.get(service.id) ?? service.basePrice,
  }));
}

/** Subtotal em centavos: soma de quantidade x preco unitario. */
function subtotalOf(items: ItemInput[]) {
  return items.reduce((sum, i) => sum + i.quantity * i.unitPriceCents, 0);
}

function revalidateQuote(id?: string, customerId?: string) {
  revalidatePath("/orcamentos");
  if (id) revalidatePath(`/orcamentos/${id}`);
  revalidatePath("/dashboard");
  if (customerId) revalidatePath(`/clientes/${customerId}`);
}

export async function createQuoteAction(
  _state: QuoteState,
  formData: FormData,
): Promise<QuoteState> {
  const gate = await permit("quotes.write");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;

  const parsed = quoteSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const owned = await assertOwnership(company.id, parsed.data);
  if ("error" in owned) return { error: owned.error };

  const { prices, quantities } = readItemFields(formData, parsed.data.serviceIds);
  const items = buildItems(owned.services, prices, quantities);
  const subtotal = subtotalOf(items);

  const discount = parseMoneyToCents(String(formData.get("discount") ?? "0"));
  if (discount < 0) return { error: "O desconto não pode ser negativo." };
  if (discount > subtotal) return { error: "O desconto não pode ser maior que o subtotal." };

  const total = subtotal - discount;
  if (total <= 0) return { error: "O valor total precisa ser maior que zero." };

  const quote = await db.quote.create({
    data: {
      companyId: company.id, // sempre da sessao
      number: await nextNumber(company.id),
      customerId: parsed.data.customerId,
      vehicleId: parsed.data.vehicleId,
      status: parsed.data.status,
      validUntil: new Date(`${parsed.data.validUntil}T23:59:59`),
      discountCents: discount,
      totalCents: total,
      notes: parsed.data.notes || null,
      items: { create: items },
    },
    select: { id: true, customerId: true },
  });

  revalidateQuote(quote.id, quote.customerId);
  return { ok: true, id: quote.id };
}

export async function updateQuoteAction(
  _state: QuoteState,
  formData: FormData,
): Promise<QuoteState> {
  const gate = await permit("quotes.write");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Orçamento não identificado." };

  const existing = await db.quote.findFirst({
    where: { id, companyId: company.id },
    select: { id: true, status: true, customerId: true },
  });
  if (!existing) return { error: "Orçamento não encontrado nesta empresa." };

  // Valores nao mudam depois de aprovado/recusado/cancelado sem uma acao
  // explicita que devolva o orcamento a um estado editavel.
  if (!EDITABLE.includes(existing.status)) {
    return {
      error: `Orçamento ${QUOTE_STATUS[existing.status]?.label.toLowerCase() ?? existing.status} não pode ser editado. Reabra como rascunho para alterar os valores.`,
    };
  }

  const parsed = quoteSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const owned = await assertOwnership(company.id, parsed.data);
  if ("error" in owned) return { error: owned.error };

  const { prices, quantities } = readItemFields(formData, parsed.data.serviceIds);
  const items = buildItems(owned.services, prices, quantities);
  const subtotal = subtotalOf(items);

  const discount = parseMoneyToCents(String(formData.get("discount") ?? "0"));
  if (discount < 0) return { error: "O desconto não pode ser negativo." };
  if (discount > subtotal) return { error: "O desconto não pode ser maior que o subtotal." };

  const total = subtotal - discount;
  if (total <= 0) return { error: "O valor total precisa ser maior que zero." };

  await db.$transaction([
    db.quoteItem.deleteMany({ where: { quoteId: existing.id } }),
    db.quote.update({
      where: { id: existing.id },
      data: {
        customerId: parsed.data.customerId,
        vehicleId: parsed.data.vehicleId,
        status: parsed.data.status,
        validUntil: new Date(`${parsed.data.validUntil}T23:59:59`),
        discountCents: discount,
        totalCents: total,
        notes: parsed.data.notes || null,
        items: { create: items },
      },
    }),
  ]);

  revalidateQuote(existing.id, existing.customerId);
  revalidateQuote(existing.id, parsed.data.customerId);
  return { ok: true, id: existing.id };
}

/**
 * Muda o status: enviar, aprovar, recusar, cancelar ou reabrir como rascunho.
 *
 * Aprovar exige validade em dia. Um orcamento expirado precisa de uma acao
 * explicita do usuario (revalidar, mais abaixo) antes de ser aprovado.
 */
export async function changeQuoteStatusAction(
  _state: QuoteState,
  formData: FormData,
): Promise<QuoteState> {
  const gate = await permit("quotes.decide");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id) return { error: "Orçamento não identificado." };
  if (!(status in QUOTE_STATUS)) return { error: "Status inválido." };

  const existing = await db.quote.findFirst({
    where: { id, companyId: company.id },
    select: { id: true, customerId: true, validUntil: true, status: true },
  });
  if (!existing) return { error: "Orçamento não encontrado nesta empresa." };

  const expired = existing.validUntil ? existing.validUntil < new Date() : false;
  if (status === "aprovado" && expired) {
    return {
      error: "Este orçamento está vencido. Atualize a validade antes de aprovar.",
    };
  }

  await db.quote.update({ where: { id: existing.id }, data: { status } });

  revalidateQuote(existing.id, existing.customerId);
  return { ok: true, id: existing.id };
}

/** Estende a validade — a acao explicita que destrava um orcamento vencido. */
export async function renewQuoteAction(
  _state: QuoteState,
  formData: FormData,
): Promise<QuoteState> {
  const gate = await permit("quotes.write");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;

  const id = String(formData.get("id") ?? "");
  const validUntil = String(formData.get("validUntil") ?? "").trim();
  if (!id) return { error: "Orçamento não identificado." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) return { error: "Informe a nova validade." };

  const date = new Date(`${validUntil}T23:59:59`);
  if (date < new Date()) return { error: "A nova validade precisa ser futura." };

  const existing = await db.quote.findFirst({
    where: { id, companyId: company.id },
    select: { id: true, customerId: true, status: true },
  });
  if (!existing) return { error: "Orçamento não encontrado nesta empresa." };

  await db.quote.update({
    where: { id: existing.id },
    data: {
      validUntil: date,
      // Sai de "expirado" e volta a circular como enviado.
      status: existing.status === "expirado" ? "enviado" : existing.status,
    },
  });

  revalidateQuote(existing.id, existing.customerId);
  return { ok: true, id: existing.id };
}

/** Exclusao definitiva. So enquanto o orcamento nao virou OS. */
export async function deleteQuoteAction(
  _state: QuoteState,
  formData: FormData,
): Promise<QuoteState> {
  const gate = await permit("quotes.write");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Orçamento não identificado." };

  const existing = await db.quote.findFirst({
    where: { id, companyId: company.id },
    select: { id: true, workOrders: { select: { id: true } } },
  });
  if (!existing) return { error: "Orçamento não encontrado nesta empresa." };

  if (existing.workOrders.length > 0) {
    return {
      error: "Este orçamento já virou ordem de serviço e não pode ser excluído. Cancele-o.",
    };
  }

  await db.quote.delete({ where: { id: existing.id } });

  revalidateQuote();
  redirect("/orcamentos?excluido=1");
}

/**
 * Converte o orcamento aprovado em Ordem de Servico.
 *
 * Nao existe logica nova de OS aqui: cria um WorkOrder com a mesma estrutura de
 * itens (descricao, quantidade e preco praticados) que o modulo de Ordens ja
 * usa, com status "aberta" — a OS entra no fluxo normal
 * aberta -> em_andamento -> aguardando_retirada -> concluida, e e concluida
 * pelas acoes daquele modulo.
 *
 * `quoteId` e `@unique` na WorkOrder, entao a duplicacao e impossivel no banco.
 * Antes de gravar tambem checamos, para a interface poder oferecer "abrir a OS"
 * em vez de um erro.
 */
export async function convertQuoteToWorkOrderAction(
  _state: QuoteState,
  formData: FormData,
): Promise<QuoteState> {
  const gate = await permit("quotes.decide");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Orçamento não identificado." };

  const quote = await db.quote.findFirst({
    where: { id, companyId: company.id },
    include: { items: true, workOrders: { select: { id: true } } },
  });
  if (!quote) return { error: "Orçamento não encontrado nesta empresa." };

  // Ja convertido: devolve a OS existente, sem criar outra.
  if (quote.workOrders.length > 0) {
    return {
      workOrderId: quote.workOrders[0].id,
      error: "Este orçamento já foi convertido em ordem de serviço.",
    };
  }

  if (quote.status !== "aprovado") {
    return { error: "Só é possível converter um orçamento aprovado." };
  }
  if (!quote.vehicleId) return { error: "O orçamento não tem veículo vinculado." };
  if (quote.items.length === 0) return { error: "O orçamento não tem serviços." };

  const lastOrder = await db.workOrder.findFirst({
    where: { companyId: company.id },
    orderBy: { number: "desc" },
    select: { number: true },
  });

  const order = await db.workOrder.create({
    data: {
      companyId: company.id,
      number: (lastOrder?.number ?? 0) + 1,
      customerId: quote.customerId,
      vehicleId: quote.vehicleId,
      quoteId: quote.id, // vinculo pedido
      status: "aberta", // entra no fluxo normal do modulo de OS
      // Total aprovado, ja com o desconto aplicado.
      totalCents: quote.totalCents,
      notes: quote.notes,
      items: {
        create: quote.items.map((item) => ({
          serviceItemId: item.serviceItemId,
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
        })),
      },
    },
    select: { id: true, customerId: true, vehicleId: true },
  });

  revalidateQuote(quote.id, quote.customerId);
  revalidatePath("/ordens");
  revalidatePath(`/ordens/${order.id}`);
  revalidatePath("/relatorios");
  if (order.vehicleId) revalidatePath(`/veiculos/${order.vehicleId}`);

  redirect(`/ordens/${order.id}`);
}
