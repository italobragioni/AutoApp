import "server-only";
import { getCurrentContext, type TenantContext } from "./tenant";
import { atLeast, type Role } from "./permissions";
import type { z } from "zod";

// Contrato de estado dos formularios (padrao React useActionState).
// Uma unica forma para todas as Server Actions de escrita.
export type FormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export const OK: FormState = { ok: true };

/** Erro generico para o formulario. */
export function fail(error: string): FormState {
  return { ok: false, error };
}

/**
 * Resolve o contexto autenticado dentro de uma Server Action, opcionalmente
 * exigindo um papel minimo. Lanca um erro sentinela quando nao autorizado, para
 * ser convertido em FormState por `withAction`.
 */
export async function authorize(minRole?: Role): Promise<TenantContext> {
  const ctx = await getCurrentContext();
  if (!ctx) throw new ActionError("Sessao expirada. Entre novamente.");
  if (minRole && !atLeast(ctx.role, minRole)) {
    throw new ActionError("Voce nao tem permissao para esta acao.");
  }
  return ctx;
}

/** Erro de negocio ja com mensagem amigavel para o usuario. */
export class ActionError extends Error {}

/**
 * Versao de `authorize` que nunca lanca: retorna o contexto ou um FormState de
 * erro pronto para as Server Actions de formulario. Uso:
 *   const { ctx, state } = await authorizeState();
 *   if (!ctx) return state;
 */
export async function authorizeState(
  minRole?: Role,
): Promise<{ ctx: TenantContext | null; state: FormState }> {
  try {
    return { ctx: await authorize(minRole), state: OK };
  } catch (e) {
    return { ctx: null, state: fail(e instanceof ActionError ? e.message : "Nao autorizado.") };
  }
}

/**
 * Converte a saida do Zod safeParse em erros por campo, ou retorna os dados.
 */
export function parseOrFail<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown,
): { data: z.infer<S>; state?: undefined } | { data?: undefined; state: FormState } {
  const result = schema.safeParse(data);
  if (result.success) return { data: result.data };

  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return {
    state: {
      ok: false,
      error: "Verifique os campos destacados.",
      fieldErrors,
    },
  };
}
