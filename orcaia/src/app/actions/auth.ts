"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/core/db";
import { hashPassword, verifyPassword } from "@/lib/core/password";
import { createSession, destroySession } from "@/lib/core/session";
import { uniqueCompanySlug } from "@/lib/core/slug";
import { registerSchema, loginSchema } from "@/lib/validation/auth";

// Estado retornado das actions para os formularios (padrao useActionState).
export type FormState = { error?: string } | undefined;

/**
 * Cadastro: cria o usuario, a empresa (com o nicho escolhido), o Membership de
 * owner e uma tabela de precos padrao — tudo em uma transacao. Em seguida abre
 * a sessao ja apontando para a empresa recem-criada.
 */
export async function registerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    companyName: formData.get("companyName"),
    niche: formData.get("niche"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const { name, email, password, companyName, niche } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Ja existe uma conta com este e-mail." };
  }

  const passwordHash = await hashPassword(password);
  const slug = await uniqueCompanySlug(companyName);

  const { user, company } = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: companyName,
        slug,
        niche,
        priceTables: {
          create: { name: "Tabela padrao", isDefault: true },
        },
      },
    });

    const user = await tx.user.create({
      data: {
        name,
        email,
        passwordHash,
        memberships: { create: { companyId: company.id, role: "owner" } },
      },
    });

    return { user, company };
  });

  await createSession({ userId: user.id, companyId: company.id });
  redirect("/dashboard");
}

/** Login: valida credenciais e abre a sessao na primeira empresa do usuario. */
export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados invalidos." };
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      passwordHash: true,
      memberships: { select: { companyId: true }, orderBy: { createdAt: "asc" } },
    },
  });

  // Mensagem generica de proposito: nao revela se o e-mail existe.
  const genericError = { error: "E-mail ou senha invalidos." };
  if (!user) return genericError;

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return genericError;

  const companyId = user.memberships[0]?.companyId;
  if (!companyId) {
    return { error: "Sua conta ainda nao esta vinculada a uma empresa." };
  }

  await createSession({ userId: user.id, companyId });
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
