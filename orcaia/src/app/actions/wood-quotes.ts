"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/core/db";
import { authorizeNiche, fail, OK, parseOrFail, type FormState } from "@/lib/core/actions";
import { woodQuoteHeaderSchema, woodQuoteItemSchema } from "@/lib/validation/marcenaria";
import { computeWoodItem, computeWoodQuoteTotals, type WoodHardwareLine } from "@/lib/niches/marcenaria/pricing";

const STATUSES = ["rascunho", "enviado", "aprovado", "recusado", "expirado", "cancelado"];
const authorize = () => authorizeNiche("marcenaria");

function readHeader(formData: FormData) {
  return {
    customerId: formData.get("customerId"),
    validUntil: formData.get("validUntil") ?? "",
    marginBps: formData.get("marginBps"),
    installationCents: formData.get("installationCents") ?? "",
    travelCents: formData.get("travelCents") ?? "",
    otherCents: formData.get("otherCents") ?? "",
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
  const totals = computeWoodQuoteTotals({
    itemsMaterialsCents,
    installationCents: quote.installationCents,
    travelCents: quote.travelCents,
    otherCents: quote.otherCents,
    marginBps: quote.marginBps,
  });
  await prisma.quote.update({
    where: { id: quote.id },
    data: { subtotalCents: totals.materialsCents, totalCents: totals.totalCents },
  });
}

export async function createWoodQuote(_p: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorize();
  if (!ctx) return state;
  const parsed = parseOrFail(woodQuoteHeaderSchema, readHeader(formData));
  if (parsed.state) return parsed.state;
  const customer = await prisma.customer.findFirst({
    where: { id: parsed.data.customerId, companyId: ctx.company.id },
    select: { id: true },
  });
  if (!customer) return fail("Cliente invalido.");

  let quoteId: string;
  try {
    const agg = await prisma.quote.aggregate({ where: { companyId: ctx.company.id }, _max: { number: true } });
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

export async function updateWoodQuoteHeader(_p: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorize();
  if (!ctx) return state;
  const id = String(formData.get("id") ?? "");
  if (!id) return fail("Orcamento invalido.");
  const parsed = parseOrFail(woodQuoteHeaderSchema, readHeader(formData));
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

export async function addWoodQuoteItem(_p: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorize();
  if (!ctx) return state;
  const quoteId = String(formData.get("quoteId") ?? "");
  if (!quoteId) return fail("Orcamento invalido.");
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, companyId: ctx.company.id },
    select: { id: true },
  });
  if (!quote) return fail("Orcamento nao encontrado.");

  const parsed = parseOrFail(woodQuoteItemSchema, {
    description: formData.get("description"),
    templateId: formData.get("templateId"),
    materialId: formData.get("materialId") ?? "",
    finishId: formData.get("finishId") ?? "",
    quantity: formData.get("quantity"),
  });
  if (parsed.state) return parsed.state;
  const input = parsed.data;

  const template = await prisma.woodTemplate.findFirst({
    where: { id: input.templateId, companyId: ctx.company.id },
  });
  if (!template) return fail("Modelo selecionado invalido.");

  // Material e acabamento: override do item OU o do modelo.
  const materialId = input.materialId || template.materialId || null;
  const finishId = input.finishId || template.finishId || null;

  const material = materialId
    ? await prisma.woodMaterial.findFirst({ where: { id: materialId, companyId: ctx.company.id } })
    : null;
  const finish = finishId
    ? await prisma.woodFinish.findFirst({ where: { id: finishId, companyId: ctx.company.id } })
    : null;

  // Ferragens do modelo (resolve precos atuais).
  const tplHardware = Array.isArray(template.hardware)
    ? (template.hardware as { hardwareId?: string; quantity?: number }[])
    : [];
  const hardwareLines: WoodHardwareLine[] = [];
  const hardwareSpec: { name: string; quantity: number; unitPriceCents: number }[] = [];
  for (const h of tplHardware) {
    if (!h || !h.hardwareId || !h.quantity) continue;
    const hw = await prisma.woodHardware.findFirst({ where: { id: h.hardwareId, companyId: ctx.company.id } });
    if (hw) {
      hardwareLines.push({ name: hw.name, quantity: h.quantity, unitPriceCents: hw.priceCents });
      hardwareSpec.push({ name: hw.name, quantity: h.quantity, unitPriceCents: hw.priceCents });
    }
  }

  // Medidas: do item, com fallback nos defaults do modelo.
  const widthMm = numFrom(formData, "widthMm") || template.defaultWidthMm || 0;
  const heightMm = numFrom(formData, "heightMm") || template.defaultHeightMm || 0;
  const depthMm = numFrom(formData, "depthMm") || template.defaultDepthMm || 0;

  const breakdown = computeWoodItem({
    areaMode: template.areaMode as "frontal" | "caixa",
    widthMm,
    heightMm,
    depthMm,
    quantity: input.quantity,
    materialPricePerM2Cents: material?.pricePerM2Cents ?? 0,
    finishPricePerM2Cents: finish?.pricePerM2Cents ?? 0,
    laborPerM2Cents: template.laborPerM2Cents,
    assemblyPerM2Cents: template.assemblyPerM2Cents,
    hardware: hardwareLines,
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
          templateName: template.name,
          areaMode: template.areaMode,
          widthMm,
          heightMm,
          depthMm,
          materialName: material ? `${material.name} ${material.thicknessMm}mm` : null,
          finishName: finish?.name ?? null,
          hardware: hardwareSpec,
        },
        breakdown: {
          areaM2Total: breakdown.areaM2Total,
          materialCents: breakdown.materialCents,
          finishCents: breakdown.finishCents,
          laborCents: breakdown.laborCents,
          assemblyCents: breakdown.assemblyCents,
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

export async function deleteWoodQuoteItem(formData: FormData): Promise<void> {
  const { ctx } = await authorize();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  const quoteId = String(formData.get("quoteId") ?? "");
  if (!id || !quoteId) return;
  await prisma.quoteItem.deleteMany({ where: { id, quote: { id: quoteId, companyId: ctx.company.id } } });
  await recomputeTotals(ctx.company.id, quoteId);
  revalidatePath(`/orcamentos/${quoteId}`);
}

export async function deleteWoodQuote(formData: FormData): Promise<void> {
  const { ctx } = await authorize();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.quote.deleteMany({ where: { id, companyId: ctx.company.id } });
  revalidatePath("/orcamentos");
  redirect("/orcamentos");
}

export async function setWoodQuoteStatus(formData: FormData): Promise<void> {
  const { ctx } = await authorize();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !STATUSES.includes(status)) return;
  const r = await prisma.quote.updateMany({ where: { id, companyId: ctx.company.id }, data: { status } });
  if (r.count > 0) {
    await prisma.quoteStatusEvent.create({ data: { quoteId: id, companyId: ctx.company.id, status } });
  }
  revalidatePath(`/orcamentos/${id}`);
}
