"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/core/db";
import { getCurrentContext } from "@/lib/core/tenant";
import { createSession } from "@/lib/core/session";

/**
 * Troca a empresa ativa da sessao. So permite trocar para uma empresa em que o
 * usuario realmente e membro — a checagem e no banco, nunca confiando no id
 * enviado pelo formulario.
 */
export async function switchCompanyAction(formData: FormData): Promise<void> {
  const ctx = await getCurrentContext();
  if (!ctx) redirect("/login");

  const target = String(formData.get("companyId") ?? "");

  const membership = await prisma.membership.findUnique({
    where: { userId_companyId: { userId: ctx.user.id, companyId: target } },
    select: { companyId: true },
  });

  if (!membership) {
    // Empresa nao pertence ao usuario: ignora e volta.
    redirect("/dashboard");
  }

  await createSession({ userId: ctx.user.id, companyId: membership.companyId });
  redirect("/dashboard");
}
