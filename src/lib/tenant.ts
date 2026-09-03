import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/lib/db";
import { readSession } from "@/lib/session";

export type CurrentContext = {
  user: {
    id: string;
    name: string;
    email: string;
    avatarColor: string;
    /** Nulo enquanto o e-mail nao for confirmado. Nao bloqueia o uso. */
    emailVerifiedAt: Date | null;
  };
  company: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    city: string | null;
    state: string | null;
    phone: string | null;
    email: string | null;
    document: string | null;
    address: string | null;
    retentionWindowDays: number;
    inactiveAfterDays: number;
    contactCooldownDays: number;
    attributionWindowDays: number;
    onboardingDismissedAt: Date | null;
  };
  role: string;
  /** Todas as empresas as quais o usuario tem acesso (troca de empresa). */
  companies: { id: string; name: string; slug: string; role: string }[];
};

/**
 * Resolve o usuario logado e a empresa ativa.
 *
 * Retorna null quando nao ha sessao valida OU quando a sessao aponta para uma
 * empresa da qual o usuario nao e mais membro — o que impede que um cookie
 * antigo continue dando acesso a dados de outro tenant.
 */
export const getCurrentContext = cache(async (): Promise<CurrentContext | null> => {
  const session = await readSession();
  if (!session) return null;

  const membership = await db.membership.findUnique({
    where: { userId_companyId: { userId: session.userId, companyId: session.companyId } },
    include: { user: true, company: true },
  });
  if (!membership) return null;

  // Corte de sessao: trocar a senha empurra `sessionsValidFrom` para agora, e
  // todo cookie assinado antes disso para de valer aqui.
  //
  // A comparacao usa segundos porque o `iat` do JWT so tem essa precisao —
  // arredondar para baixo evita que a sessao criada no mesmo segundo do corte
  // seja recusada junto com as antigas.
  const cutoff = Math.floor(membership.user.sessionsValidFrom.getTime() / 1000);
  if (session.issuedAt !== undefined && session.issuedAt < cutoff) return null;

  const memberships = await db.membership.findMany({
    where: { userId: session.userId },
    include: { company: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "asc" },
  });

  const { user, company } = membership;

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarColor: user.avatarColor,
      emailVerifiedAt: user.emailVerifiedAt,
    },
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      plan: company.plan,
      city: company.city,
      state: company.state,
      phone: company.phone,
      email: company.email,
      document: company.document,
      address: company.address,
      retentionWindowDays: company.retentionWindowDays,
      inactiveAfterDays: company.inactiveAfterDays,
      contactCooldownDays: company.contactCooldownDays,
      attributionWindowDays: company.attributionWindowDays,
      onboardingDismissedAt: company.onboardingDismissedAt,
    },
    role: membership.role,
    companies: memberships.map((m) => ({
      id: m.company.id,
      name: m.company.name,
      slug: m.company.slug,
      role: m.role,
    })),
  };
});

/** Versao para paginas/actions protegidas: redireciona ao login se nao houver contexto. */
export async function requireContext(): Promise<CurrentContext> {
  const context = await getCurrentContext();
  if (!context) redirect("/login");
  return context;
}

/**
 * Atalho para o filtro de tenant usado em toda query:
 *   db.customer.findMany({ where: await scope() })
 */
export async function scope() {
  const { company } = await requireContext();
  return { companyId: company.id };
}
