"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/core/db";
import { authorizeNiche, fail, parseOrFail, type FormState } from "@/lib/core/actions";
import { steelMaterialSchema, steelProductSchema } from "@/lib/validation/serralheria";

const authorizeSerralheria = () => authorizeNiche("serralheria");

// ---- Materiais (SteelMaterial) ----

export async function createSteelMaterial(_p: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorizeSerralheria();
  if (!ctx) return state;

  const parsed = parseOrFail(steelMaterialSchema, {
    name: formData.get("name"),
    unit: formData.get("unit"),
    pricePerUnitCents: formData.get("pricePerUnitCents") ?? "",
    active: formData.get("active"),
  });
  if (parsed.state) return parsed.state;

  try {
    await prisma.steelMaterial.create({ data: { companyId: ctx.company.id, ...parsed.data } });
  } catch {
    return fail("Nao foi possivel salvar o material.");
  }
  revalidatePath("/serralheria");
  redirect("/serralheria");
}

export async function deleteSteelMaterial(formData: FormData): Promise<void> {
  const { ctx } = await authorizeSerralheria();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.steelMaterial.deleteMany({ where: { id, companyId: ctx.company.id } });
  revalidatePath("/serralheria");
}

// ---- Produtos / servicos (SteelProduct) ----

function readProduct(formData: FormData) {
  return {
    name: formData.get("name"),
    serviceType: formData.get("serviceType"),
    baseUnit: formData.get("baseUnit"),
    materialName: formData.get("materialName") ?? "",
    materialCostPerBaseCents: formData.get("materialCostPerBaseCents") ?? "",
    laborCostPerBaseCents: formData.get("laborCostPerBaseCents") ?? "",
    paintCostPerBaseCents: formData.get("paintCostPerBaseCents") ?? "",
    weightPerBaseKg: formData.get("weightPerBaseKg") ?? "0",
    marginBps: formData.get("marginBps"),
    active: formData.get("active"),
  };
}

export async function createSteelProduct(_p: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorizeSerralheria();
  if (!ctx) return state;

  const parsed = parseOrFail(steelProductSchema, readProduct(formData));
  if (parsed.state) return parsed.state;

  try {
    await prisma.steelProduct.create({
      data: { companyId: ctx.company.id, ...parsed.data, materialName: parsed.data.materialName ?? null },
    });
  } catch {
    return fail("Nao foi possivel salvar o produto.");
  }
  revalidatePath("/serralheria");
  redirect("/serralheria");
}

export async function updateSteelProduct(_p: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorizeSerralheria();
  if (!ctx) return state;
  const id = String(formData.get("id") ?? "");
  if (!id) return fail("Produto invalido.");

  const parsed = parseOrFail(steelProductSchema, readProduct(formData));
  if (parsed.state) return parsed.state;

  try {
    const r = await prisma.steelProduct.updateMany({
      where: { id, companyId: ctx.company.id },
      data: { ...parsed.data, materialName: parsed.data.materialName ?? null },
    });
    if (r.count === 0) return fail("Produto nao encontrado.");
  } catch {
    return fail("Nao foi possivel salvar as alteracoes.");
  }
  revalidatePath("/serralheria");
  redirect("/serralheria");
}

export async function deleteSteelProduct(formData: FormData): Promise<void> {
  const { ctx } = await authorizeSerralheria();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.steelProduct.deleteMany({ where: { id, companyId: ctx.company.id } });
  revalidatePath("/serralheria");
}
