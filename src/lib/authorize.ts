import "server-only";

import { redirect } from "next/navigation";

import { DENIED, can, type Permission } from "@/lib/permissions";
import { requireContext, type CurrentContext } from "@/lib/tenant";

/**
 * As travas de permissao que dependem da sessao.
 *
 * Regra do projeto: esconder o botao no navegador e conforto, nao seguranca. A
 * decisao real acontece aqui, no servidor, com o papel que veio do Membership
 * do banco — nunca com um papel enviado pelo formulario.
 */

export type Gate =
  | ({ ok: true; error?: undefined } & CurrentContext)
  | { ok: false; error: string };

/**
 * Trava para Server Actions.
 *
 *   const gate = await permit("customers.write");
 *   if (!gate.ok) return { error: gate.error };
 *   const { company } = gate;
 *
 * Devolve o contexto junto para a action nao precisar chamar requireContext()
 * de novo — o mesmo `cache()` serve os dois, mas assim fica explicito que a
 * empresa usada e a mesma que foi autorizada.
 */
export async function permit(permission: Permission): Promise<Gate> {
  const context = await requireContext();
  if (!can(context.role, permission)) return { ok: false, error: DENIED };
  return { ok: true, ...context };
}

/**
 * Trava para paginas. Sem permissao, o usuario volta para o Dashboard em vez de
 * ver uma tela vazia ou um erro.
 */
export async function requirePermission(
  permission: Permission,
  fallback = "/dashboard",
): Promise<CurrentContext> {
  const context = await requireContext();
  if (!can(context.role, permission)) redirect(fallback);
  return context;
}

/** Conveniencia para paginas que so precisam saber o que mostrar. */
export async function contextWith(permissions: Permission[]) {
  const context = await requireContext();
  const allowed = Object.fromEntries(
    permissions.map((permission) => [permission, can(context.role, permission)]),
  ) as Record<Permission, boolean>;
  return { context, allowed };
}
