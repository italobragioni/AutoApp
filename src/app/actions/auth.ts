"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSessionCookie, destroySessionCookie, readSession } from "@/lib/session";
import { seedDemoDataForCompany } from "@/lib/demo-data";
import { slugify } from "@/lib/slug";

export type FormState = { error?: string } | undefined;


const loginSchema = z.object({
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe sua senha."),
});

export async function loginAction(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    include: { memberships: { orderBy: { createdAt: "asc" }, take: 1 } },
  });

  // Mensagem generica: nao revela se o e-mail existe.
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "E-mail ou senha incorretos." };
  }

  const membership = user.memberships[0];
  if (!membership) {
    return { error: "Sua conta não está vinculada a nenhuma empresa." };
  }

  await createSessionCookie({ userId: user.id, companyId: membership.companyId });
  redirect("/dashboard");
}

const registerSchema = z.object({
  name: z.string().min(2, "Informe seu nome."),
  companyName: z.string().min(2, "Informe o nome da sua empresa."),
  email: z.string().email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres."),
});

export async function registerAction(_state: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    companyName: String(formData.get("companyName") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return { error: "Já existe uma conta com esse e-mail." };
  }

  const withDemo = String(formData.get("demo") ?? "") === "on";

  // Garante slug unico para a nova empresa.
  const base = slugify(parsed.data.companyName) || "empresa";
  let slug = base;
  let attempt = 1;
  while (await db.company.findUnique({ where: { slug } })) {
    slug = `${base}-${++attempt}`;
  }

  const user = await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      memberships: {
        create: {
          role: "owner",
          company: { create: { name: parsed.data.companyName, slug } },
        },
      },
    },
    include: { memberships: true },
  });

  const companyId = user.memberships[0].companyId;
  if (withDemo) {
    await seedDemoDataForCompany(companyId);
  }

  await createSessionCookie({ userId: user.id, companyId });
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySessionCookie();
  redirect("/login");
}

/** Troca a empresa ativa — so permite empresas das quais o usuario e membro. */
export async function switchCompanyAction(formData: FormData) {
  const session = await readSession();
  if (!session) redirect("/login");

  const companyId = String(formData.get("companyId") ?? "");
  const membership = await db.membership.findUnique({
    where: { userId_companyId: { userId: session.userId, companyId } },
  });
  if (!membership) redirect("/dashboard");

  await createSessionCookie({ userId: session.userId, companyId });
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
