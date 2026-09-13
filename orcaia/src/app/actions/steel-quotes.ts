"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/core/db";
import { authorizeNiche, fail, OK, parseOrFail, type FormState } from "@/lib/core/actions";
import { steelQuoteHeaderSchema, steelQuoteItemSchema } from "@/lib/validation/serralheria";
import { computeSteelItem, computeSteelQuoteTotals } from "@/lib/niches/serralheria/pricing";
import { serviceTypeLabel } from "@/lib/niches/serralheria/options";
import { isQuoteStatus } from "@/lib/quotes/status";

const authorize = () => authorizeNiche("serralheria");

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

function numFrom(formData: FormData, key: string): number {
  const raw = formData.get(key);
  const n = raw ? Number(String(raw).replace(",", ".")) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

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

  const totals = computeSteelQuoteTotals({
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

export async function createSteelQuote(_p: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorize();
  if (!ctx) return state;

  const parsed = parseOrFail(steelQuoteHeaderSchema, readHeader(formData));
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
        statusEvents: { create: { companyId: ctx.company.id, status: "rascunho" } },
      },
    });
    quoteId = quote.id;
  } catch {
    return fail("Nao foi possivel criar o orcamento.");
  }

  redirect(`/orcamentos/${quoteId}`);
}

export async function updateSteelQuoteHeader(_p: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorize();
  if (!ctx) return state;
  const id = String(formData.get("id") ?? "");
  if (!id) return fail("Orcamento invalido.");

  const parsed = parseOrFail(steelQuoteHeaderSchema, readHeader(formData));
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

export async function addSteelQuoteItem(_p: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorize();
  if (!ctx) return state;

  const quoteId = String(formData.get("quoteId") ?? "");
  if (!quoteId) return fail("Orcamento invalido.");
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, companyId: ctx.company.id },
    select: { id: true },
  });
  if (!quote) return fail("Orcamento nao encontrado.");

  const parsed = parseOrFail(steelQuoteItemSchema, {
    description: formData.get("description"),
    productId: formData.get("productId"),
    quantity: formData.get("quantity"),
  });
  if (parsed.state) return parsed.state;

  const product = await prisma.steelProduct.findFirst({
    where: { id: parsed.data.productId, companyId: ctx.company.id },
  });
  if (!product) return fail("Produto selecionado invalido.");

  const widthMm = numFrom(formData, "widthMm");
  const heightMm = numFrom(formData, "heightMm");
  const lengthMm = numFrom(formData, "lengthMm");
  const weightKg = numFrom(formData, "weightKg");

  const breakdown = computeSteelItem({
    baseUnit: product.baseUnit as "un" | "ml" | "m2" | "kg",
    widthMm,
    heightMm,
    lengthMm,
    weightKg,
    quantity: parsed.data.quantity,
    materialCostPerBaseCents: product.materialCostPerBaseCents,
    laborCostPerBaseCents: product.laborCostPerBaseCents,
    paintCostPerBaseCents: product.paintCostPerBaseCents,
    weightPerBaseKg: product.weightPerBaseKg,
  });

  const unitPriceCents =
    parsed.data.quantity > 0 ? Math.round(breakdown.materialsCents / parsed.data.quantity) : breakdown.materialsCents;

  try {
    await prisma.quoteItem.create({
      data: {
        quoteId: quote.id,
        description: parsed.data.description,
        quantity: parsed.data.quantity,
        unit: product.baseUnit,
        unitPriceCents,
        spec: {
          productId: product.id,
          productName: product.name,
          serviceType: product.serviceType,
          serviceTypeLabel: serviceTypeLabel(product.serviceType),
          baseUnit: product.baseUnit,
          materialName: product.materialName,
          widthMm,
          heightMm,
          lengthMm,
          weightKg,
        },
        breakdown: {
          baseUnit: breakdown.baseUnit,
          baseQtyTotal: breakdown.baseQtyTotal,
          weightKgTotal: breakdown.weightKgTotal,
          materialCents: breakdown.materialCents,
          laborCents: breakdown.laborCents,
          paintCents: breakdown.paintCents,
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

export async function deleteSteelQuoteItem(formData: FormData): Promise<void> {
  const { ctx } = await authorize();
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

export async function deleteSteelQuote(formData: FormData): Promise<void> {
  const { ctx } = await authorize();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.quote.deleteMany({ where: { id, companyId: ctx.company.id } });
  revalidatePath("/orcamentos");
  redirect("/orcamentos");
}

export async function setSteelQuoteStatus(formData: FormData): Promise<void> {
  const { ctx } = await authorize();
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
