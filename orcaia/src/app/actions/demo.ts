"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/core/db";
import { authorizeState } from "@/lib/core/actions";
import { computeGlassItem } from "@/lib/niches/vidracaria/pricing";
import { computeSteelItem } from "@/lib/niches/serralheria/pricing";
import { serviceTypeLabel } from "@/lib/niches/serralheria/options";
import { computeWoodItem } from "@/lib/niches/marcenaria/pricing";

// Popula a empresa logada com dados de demonstracao (catalogo + clientes +
// orcamentos de exemplo) para o usuario testar. So roda se a empresa ainda nao
// tem clientes, para nao duplicar.

type BuiltItem = {
  description: string;
  unit: string;
  quantity: number;
  spec: Prisma.InputJsonValue;
  breakdown: { materialsCents: number } & Record<string, unknown>;
};

async function makeQuote(
  companyId: string,
  customerId: string,
  status: string,
  marginBps: number,
  item: BuiltItem,
  extra?: { installationCents?: number; deliveryTime?: string; paymentTerms?: string },
) {
  const materials = item.breakdown.materialsCents;
  const install = extra?.installationCents ?? 0;
  const costsBase = materials + install;
  const marginCents = Math.round((costsBase * marginBps) / 10000);
  const totalCents = costsBase + marginCents;
  const maxNumber = await prisma.quote.aggregate({ where: { companyId }, _max: { number: true } });
  const number = (maxNumber._max.number ?? 0) + 1;
  await prisma.quote.create({
    data: {
      companyId,
      number,
      customerId,
      status,
      marginBps,
      installationCents: install,
      deliveryTime: extra?.deliveryTime ?? null,
      paymentTerms: extra?.paymentTerms ?? null,
      subtotalCents: materials,
      totalCents,
      statusEvents: { create: { companyId, status } },
      items: {
        create: {
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPriceCents: item.quantity > 0 ? Math.round(materials / item.quantity) : materials,
          spec: item.spec,
          breakdown: item.breakdown as Prisma.InputJsonValue,
        },
      },
    },
  });
}

export async function loadDemoData(): Promise<void> {
  const { ctx } = await authorizeState();
  if (!ctx) return;
  const companyId = ctx.company.id;

  // Nao duplica: se os dados de demonstracao ja foram carregados antes, sai.
  const demoExists = await prisma.customer.findFirst({
    where: { companyId, name: "João Silva" },
    select: { id: true },
  });
  if (demoExists) {
    revalidatePath("/dashboard");
    return;
  }

  const [c1, c2, c3] = await Promise.all([
    prisma.customer.create({ data: { companyId, name: "João Silva", phone: "(11) 99999-1111", whatsapp: "11999991111", email: "joao@email.com" } }),
    prisma.customer.create({ data: { companyId, name: "Maria Oliveira", phone: "(11) 98888-2222", email: "maria@email.com" } }),
    prisma.customer.create({ data: { companyId, name: "Construtora Alfa", document: "12.345.678/0001-90", phone: "(11) 3000-4000" } }),
  ]);

  if (ctx.company.niche === "vidracaria") {
    const [g8, g10, g4] = await Promise.all([
      prisma.glassOption.create({ data: { companyId, glassType: "Temperado", thicknessMm: 8, pricePerM2Cents: 30000 } }),
      prisma.glassOption.create({ data: { companyId, glassType: "Temperado", thicknessMm: 10, pricePerM2Cents: 38000 } }),
      prisma.glassOption.create({ data: { companyId, glassType: "Comum", thicknessMm: 4, pricePerM2Cents: 12000 } }),
    ]);
    const lap = await prisma.finishOption.create({ data: { companyId, name: "Lapidado", unit: "ml", priceCents: 2500 } });
    const dob = await prisma.hardwareOption.create({ data: { companyId, name: "Dobradiça", priceCents: 4000 } });
    await prisma.hardwareOption.create({ data: { companyId, name: "Puxador", priceCents: 6000 } });

    const box = computeGlassItem({ widthMm: 1000, heightMm: 2000, quantity: 1, glassPricePerM2Cents: g8.pricePerM2Cents, finish: { unit: "ml", priceCents: lap.priceCents }, hardware: [{ name: "Dobradiça", quantity: 2, unitPriceCents: dob.priceCents }] });
    const espelho = computeGlassItem({ widthMm: 800, heightMm: 1200, quantity: 1, glassPricePerM2Cents: g4.pricePerM2Cents, finish: { unit: "ml", priceCents: lap.priceCents }, hardware: [] });
    const guarda = computeGlassItem({ widthMm: 1500, heightMm: 2200, quantity: 1, glassPricePerM2Cents: g10.pricePerM2Cents, finish: null, hardware: [] });

    await makeQuote(companyId, c1.id, "aprovado", 2000, {
      description: "Box de correr Temperado 8mm", unit: "un", quantity: 1,
      spec: { widthMm: 1000, heightMm: 2000, glass: { glassType: "Temperado", thicknessMm: 8, pricePerM2Cents: g8.pricePerM2Cents }, finish: { name: "Lapidado" }, hardware: [{ name: "Dobradiça", quantity: 2 }] },
      breakdown: { areaM2Total: box.areaM2Total, glassCents: box.glassCents, finishCents: box.finishCents, hardwareCents: box.hardwareCents, materialsCents: box.materialsCents },
    }, { installationCents: 8000, deliveryTime: "5 dias úteis", paymentTerms: "50% + 50%" });

    await makeQuote(companyId, c2.id, "enviado", 2500, {
      description: "Espelho lapidado 0,80 x 1,20", unit: "un", quantity: 1,
      spec: { widthMm: 800, heightMm: 1200, glass: { glassType: "Comum", thicknessMm: 4, pricePerM2Cents: g4.pricePerM2Cents }, finish: { name: "Lapidado" }, hardware: [] },
      breakdown: { areaM2Total: espelho.areaM2Total, glassCents: espelho.glassCents, finishCents: espelho.finishCents, hardwareCents: espelho.hardwareCents, materialsCents: espelho.materialsCents },
    });

    await makeQuote(companyId, c3.id, "em_negociacao", 2200, {
      description: "Guarda-corpo Temperado 10mm", unit: "un", quantity: 1,
      spec: { widthMm: 1500, heightMm: 2200, glass: { glassType: "Temperado", thicknessMm: 10, pricePerM2Cents: g10.pricePerM2Cents }, finish: null, hardware: [] },
      breakdown: { areaM2Total: guarda.areaM2Total, glassCents: guarda.glassCents, finishCents: guarda.finishCents, hardwareCents: guarda.hardwareCents, materialsCents: guarda.materialsCents },
    }, { installationCents: 15000 });
  } else if (ctx.company.niche === "serralheria") {
    await prisma.steelMaterial.create({ data: { companyId, name: "Aço carbono", unit: "kg", pricePerUnitCents: 800 } });
    const portao = await prisma.steelProduct.create({ data: { companyId, name: "Portão basculante", serviceType: "portao", baseUnit: "m2", materialName: "Aço carbono", materialCostPerBaseCents: 12000, laborCostPerBaseCents: 8000, paintCostPerBaseCents: 3000, weightPerBaseKg: 25, marginBps: 3000 } });
    const grade = await prisma.steelProduct.create({ data: { companyId, name: "Grade de proteção", serviceType: "grade", baseUnit: "m2", materialName: "Aço carbono", materialCostPerBaseCents: 9000, laborCostPerBaseCents: 6000, paintCostPerBaseCents: 2500, weightPerBaseKg: 18, marginBps: 3000 } });
    const corrimao = await prisma.steelProduct.create({ data: { companyId, name: "Corrimão", serviceType: "corrimao", baseUnit: "ml", materialName: "Aço carbono", materialCostPerBaseCents: 6000, laborCostPerBaseCents: 4000, paintCostPerBaseCents: 2000, weightPerBaseKg: 6, marginBps: 3000 } });

    const b1 = computeSteelItem({ baseUnit: "m2", widthMm: 3000, heightMm: 2200, lengthMm: 0, weightKg: 0, quantity: 1, materialCostPerBaseCents: portao.materialCostPerBaseCents, laborCostPerBaseCents: portao.laborCostPerBaseCents, paintCostPerBaseCents: portao.paintCostPerBaseCents, weightPerBaseKg: portao.weightPerBaseKg });
    const b2 = computeSteelItem({ baseUnit: "m2", widthMm: 2000, heightMm: 1500, lengthMm: 0, weightKg: 0, quantity: 2, materialCostPerBaseCents: grade.materialCostPerBaseCents, laborCostPerBaseCents: grade.laborCostPerBaseCents, paintCostPerBaseCents: grade.paintCostPerBaseCents, weightPerBaseKg: grade.weightPerBaseKg });
    const b3 = computeSteelItem({ baseUnit: "ml", widthMm: 0, heightMm: 0, lengthMm: 6000, weightKg: 0, quantity: 1, materialCostPerBaseCents: corrimao.materialCostPerBaseCents, laborCostPerBaseCents: corrimao.laborCostPerBaseCents, paintCostPerBaseCents: corrimao.paintCostPerBaseCents, weightPerBaseKg: corrimao.weightPerBaseKg });

    const specSteel = (p: { id: string; name: string; serviceType: string; baseUnit: string; materialName: string | null }, dims: Record<string, number>) => ({ productId: p.id, productName: p.name, serviceType: p.serviceType, serviceTypeLabel: serviceTypeLabel(p.serviceType), baseUnit: p.baseUnit, materialName: p.materialName, ...dims });
    const bdSteel = (b: ReturnType<typeof computeSteelItem>) => ({ baseUnit: b.baseUnit, baseQtyTotal: b.baseQtyTotal, weightKgTotal: b.weightKgTotal, materialCents: b.materialCents, laborCents: b.laborCents, paintCents: b.paintCents, materialsCents: b.materialsCents });

    await makeQuote(companyId, c3.id, "aprovado", 3000, { description: "Portão basculante 3,00 x 2,20", unit: "m2", quantity: 1, spec: specSteel(portao, { widthMm: 3000, heightMm: 2200 }), breakdown: bdSteel(b1) }, { installationCents: 25000, deliveryTime: "20 dias úteis", paymentTerms: "Entrada + entrega" });
    await makeQuote(companyId, c1.id, "enviado", 3000, { description: "Grades de proteção (2 un)", unit: "m2", quantity: 2, spec: specSteel(grade, { widthMm: 2000, heightMm: 1500 }), breakdown: bdSteel(b2) });
    await makeQuote(companyId, c2.id, "em_negociacao", 3000, { description: "Corrimão 6 m", unit: "ml", quantity: 1, spec: specSteel(corrimao, { lengthMm: 6000 }), breakdown: bdSteel(b3) });
  } else if (ctx.company.niche === "marcenaria") {
    const mdf = await prisma.woodMaterial.create({ data: { companyId, name: "MDF", thicknessMm: 18, pricePerM2Cents: 15000 } });
    const mdp = await prisma.woodMaterial.create({ data: { companyId, name: "MDP", thicknessMm: 15, pricePerM2Cents: 11000 } });
    const mel = await prisma.woodFinish.create({ data: { companyId, name: "Melamínico", pricePerM2Cents: 4000 } });
    const bp = await prisma.woodFinish.create({ data: { companyId, name: "BP", pricePerM2Cents: 3000 } });
    const dob = await prisma.woodHardware.create({ data: { companyId, name: "Dobradiças", priceCents: 1200 } });
    const cor = await prisma.woodHardware.create({ data: { companyId, name: "Corrediças", priceCents: 3500 } });

    const tGuarda = await prisma.woodTemplate.create({ data: { companyId, name: "Guarda-roupa", areaMode: "frontal", materialId: mdf.id, finishId: mel.id, laborPerM2Cents: 12000, assemblyPerM2Cents: 5000, marginBps: 3000, defaultWidthMm: 2000, defaultHeightMm: 2500, defaultDepthMm: 550, hardware: [{ hardwareId: dob.id, quantity: 6 }] } });
    const tPainel = await prisma.woodTemplate.create({ data: { companyId, name: "Painel de TV", areaMode: "frontal", materialId: mdp.id, finishId: bp.id, laborPerM2Cents: 9000, assemblyPerM2Cents: 3000, marginBps: 3000, defaultWidthMm: 1800, defaultHeightMm: 1200, defaultDepthMm: 40, hardware: [] } });
    const tCozinha = await prisma.woodTemplate.create({ data: { companyId, name: "Gabinete de cozinha", areaMode: "caixa", materialId: mdf.id, finishId: mel.id, laborPerM2Cents: 14000, assemblyPerM2Cents: 6000, marginBps: 3000, defaultWidthMm: 1200, defaultHeightMm: 800, defaultDepthMm: 550, hardware: [{ hardwareId: dob.id, quantity: 4 }, { hardwareId: cor.id, quantity: 2 }] } });

    const wood = (t: { areaMode: string }, w: number, h: number, d: number, matPrice: number, finPrice: number, labor: number, assembly: number, hw: { quantity: number; unitPriceCents: number }[]) =>
      computeWoodItem({ areaMode: t.areaMode as "frontal" | "caixa", widthMm: w, heightMm: h, depthMm: d, quantity: 1, materialPricePerM2Cents: matPrice, finishPricePerM2Cents: finPrice, laborPerM2Cents: labor, assemblyPerM2Cents: assembly, hardware: hw.map((x) => ({ name: "", quantity: x.quantity, unitPriceCents: x.unitPriceCents })) });

    const b1 = wood(tGuarda, 2000, 2500, 550, mdf.pricePerM2Cents, mel.pricePerM2Cents, 12000, 5000, [{ quantity: 6, unitPriceCents: dob.priceCents }]);
    const b2 = wood(tPainel, 1800, 1200, 40, mdp.pricePerM2Cents, bp.pricePerM2Cents, 9000, 3000, []);
    const b3 = wood(tCozinha, 1200, 800, 550, mdf.pricePerM2Cents, mel.pricePerM2Cents, 14000, 6000, [{ quantity: 4, unitPriceCents: dob.priceCents }, { quantity: 2, unitPriceCents: cor.priceCents }]);

    const bdWood = (b: ReturnType<typeof computeWoodItem>) => ({ areaM2Total: b.areaM2Total, materialCents: b.materialCents, finishCents: b.finishCents, laborCents: b.laborCents, assemblyCents: b.assemblyCents, hardwareCents: b.hardwareCents, materialsCents: b.materialsCents });

    await makeQuote(companyId, c1.id, "aprovado", 3000, { description: "Guarda-roupa casal", unit: "un", quantity: 1, spec: { templateName: tGuarda.name, areaMode: "frontal", widthMm: 2000, heightMm: 2500, depthMm: 550, materialName: "MDF 18mm", finishName: "Melamínico", hardware: [{ name: "Dobradiças", quantity: 6 }] }, breakdown: bdWood(b1) }, { installationCents: 20000, deliveryTime: "30 dias", paymentTerms: "40% entrada, saldo na entrega" });
    await makeQuote(companyId, c2.id, "enviado", 3000, { description: "Painel de TV ripado", unit: "un", quantity: 1, spec: { templateName: tPainel.name, areaMode: "frontal", widthMm: 1800, heightMm: 1200, depthMm: 40, materialName: "MDP 15mm", finishName: "BP", hardware: [] }, breakdown: bdWood(b2) });
    await makeQuote(companyId, c3.id, "em_negociacao", 3000, { description: "Gabinete de cozinha", unit: "un", quantity: 1, spec: { templateName: tCozinha.name, areaMode: "caixa", widthMm: 1200, heightMm: 800, depthMm: 550, materialName: "MDF 18mm", finishName: "Melamínico", hardware: [{ name: "Dobradiças", quantity: 4 }, { name: "Corrediças", quantity: 2 }] }, breakdown: bdWood(b3) }, { installationCents: 12000 });
  }

  revalidatePath("/dashboard");
  revalidatePath("/orcamentos");
  revalidatePath("/clientes");
}
