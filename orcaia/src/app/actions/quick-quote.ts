"use server";

import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/core/db";
import { authorizeState, fail, parseOrFail, type FormState } from "@/lib/core/actions";
import { percentBps } from "@/lib/validation/common";
import { z } from "zod";
import { computeGlassItem, type HardwareLine } from "@/lib/niches/vidracaria/pricing";
import { computeSteelItem } from "@/lib/niches/serralheria/pricing";
import { serviceTypeLabel } from "@/lib/niches/serralheria/options";
import { computeWoodItem, type WoodHardwareLine } from "@/lib/niches/marcenaria/pricing";

// Gerador rapido: cria o orcamento (rascunho) com UM item em uma unica acao.
// Sempre recalcula no servidor a partir do catalogo (nunca confia no cliente).

const baseSchema = z.object({
  customerId: z.string().trim().min(1, "Selecione um cliente."),
  marginBps: percentBps,
  quantity: z.coerce.number({ invalid_type_error: "Quantidade invalida." }).int().positive("Quantidade invalida."),
});

function num(formData: FormData, key: string): number {
  const raw = formData.get(key);
  const n = raw ? Number(String(raw).replace(",", ".")) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

type Built = {
  description: string;
  unit: string;
  spec: Prisma.InputJsonValue;
  breakdown: { materialsCents: number } & Record<string, unknown>;
};

export async function createQuickQuote(_p: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorizeState();
  if (!ctx) return state;
  const niche = ctx.company.niche;
  if (!["vidracaria", "serralheria", "marcenaria"].includes(niche)) {
    return fail("Gerador rápido indisponível para este nicho.");
  }

  const parsed = parseOrFail(baseSchema, {
    customerId: formData.get("customerId"),
    marginBps: formData.get("marginBps"),
    quantity: formData.get("quantity"),
  });
  if (parsed.state) return parsed.state;
  const { customerId, marginBps, quantity } = parsed.data;

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId: ctx.company.id },
    select: { id: true },
  });
  if (!customer) return fail("Cliente invalido.");

  let built: Built | null = null;

  if (niche === "vidracaria") {
    const glass = await prisma.glassOption.findFirst({
      where: { id: String(formData.get("glassOptionId") ?? ""), companyId: ctx.company.id },
    });
    if (!glass) return fail("Selecione o vidro.");
    const widthMm = num(formData, "widthMm");
    const heightMm = num(formData, "heightMm");
    if (!widthMm || !heightMm) return fail("Informe largura e altura.");

    let finish = null;
    let finishSpec: { name: string; unit: string; priceCents: number } | null = null;
    const finishId = String(formData.get("finishOptionId") ?? "");
    if (finishId) {
      const f = await prisma.finishOption.findFirst({ where: { id: finishId, companyId: ctx.company.id } });
      if (f) {
        finish = { unit: f.unit as "m2" | "ml" | "fixo", priceCents: f.priceCents };
        finishSpec = { name: f.name, unit: f.unit, priceCents: f.priceCents };
      }
    }

    const hwOptions = await prisma.hardwareOption.findMany({ where: { companyId: ctx.company.id } });
    const hardware: HardwareLine[] = [];
    const hardwareSpec: { name: string; quantity: number; unitPriceCents: number }[] = [];
    for (const hw of hwOptions) {
      const qty = num(formData, `hw_${hw.id}`);
      if (qty > 0) {
        hardware.push({ name: hw.name, quantity: qty, unitPriceCents: hw.priceCents });
        hardwareSpec.push({ name: hw.name, quantity: qty, unitPriceCents: hw.priceCents });
      }
    }

    const bd = computeGlassItem({
      widthMm, heightMm, quantity, glassPricePerM2Cents: glass.pricePerM2Cents, finish, hardware,
    });
    built = {
      description: `${glass.glassType} ${glass.thicknessMm}mm ${widthMm}x${heightMm}mm`,
      unit: "un",
      spec: {
        widthMm, heightMm,
        glass: { id: glass.id, glassType: glass.glassType, thicknessMm: glass.thicknessMm, pricePerM2Cents: glass.pricePerM2Cents },
        finish: finishSpec, hardware: hardwareSpec,
      },
      breakdown: {
        areaM2Total: bd.areaM2Total, glassCents: bd.glassCents, finishCents: bd.finishCents,
        hardwareCents: bd.hardwareCents, materialsCents: bd.materialsCents,
      },
    };
  } else if (niche === "serralheria") {
    const product = await prisma.steelProduct.findFirst({
      where: { id: String(formData.get("productId") ?? ""), companyId: ctx.company.id },
    });
    if (!product) return fail("Selecione o produto/serviço.");
    const widthMm = num(formData, "widthMm");
    const heightMm = num(formData, "heightMm");
    const lengthMm = num(formData, "lengthMm");
    const weightKg = num(formData, "weightKg");

    const bd = computeSteelItem({
      baseUnit: product.baseUnit as "un" | "ml" | "m2" | "kg",
      widthMm, heightMm, lengthMm, weightKg, quantity,
      materialCostPerBaseCents: product.materialCostPerBaseCents,
      laborCostPerBaseCents: product.laborCostPerBaseCents,
      paintCostPerBaseCents: product.paintCostPerBaseCents,
      weightPerBaseKg: product.weightPerBaseKg,
    });
    built = {
      description: product.name,
      unit: product.baseUnit,
      spec: {
        productId: product.id, productName: product.name, serviceType: product.serviceType,
        serviceTypeLabel: serviceTypeLabel(product.serviceType), baseUnit: product.baseUnit,
        materialName: product.materialName, widthMm, heightMm, lengthMm, weightKg,
      },
      breakdown: {
        baseUnit: bd.baseUnit, baseQtyTotal: bd.baseQtyTotal, weightKgTotal: bd.weightKgTotal,
        materialCents: bd.materialCents, laborCents: bd.laborCents, paintCents: bd.paintCents,
        materialsCents: bd.materialsCents,
      },
    };
  } else {
    const template = await prisma.woodTemplate.findFirst({
      where: { id: String(formData.get("templateId") ?? ""), companyId: ctx.company.id },
    });
    if (!template) return fail("Selecione o modelo.");
    const materialId = String(formData.get("materialId") ?? "") || template.materialId || null;
    const finishId = String(formData.get("finishId") ?? "") || template.finishId || null;
    const material = materialId ? await prisma.woodMaterial.findFirst({ where: { id: materialId, companyId: ctx.company.id } }) : null;
    const finish = finishId ? await prisma.woodFinish.findFirst({ where: { id: finishId, companyId: ctx.company.id } }) : null;

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

    const widthMm = num(formData, "widthMm") || template.defaultWidthMm || 0;
    const heightMm = num(formData, "heightMm") || template.defaultHeightMm || 0;
    const depthMm = num(formData, "depthMm") || template.defaultDepthMm || 0;

    const bd = computeWoodItem({
      areaMode: template.areaMode as "frontal" | "caixa",
      widthMm, heightMm, depthMm, quantity,
      materialPricePerM2Cents: material?.pricePerM2Cents ?? 0,
      finishPricePerM2Cents: finish?.pricePerM2Cents ?? 0,
      laborPerM2Cents: template.laborPerM2Cents,
      assemblyPerM2Cents: template.assemblyPerM2Cents,
      hardware: hardwareLines,
    });
    built = {
      description: template.name,
      unit: "un",
      spec: {
        templateName: template.name, areaMode: template.areaMode, widthMm, heightMm, depthMm,
        materialName: material ? `${material.name} ${material.thicknessMm}mm` : null,
        finishName: finish?.name ?? null, hardware: hardwareSpec,
      },
      breakdown: {
        areaM2Total: bd.areaM2Total, materialCents: bd.materialCents, finishCents: bd.finishCents,
        laborCents: bd.laborCents, assemblyCents: bd.assemblyCents, hardwareCents: bd.hardwareCents,
        materialsCents: bd.materialsCents,
      },
    };
  }

  if (!built) return fail("Não foi possível montar o item.");

  const materialsCents = built.breakdown.materialsCents;
  const marginCents = Math.round((materialsCents * marginBps) / 10000);
  const totalCents = materialsCents + marginCents;
  const unitPriceCents = quantity > 0 ? Math.round(materialsCents / quantity) : materialsCents;

  let quoteId: string;
  try {
    const agg = await prisma.quote.aggregate({ where: { companyId: ctx.company.id }, _max: { number: true } });
    const number = (agg._max.number ?? 0) + 1;
    const created = await prisma.quote.create({
      data: {
        companyId: ctx.company.id,
        number,
        customerId: customer.id,
        status: "rascunho",
        marginBps,
        subtotalCents: materialsCents,
        totalCents,
        statusEvents: { create: { companyId: ctx.company.id, status: "rascunho" } },
        items: {
          create: {
            description: built.description,
            quantity,
            unit: built.unit,
            unitPriceCents,
            spec: built.spec,
            breakdown: built.breakdown as Prisma.InputJsonValue,
          },
        },
      },
    });
    quoteId = created.id;
  } catch {
    return fail("Não foi possível gerar o orçamento.");
  }

  redirect(`/orcamentos/${quoteId}`);
}
