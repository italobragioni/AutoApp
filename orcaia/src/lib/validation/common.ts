import { z } from "zod";
import { parseMoneyToCents, parsePercentToBps } from "@/lib/core/money";
import { isUnit } from "@/lib/niches";

// Blocos reutilizaveis de validacao. Uma unica fonte de verdade para as regras
// de entrada, compartilhada pelas Server Actions.
//
// Usamos `transform` (e nao `preprocess`) para conversao de valores porque ele
// preserva corretamente o tipo de SAIDA (number/boolean) na inferencia do Zod.

// Texto opcional: string vazia vira `null` (e nao `undefined`). Isso importa no
// UPDATE: o Prisma ignora campos `undefined` ("nao alterar"), entao usar `null`
// e o que permite LIMPAR um campo ao editar (ex.: apagar o telefone).
export const optionalText = z
  .string()
  .trim()
  .transform((v): string | null => (v === "" ? null : v));

/** E-mail opcional (aceita vazio). Mesma logica de `null` do optionalText. */
export const optionalEmail = z
  .string()
  .trim()
  .transform((v): string | null => (v === "" ? null : v))
  .refine(
    (v) => v === null || z.string().email().safeParse(v).success,
    "E-mail invalido.",
  );

/** Valor monetario (texto em reais) convertido para centavos inteiros. */
export const moneyCents = z.any().transform((v, ctx): number => {
  const cents = parseMoneyToCents(v);
  if (cents === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Valor invalido." });
    return z.NEVER;
  }
  return cents;
});

/** Valor monetario opcional; vazio vira 0. */
export const moneyCentsOptional = z.any().transform((v, ctx): number => {
  if (v === "" || v === null || v === undefined) return 0;
  const cents = parseMoneyToCents(v);
  if (cents === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Valor invalido." });
    return z.NEVER;
  }
  return cents;
});

/** Percentual (texto) convertido para pontos-base. */
export const percentBps = z.any().transform((v, ctx): number => {
  const bps = parsePercentToBps(v);
  if (bps === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Percentual invalido." });
    return z.NEVER;
  }
  if (bps > 1000000) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Percentual muito alto." });
    return z.NEVER;
  }
  return bps;
});

/** Unidade valida (m2, ml, un, ...). */
export const unit = z.string().refine(isUnit, "Selecione uma unidade valida.");

/** Checkbox do formulario ("on" | ausente) para boolean. */
export const checkbox = z
  .any()
  .transform((v): boolean => v === "on" || v === "true" || v === true);
