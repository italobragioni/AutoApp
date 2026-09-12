"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/core/db";
import { authorizeState, parseOrFail, fail, type FormState } from "@/lib/core/actions";
import { parseMoneyToCents, parsePercentToBps } from "@/lib/core/money";
import {
  productSchema,
  materialSchema,
  laborSchema,
  additionalCostSchema,
} from "@/lib/validation/catalog";

// ---------------------------------------------------------------------------
// Produtos / Servicos
// ---------------------------------------------------------------------------

function readProduct(formData: FormData) {
  return {
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    category: formData.get("category") ?? "",
    unit: formData.get("unit"),
    basePriceCents: formData.get("basePriceCents") ?? "",
    active: formData.get("active"),
  };
}

export async function createProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorizeState();
  if (!ctx) return state;

  const parsed = parseOrFail(productSchema, readProduct(formData));
  if (parsed.state) return parsed.state;

  try {
    await prisma.product.create({
      data: { companyId: ctx.company.id, niche: ctx.company.niche, ...parsed.data },
    });
  } catch {
    return fail("Nao foi possivel salvar o produto.");
  }
  revalidatePath("/produtos");
  redirect("/produtos");
}

export async function updateProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorizeState();
  if (!ctx) return state;
  const id = String(formData.get("id") ?? "");
  if (!id) return fail("Produto invalido.");

  const parsed = parseOrFail(productSchema, readProduct(formData));
  if (parsed.state) return parsed.state;

  try {
    const r = await prisma.product.updateMany({
      where: { id, companyId: ctx.company.id },
      data: parsed.data,
    });
    if (r.count === 0) return fail("Produto nao encontrado.");
  } catch {
    return fail("Nao foi possivel salvar as alteracoes.");
  }
  revalidatePath("/produtos");
  redirect("/produtos");
}

export async function deleteProduct(formData: FormData): Promise<void> {
  const { ctx } = await authorizeState();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.product.deleteMany({ where: { id, companyId: ctx.company.id } });
  revalidatePath("/produtos");
}

// ---------------------------------------------------------------------------
// Materiais
// ---------------------------------------------------------------------------

function readMaterial(formData: FormData) {
  return {
    name: formData.get("name"),
    unit: formData.get("unit"),
    costCents: formData.get("costCents") ?? "",
    supplier: formData.get("supplier") ?? "",
    active: formData.get("active"),
  };
}

export async function createMaterial(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorizeState();
  if (!ctx) return state;
  const parsed = parseOrFail(materialSchema, readMaterial(formData));
  if (parsed.state) return parsed.state;
  try {
    await prisma.material.create({ data: { companyId: ctx.company.id, ...parsed.data } });
  } catch {
    return fail("Nao foi possivel salvar o material.");
  }
  revalidatePath("/materiais");
  redirect("/materiais");
}

export async function updateMaterial(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorizeState();
  if (!ctx) return state;
  const id = String(formData.get("id") ?? "");
  if (!id) return fail("Material invalido.");
  const parsed = parseOrFail(materialSchema, readMaterial(formData));
  if (parsed.state) return parsed.state;
  try {
    const r = await prisma.material.updateMany({
      where: { id, companyId: ctx.company.id },
      data: parsed.data,
    });
    if (r.count === 0) return fail("Material nao encontrado.");
  } catch {
    return fail("Nao foi possivel salvar as alteracoes.");
  }
  revalidatePath("/materiais");
  redirect("/materiais");
}

export async function deleteMaterial(formData: FormData): Promise<void> {
  const { ctx } = await authorizeState();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.material.deleteMany({ where: { id, companyId: ctx.company.id } });
  revalidatePath("/materiais");
}

// ---------------------------------------------------------------------------
// Custos: Mao de obra + Custos adicionais (deslocamento, outros)
// ---------------------------------------------------------------------------

function readLabor(formData: FormData) {
  return {
    name: formData.get("name"),
    unit: formData.get("unit"),
    rateCents: formData.get("rateCents") ?? "",
    active: formData.get("active"),
  };
}

export async function createLabor(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorizeState();
  if (!ctx) return state;
  const parsed = parseOrFail(laborSchema, readLabor(formData));
  if (parsed.state) return parsed.state;
  try {
    await prisma.laborRate.create({ data: { companyId: ctx.company.id, ...parsed.data } });
  } catch {
    return fail("Nao foi possivel salvar a mao de obra.");
  }
  revalidatePath("/custos");
  redirect("/custos");
}

export async function deleteLabor(formData: FormData): Promise<void> {
  const { ctx } = await authorizeState();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.laborRate.deleteMany({ where: { id, companyId: ctx.company.id } });
  revalidatePath("/custos");
}

export async function createAdditionalCost(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorizeState();
  if (!ctx) return state;

  const parsed = parseOrFail(additionalCostSchema, {
    name: formData.get("name"),
    kind: formData.get("kind"),
    value: formData.get("value") ?? "",
    active: formData.get("active"),
  });
  if (parsed.state) return parsed.state;

  const { name, kind, value, active } = parsed.data;

  // Interpreta o valor conforme o tipo do custo.
  let amountCents: number | null = null;
  let percentBps: number | null = null;
  if (kind === "fixo") {
    amountCents = parseMoneyToCents(value);
    if (amountCents === null) {
      return { ok: false, error: "Verifique os campos destacados.", fieldErrors: { value: "Valor invalido." } };
    }
  } else {
    percentBps = parsePercentToBps(value);
    if (percentBps === null) {
      return { ok: false, error: "Verifique os campos destacados.", fieldErrors: { value: "Percentual invalido." } };
    }
  }

  try {
    await prisma.additionalCost.create({
      data: { companyId: ctx.company.id, name, kind, amountCents, percentBps, active },
    });
  } catch {
    return fail("Nao foi possivel salvar o custo.");
  }
  revalidatePath("/custos");
  redirect("/custos");
}

export async function deleteAdditionalCost(formData: FormData): Promise<void> {
  const { ctx } = await authorizeState();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.additionalCost.deleteMany({ where: { id, companyId: ctx.company.id } });
  revalidatePath("/custos");
}
