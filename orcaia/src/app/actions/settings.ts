"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/core/db";
import { authorizeState, parseOrFail, fail, OK, type FormState } from "@/lib/core/actions";
import { hashPassword, verifyPassword } from "@/lib/core/password";
import { createSession } from "@/lib/core/session";
import { uniqueCompanySlug } from "@/lib/core/slug";
import {
  companyProfileSchema,
  pricingDefaultsSchema,
  newCompanySchema,
  profileSchema,
  passwordSchema,
} from "@/lib/validation/settings";

// Editar dados da empresa e politicas de preco exige papel de gerente ou dono.

export async function updateCompanyProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorizeState("manager");
  if (!ctx) return state;

  const parsed = parseOrFail(companyProfileSchema, {
    name: formData.get("name"),
    document: formData.get("document") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    city: formData.get("city") ?? "",
    state: formData.get("state") ?? "",
    address: formData.get("address") ?? "",
  });
  if (parsed.state) return parsed.state;

  try {
    await prisma.company.update({
      where: { id: ctx.company.id },
      data: parsed.data,
    });
  } catch {
    return fail("Nao foi possivel salvar os dados da empresa.");
  }
  revalidatePath("/configuracoes");
  return OK;
}

export async function updatePricingDefaults(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorizeState("manager");
  if (!ctx) return state;

  const parsed = parseOrFail(pricingDefaultsSchema, {
    defaultMarginBps: formData.get("defaultMarginBps"),
    defaultLaborRateCents: formData.get("defaultLaborRateCents") ?? "",
  });
  if (parsed.state) return parsed.state;

  try {
    await prisma.company.update({
      where: { id: ctx.company.id },
      data: parsed.data,
    });
  } catch {
    return fail("Nao foi possivel salvar as politicas de preco.");
  }
  revalidatePath("/configuracoes");
  return OK;
}

// Multiempresa: qualquer usuario autenticado pode criar uma nova empresa e
// passa a ser dono dela. A sessao ja aponta para a empresa recem-criada.
export async function createCompany(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorizeState();
  if (!ctx) return state;

  const parsed = parseOrFail(newCompanySchema, {
    name: formData.get("name"),
    niche: formData.get("niche"),
  });
  if (parsed.state) return parsed.state;

  let companyId: string;
  try {
    const slug = await uniqueCompanySlug(parsed.data.name);
    const company = await prisma.company.create({
      data: {
        name: parsed.data.name,
        slug,
        niche: parsed.data.niche,
        memberships: { create: { userId: ctx.user.id, role: "owner" } },
        priceTables: { create: { name: "Tabela padrao", isDefault: true } },
      },
    });
    companyId = company.id;
  } catch {
    return fail("Nao foi possivel criar a empresa.");
  }

  await createSession({ userId: ctx.user.id, companyId });
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorizeState();
  if (!ctx) return state;

  const parsed = parseOrFail(profileSchema, { name: formData.get("name") });
  if (parsed.state) return parsed.state;

  try {
    await prisma.user.update({ where: { id: ctx.user.id }, data: parsed.data });
  } catch {
    return fail("Nao foi possivel salvar o perfil.");
  }
  revalidatePath("/configuracoes");
  return OK;
}

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx, state } = await authorizeState();
  if (!ctx) return state;

  const parsed = parseOrFail(passwordSchema, {
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (parsed.state) return parsed.state;

  const user = await prisma.user.findUnique({
    where: { id: ctx.user.id },
    select: { passwordHash: true },
  });
  if (!user) return fail("Usuario nao encontrado.");

  const ok = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!ok) {
    return { ok: false, error: "Verifique os campos destacados.", fieldErrors: { currentPassword: "Senha atual incorreta." } };
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);

  // Trocar a senha corta as sessoes antigas (sessionsValidFrom = agora) e
  // reemite a sessao atual para o usuario continuar logado neste dispositivo.
  const now = new Date();
  try {
    await prisma.user.update({
      where: { id: ctx.user.id },
      data: { passwordHash, sessionsValidFrom: now },
    });
  } catch {
    return fail("Nao foi possivel alterar a senha.");
  }

  await createSession({ userId: ctx.user.id, companyId: ctx.company.id });
  return OK;
}
