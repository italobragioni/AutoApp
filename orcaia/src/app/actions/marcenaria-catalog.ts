"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/core/db";
import { authorizeNiche, fail, parseOrFail, type FormState } from "@/lib/core/actions";
import {
  woodMaterialSchema,
  woodFinishSchema,
  woodHardwareSchema,
  woodTemplateSchema,
} from "@/lib/validation/marcenaria";

const authorize = () => authorizeNiche("marcenaria");

// ---- Materiais ----
export async function createWoodMaterial(_p: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorize();
  if (!ctx) return state;
  const parsed = parseOrFail(woodMaterialSchema, {
    name: formData.get("name"),
    thicknessMm: formData.get("thicknessMm"),
    pricePerM2Cents: formData.get("pricePerM2Cents") ?? "",
    active: formData.get("active"),
  });
  if (parsed.state) return parsed.state;
  try {
    await prisma.woodMaterial.create({ data: { companyId: ctx.company.id, ...parsed.data } });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return fail("Ja existe esse material com essa espessura.");
    }
    return fail("Nao foi possivel salvar o material.");
  }
  revalidatePath("/marcenaria");
  redirect("/marcenaria");
}

export async function deleteWoodMaterial(formData: FormData): Promise<void> {
  const { ctx } = await authorize();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.woodMaterial.deleteMany({ where: { id, companyId: ctx.company.id } });
  revalidatePath("/marcenaria");
}

// ---- Acabamentos ----
export async function createWoodFinish(_p: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorize();
  if (!ctx) return state;
  const parsed = parseOrFail(woodFinishSchema, {
    name: formData.get("name"),
    pricePerM2Cents: formData.get("pricePerM2Cents") ?? "",
    active: formData.get("active"),
  });
  if (parsed.state) return parsed.state;
  try {
    await prisma.woodFinish.create({ data: { companyId: ctx.company.id, ...parsed.data } });
  } catch {
    return fail("Nao foi possivel salvar o acabamento.");
  }
  revalidatePath("/marcenaria");
  redirect("/marcenaria");
}

export async function deleteWoodFinish(formData: FormData): Promise<void> {
  const { ctx } = await authorize();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.woodFinish.deleteMany({ where: { id, companyId: ctx.company.id } });
  revalidatePath("/marcenaria");
}

// ---- Ferragens ----
export async function createWoodHardware(_p: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorize();
  if (!ctx) return state;
  const parsed = parseOrFail(woodHardwareSchema, {
    name: formData.get("name"),
    priceCents: formData.get("priceCents") ?? "",
    active: formData.get("active"),
  });
  if (parsed.state) return parsed.state;
  try {
    await prisma.woodHardware.create({ data: { companyId: ctx.company.id, ...parsed.data } });
  } catch {
    return fail("Nao foi possivel salvar a ferragem.");
  }
  revalidatePath("/marcenaria");
  redirect("/marcenaria");
}

export async function deleteWoodHardware(formData: FormData): Promise<void> {
  const { ctx } = await authorize();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.woodHardware.deleteMany({ where: { id, companyId: ctx.company.id } });
  revalidatePath("/marcenaria");
}

// ---- Modelos de produto (WoodTemplate) ----
function readTemplate(formData: FormData) {
  return {
    name: formData.get("name"),
    category: formData.get("category") ?? "",
    areaMode: formData.get("areaMode"),
    materialId: formData.get("materialId") ?? "",
    finishId: formData.get("finishId") ?? "",
    laborPerM2Cents: formData.get("laborPerM2Cents") ?? "",
    assemblyPerM2Cents: formData.get("assemblyPerM2Cents") ?? "",
    marginBps: formData.get("marginBps"),
    defaultWidthMm: formData.get("defaultWidthMm") ?? "0",
    defaultHeightMm: formData.get("defaultHeightMm") ?? "0",
    defaultDepthMm: formData.get("defaultDepthMm") ?? "0",
    active: formData.get("active"),
  };
}

// Le ferragens padrao do modelo (campos hw_<id> = quantidade).
async function readTemplateHardware(companyId: string, formData: FormData) {
  const options = await prisma.woodHardware.findMany({ where: { companyId } });
  const hardware: { hardwareId: string; quantity: number }[] = [];
  for (const hw of options) {
    const raw = formData.get(`hw_${hw.id}`);
    const qty = raw ? parseInt(String(raw), 10) : 0;
    if (Number.isFinite(qty) && qty > 0) hardware.push({ hardwareId: hw.id, quantity: qty });
  }
  return hardware;
}

export async function createWoodTemplate(_p: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorize();
  if (!ctx) return state;
  const parsed = parseOrFail(woodTemplateSchema, readTemplate(formData));
  if (parsed.state) return parsed.state;
  const hardware = await readTemplateHardware(ctx.company.id, formData);
  const d = parsed.data;
  try {
    await prisma.woodTemplate.create({
      data: {
        companyId: ctx.company.id,
        name: d.name,
        category: d.category ?? null,
        areaMode: d.areaMode,
        materialId: d.materialId ?? null,
        finishId: d.finishId ?? null,
        laborPerM2Cents: d.laborPerM2Cents,
        assemblyPerM2Cents: d.assemblyPerM2Cents,
        marginBps: d.marginBps,
        defaultWidthMm: d.defaultWidthMm || null,
        defaultHeightMm: d.defaultHeightMm || null,
        defaultDepthMm: d.defaultDepthMm || null,
        hardware,
      },
    });
  } catch {
    return fail("Nao foi possivel salvar o modelo.");
  }
  revalidatePath("/marcenaria");
  redirect("/marcenaria");
}

export async function updateWoodTemplate(_p: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorize();
  if (!ctx) return state;
  const id = String(formData.get("id") ?? "");
  if (!id) return fail("Modelo invalido.");
  const parsed = parseOrFail(woodTemplateSchema, readTemplate(formData));
  if (parsed.state) return parsed.state;
  const hardware = await readTemplateHardware(ctx.company.id, formData);
  const d = parsed.data;
  try {
    const r = await prisma.woodTemplate.updateMany({
      where: { id, companyId: ctx.company.id },
      data: {
        name: d.name,
        category: d.category ?? null,
        areaMode: d.areaMode,
        materialId: d.materialId ?? null,
        finishId: d.finishId ?? null,
        laborPerM2Cents: d.laborPerM2Cents,
        assemblyPerM2Cents: d.assemblyPerM2Cents,
        marginBps: d.marginBps,
        defaultWidthMm: d.defaultWidthMm || null,
        defaultHeightMm: d.defaultHeightMm || null,
        defaultDepthMm: d.defaultDepthMm || null,
        hardware,
      },
    });
    if (r.count === 0) return fail("Modelo nao encontrado.");
  } catch {
    return fail("Nao foi possivel salvar o modelo.");
  }
  revalidatePath("/marcenaria");
  redirect("/marcenaria");
}

export async function deleteWoodTemplate(formData: FormData): Promise<void> {
  const { ctx } = await authorize();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.woodTemplate.deleteMany({ where: { id, companyId: ctx.company.id } });
  revalidatePath("/marcenaria");
}
