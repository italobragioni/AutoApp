import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { readSession, destroySession } from "./session";
import type { Role } from "./permissions";
import { isRole } from "./permissions";

// Contexto do request autenticado. Toda a area logada obtem daqui o usuario, a
// empresa ativa e o papel — e TODA query de negocio deve ser escopada pelo
// `company.id` retornado.

export type TenantContext = {
  user: { id: string; name: string; email: string; avatarColor: string };
  company: { id: string; name: string; slug: string; niche: string };
  role: Role;
  // Todas as empresas em que o usuario e membro (para o seletor de empresa).
  memberships: { companyId: string; companyName: string; role: Role }[];
};

/**
 * Resolve o contexto do usuario logado a partir do cookie de sessao.
 *
 * Revalida no banco a cada request:
 *  - o usuario ainda existe;
 *  - a sessao nao foi cortada (sessionsValidFrom);
 *  - o usuario ainda e membro da empresa ativa.
 *
 * Um cookie antigo nunca continua dando acesso a dados de outra empresa.
 * Retorna null quando nao ha contexto valido (deixa o chamador decidir o que
 * fazer). Prefira `requireContext()` nas paginas protegidas.
 */
export async function getCurrentContext(): Promise<TenantContext | null> {
  const session = await readSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatarColor: true,
      sessionsValidFrom: true,
      memberships: {
        select: {
          companyId: true,
          role: true,
          company: { select: { id: true, name: true, slug: true, niche: true } },
        },
      },
    },
  });

  if (!user) return null;

  // Sessao cortada: o token foi emitido antes do ultimo corte (troca de senha).
  // Comparacao em segundos porque o `iat` do JWT tem granularidade de segundos —
  // assim a sessao reemitida no mesmo segundo do corte continua valida.
  if (session.iat) {
    const validFromSec = Math.floor(user.sessionsValidFrom.getTime() / 1000);
    if (session.iat < validFromSec) return null;
  }

  const active = user.memberships.find((m) => m.companyId === session.companyId);
  if (!active) return null;

  const role: Role = isRole(active.role) ? active.role : "staff";

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarColor: user.avatarColor,
    },
    company: {
      id: active.company.id,
      name: active.company.name,
      slug: active.company.slug,
      niche: active.company.niche,
    },
    role,
    memberships: user.memberships.map((m) => ({
      companyId: m.companyId,
      companyName: m.company.name,
      role: isRole(m.role) ? m.role : "staff",
    })),
  };
}

/**
 * Igual a `getCurrentContext`, mas redireciona para /login quando nao ha
 * contexto valido. Limpa um cookie invalido no caminho. Use nas paginas e
 * actions da area logada.
 */
export async function requireContext(): Promise<TenantContext> {
  const ctx = await getCurrentContext();
  if (!ctx) {
    await destroySession();
    redirect("/login");
  }
  return ctx;
}
