"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/core/db";
import { authorizeNiche, fail, parseOrFail, type FormState } from "@/lib/core/actions";
import {
  glassOptionSchema,
  finishOptionSchema,
  hardwareOptionSchema,
} from "@/lib/validation/vidracaria";

// Todo este catalogo e exclusivo do nicho vidracaria. authorizeNiche garante
// que so empresas vidracaria criam/enxergam estes dados; tudo tambem e escopado
// por companyId nas queries.
const authorizeVidracaria = () => authorizeNiche("vidracaria");

// ---- Vidros (GlassOption) ----

export async function createGlassOption(_p: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorizeVidracaria();
  if (!ctx) return state;

  const parsed = parseOrFail(glassOptionSchema, {
    glassType: formData.get("glassType"),
    thicknessMm: formData.get("thicknessMm"),
    pricePerM2Cents: formData.get("pricePerM2Cents") ?? "",
    active: formData.get("active"),
  });
  if (parsed.state) return parsed.state;

  try {
    await prisma.glassOption.create({
      data: { companyId: ctx.company.id, ...parsed.data },
    });
  } catch (e) {
    // Colisao do unique (companyId, glassType, thicknessMm).
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return fail("Ja existe um vidro com esse tipo e espessura.");
    }
    return fail("Nao foi possivel salvar o vidro.");
  }
  revalidatePath("/vidros");
  redirect("/vidros");
}

export async function deleteGlassOption(formData: FormData): Promise<void> {
  const { ctx } = await authorizeVidracaria();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.glassOption.deleteMany({ where: { id, companyId: ctx.company.id } });
  revalidatePath("/vidros");
}

// ---- Acabamentos (FinishOption) ----

export async function createFinishOption(_p: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorizeVidracaria();
  if (!ctx) return state;

  const parsed = parseOrFail(finishOptionSchema, {
    name: formData.get("name"),
    unit: formData.get("unit"),
    priceCents: formData.get("priceCents") ?? "",
    active: formData.get("active"),
  });
  if (parsed.state) return parsed.state;

  try {
    await prisma.finishOption.create({ data: { companyId: ctx.company.id, ...parsed.data } });
  } catch {
    return fail("Nao foi possivel salvar o acabamento.");
  }
  revalidatePath("/vidros");
  redirect("/vidros");
}

export async function deleteFinishOption(formData: FormData): Promise<void> {
  const { ctx } = await authorizeVidracaria();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.finishOption.deleteMany({ where: { id, companyId: ctx.company.id } });
  revalidatePath("/vidros");
}

// ---- Ferragens (HardwareOption) ----

export async function createHardwareOption(_p: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorizeVidracaria();
  if (!ctx) return state;

  const parsed = parseOrFail(hardwareOptionSchema, {
    name: formData.get("name"),
    priceCents: formData.get("priceCents") ?? "",
    active: formData.get("active"),
  });
  if (parsed.state) return parsed.state;

  try {
    await prisma.hardwareOption.create({ data: { companyId: ctx.company.id, ...parsed.data } });
  } catch {
    return fail("Nao foi possivel salvar a ferragem.");
  }
  revalidatePath("/vidros");
  redirect("/vidros");
}

export async function deleteHardwareOption(formData: FormData): Promise<void> {
  const { ctx } = await authorizeVidracaria();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.hardwareOption.deleteMany({ where: { id, companyId: ctx.company.id } });
  revalidatePath("/vidros");
}
