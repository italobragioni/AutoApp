"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/core/db";
import { authorizeNiche, fail, OK, parseOrFail, type FormState } from "@/lib/core/actions";
import { quoteHeaderSchema, quoteItemSchema } from "@/lib/validation/vidracaria";
import {
  computeGlassItem,
  computeQuoteTotals,
  type HardwareLine,
} from "@/lib/niches/vidracaria/pricing";
import { isQuoteStatus } from "@/lib/quotes/status";


function readHeader(formData: FormData) {
  return {
    customerId: formData.get("customerId"),
    validUntil: formData.get("validUntil") ?? "",
    marginBps: formData.get("marginBps"),
    installationCents: formData.get("installationCents") ?? "",
    travelCents: formData.get("travelCents") ?? "",
    otherCents: formData.get("otherCents") ?? "",
    discountCents: formData.get("discountCents") ?? "",
    deliveryTime: formData.get("deliveryTime") ?? "",
    paymentTerms: formData.get("paymentTerms") ?? "",
    notes: formData.get("notes") ?? "",
  };
}

function parseValidUntil(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Recalcula e persiste os totais do orcamento a partir dos itens e custos gerais.
async function recomputeTotals(companyId: string, quoteId: string): Promise<void> {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, companyId },
    include: { items: { select: { breakdown: true } } },
  });
  if (!quote) return;

  const itemsMaterialsCents = quote.items.reduce((sum, it) => {
    const b = it.breakdown as { materialsCents?: number } | null;
    return sum + (b && typeof b.materialsCents === "number" ? b.materialsCents : 0);
  }, 0);

  const totals = computeQuoteTotals({
    itemsMaterialsCents,
    installationCents: quote.installationCents,
    travelCents: quote.travelCents,
    otherCents: quote.otherCents,
    marginBps: quote.marginBps,
  });

  await prisma.quote.update({
    where: { id: quote.id },
    data: { subtotalCents: totals.materialsCents, totalCents: Math.max(0, totals.totalCents - quote.discountCents) },
  });
}

export async function createQuote(_p: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorizeNiche("vidracaria");
  if (!ctx) return state;

  const parsed = parseOrFail(quoteHeaderSchema, readHeader(formData));
  if (parsed.state) return parsed.state;

  const customer = await prisma.customer.findFirst({
    where: { id: parsed.data.customerId, companyId: ctx.company.id },
    select: { id: true },
  });
  if (!customer) return fail("Cliente invalido.");

  let quoteId: string;
  try {
    const agg = await prisma.quote.aggregate({
      where: { companyId: ctx.company.id },
      _max: { number: true },
    });
    const number = (agg._max.number ?? 0) + 1;

    const quote = await prisma.quote.create({
      data: {
        companyId: ctx.company.id,
        number,
        customerId: customer.id,
        status: "rascunho",
        validUntil: parseValidUntil(parsed.data.validUntil),
        marginBps: parsed.data.marginBps,
        installationCents: parsed.data.installationCents,
        travelCents: parsed.data.travelCents,
        otherCents: parsed.data.otherCents,
        discountCents: parsed.data.discountCents,
        deliveryTime: parsed.data.deliveryTime ?? null,
        paymentTerms: parsed.data.paymentTerms ?? null,
        notes: parsed.data.notes ?? null,
        statusEvents: {
          create: { companyId: ctx.company.id, status: "rascunho" },
        },
      },
    });
    quoteId = quote.id;
  } catch {
    return fail("Nao foi possivel criar o orcamento.");
  }

  redirect(`/orcamentos/${quoteId}`);
}

export async function updateQuoteHeader(_p: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorizeNiche("vidracaria");
  if (!ctx) return state;

  const id = String(formData.get("id") ?? "");
  if (!id) return fail("Orcamento invalido.");

  const parsed = parseOrFail(quoteHeaderSchema, readHeader(formData));
  if (parsed.state) return parsed.state;

  const customer = await prisma.customer.findFirst({
    where: { id: parsed.data.customerId, companyId: ctx.company.id },
    select: { id: true },
  });
  if (!customer) return fail("Cliente invalido.");

  try {
    const r = await prisma.quote.updateMany({
      where: { id, companyId: ctx.company.id },
      data: {
        customerId: customer.id,
        validUntil: parseValidUntil(parsed.data.validUntil),
        marginBps: parsed.data.marginBps,
        installationCents: parsed.data.installationCents,
        travelCents: parsed.data.travelCents,
        otherCents: parsed.data.otherCents,
        discountCents: parsed.data.discountCents,
        deliveryTime: parsed.data.deliveryTime ?? null,
        paymentTerms: parsed.data.paymentTerms ?? null,
        notes: parsed.data.notes ?? null,
      },
    });
    if (r.count === 0) return fail("Orcamento nao encontrado.");
  } catch {
    return fail("Nao foi possivel salvar o orcamento.");
  }

  await recomputeTotals(ctx.company.id, id);
  revalidatePath(`/orcamentos/${id}`);
  return OK;
}

export async function deleteQuote(formData: FormData): Promise<void> {
  const { ctx } = await authorizeNiche("vidracaria");
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.quote.deleteMany({ where: { id, companyId: ctx.company.id } });
  revalidatePath("/orcamentos");
  redirect("/orcamentos");
}

export async function addQuoteItem(_p: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorizeNiche("vidracaria");
  if (!ctx) return state;

  const quoteId = String(formData.get("quoteId") ?? "");
  if (!quoteId) return fail("Orcamento invalido.");

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, companyId: ctx.company.id },
    select: { id: true },
  });
  if (!quote) return fail("Orcamento nao encontrado.");

  const parsed = parseOrFail(quoteItemSchema, {
    description: formData.get("description"),
    widthMm: formData.get("widthMm"),
    heightMm: formData.get("heightMm"),
    quantity: formData.get("quantity"),
    glassOptionId: formData.get("glassOptionId"),
    finishOptionId: formData.get("finishOptionId") ?? "",
  });
  if (parsed.state) return parsed.state;
  const input = parsed.data;

  const glass = await prisma.glassOption.findFirst({
    where: { id: input.glassOptionId, companyId: ctx.company.id },
  });
  if (!glass) return fail("Vidro selecionado invalido.");

  let finish = null;
  let finishSpec: { id: string; name: string; unit: string; priceCents: number } | null = null;
  if (input.finishOptionId) {
    const f = await prisma.finishOption.findFirst({
      where: { id: input.finishOptionId, companyId: ctx.company.id },
    });
    if (f) {
      finish = { unit: f.unit as "m2" | "ml" | "fixo", priceCents: f.priceCents };
      finishSpec = { id: f.id, name: f.name, unit: f.unit, priceCents: f.priceCents };
    }
  }

  // Ferragens: le a quantidade de cada ferragem cadastrada (campo hw_<id>).
  const hwOptions = await prisma.hardwareOption.findMany({
    where: { companyId: ctx.company.id },
  });
  const hardware: HardwareLine[] = [];
  const hardwareSpec: { id: string; name: string; quantity: number; unitPriceCents: number }[] = [];
  for (const hw of hwOptions) {
    const raw = formData.get(`hw_${hw.id}`);
    const qty = raw ? parseInt(String(raw), 10) : 0;
    if (Number.isFinite(qty) && qty > 0) {
      hardware.push({ name: hw.name, quantity: qty, unitPriceCents: hw.priceCents });
      hardwareSpec.push({ id: hw.id, name: hw.name, quantity: qty, unitPriceCents: hw.priceCents });
    }
  }

  const breakdown = computeGlassItem({
    widthMm: input.widthMm,
    heightMm: input.heightMm,
    quantity: input.quantity,
    glassPricePerM2Cents: glass.pricePerM2Cents,
    finish,
    hardware,
  });

  const unitPriceCents =
    input.quantity > 0 ? Math.round(breakdown.materialsCents / input.quantity) : breakdown.materialsCents;

  try {
    await prisma.quoteItem.create({
      data: {
        quoteId: quote.id,
        description: input.description,
        quantity: input.quantity,
        unit: "un",
        unitPriceCents,
        spec: {
          widthMm: input.widthMm,
          heightMm: input.heightMm,
          glass: {
            id: glass.id,
            glassType: glass.glassType,
            thicknessMm: glass.thicknessMm,
            pricePerM2Cents: glass.pricePerM2Cents,
          },
          finish: finishSpec,
          hardware: hardwareSpec,
        },
        breakdown: {
          areaM2PerUnit: breakdown.areaM2PerUnit,
          areaM2Total: breakdown.areaM2Total,
          glassCents: breakdown.glassCents,
          finishCents: breakdown.finishCents,
          hardwareCents: breakdown.hardwareCents,
          materialsCents: breakdown.materialsCents,
        },
      },
    });
  } catch {
    return fail("Nao foi possivel adicionar o item.");
  }

  await recomputeTotals(ctx.company.id, quote.id);
  revalidatePath(`/orcamentos/${quote.id}`);
  return OK;
}

export async function deleteQuoteItem(formData: FormData): Promise<void> {
  const { ctx } = await authorizeNiche("vidracaria");
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  const quoteId = String(formData.get("quoteId") ?? "");
  if (!id || !quoteId) return;

  await prisma.quoteItem.deleteMany({
    where: { id, quote: { id: quoteId, companyId: ctx.company.id } },
  });
  await recomputeTotals(ctx.company.id, quoteId);
  revalidatePath(`/orcamentos/${quoteId}`);
}

export async function setQuoteStatus(formData: FormData): Promise<void> {
  const { ctx } = await authorizeNiche("vidracaria");
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !isQuoteStatus(status)) return;

  const r = await prisma.quote.updateMany({
    where: { id, companyId: ctx.company.id },
    data: { status },
  });
  if (r.count > 0) {
    await prisma.quoteStatusEvent.create({
      data: { quoteId: id, companyId: ctx.company.id, status },
    });
  }
  revalidatePath(`/orcamentos/${id}`);
}
