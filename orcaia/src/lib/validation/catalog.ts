import { z } from "zod";
import { optionalText, moneyCents, moneyCentsOptional, unit, checkbox } from "./common";

// Produto / servico do catalogo.
export const productSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do produto/servico."),
  description: optionalText,
  category: optionalText,
  unit,
  basePriceCents: moneyCentsOptional, // preco base opcional
  active: checkbox,
});
export type ProductInput = z.infer<typeof productSchema>;

// Material / insumo.
export const materialSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do material."),
  unit,
  costCents: moneyCents, // custo por unidade
  supplier: optionalText,
  active: checkbox,
});
export type MaterialInput = z.infer<typeof materialSchema>;

// Mao de obra.
export const laborSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da mao de obra."),
  unit,
  rateCents: moneyCents,
  active: checkbox,
});
export type LaborInput = z.infer<typeof laborSchema>;

// Custo adicional (deslocamento, outros...). Fixo (R$) ou percentual.
export const additionalCostSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome do custo."),
    kind: z.enum(["fixo", "percentual"], {
      errorMap: () => ({ message: "Tipo invalido." }),
    }),
    // Campo unico de entrada; interpretado conforme `kind` na action.
    value: z.string().trim().min(1, "Informe o valor."),
    active: checkbox,
  });
export type AdditionalCostInput = z.infer<typeof additionalCostSchema>;
