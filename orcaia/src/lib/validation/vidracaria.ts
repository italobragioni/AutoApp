import { z } from "zod";
import { moneyCents, moneyCentsOptional, percentBps, optionalText, checkbox } from "./common";
import { isFinishUnit } from "@/lib/niches/vidracaria/options";

// ---- Catalogo ----

export const glassOptionSchema = z.object({
  glassType: z.string().trim().min(1, "Informe o tipo de vidro."),
  thicknessMm: z.coerce
    .number({ invalid_type_error: "Espessura invalida." })
    .int("Espessura invalida.")
    .positive("Espessura invalida."),
  pricePerM2Cents: moneyCents,
  active: checkbox,
});
export type GlassOptionInput = z.infer<typeof glassOptionSchema>;

export const finishOptionSchema = z.object({
  name: z.string().trim().min(1, "Informe o acabamento."),
  unit: z.string().refine(isFinishUnit, "Unidade invalida."),
  priceCents: moneyCents,
  active: checkbox,
});
export type FinishOptionInput = z.infer<typeof finishOptionSchema>;

export const hardwareOptionSchema = z.object({
  name: z.string().trim().min(1, "Informe a ferragem."),
  priceCents: moneyCents,
  active: checkbox,
});
export type HardwareOptionInput = z.infer<typeof hardwareOptionSchema>;

// ---- Orcamento ----

export const quoteHeaderSchema = z.object({
  customerId: z.string().trim().min(1, "Selecione um cliente."),
  validUntil: optionalText, // "YYYY-MM-DD" ou vazio
  marginBps: percentBps,
  installationCents: moneyCentsOptional,
  travelCents: moneyCentsOptional,
  otherCents: moneyCentsOptional,
  discountCents: moneyCentsOptional,
  deliveryTime: optionalText,
  paymentTerms: optionalText,
  notes: optionalText,
});
export type QuoteHeaderInput = z.infer<typeof quoteHeaderSchema>;

export const quoteItemSchema = z.object({
  description: z.string().trim().min(1, "Informe o produto/descricao."),
  widthMm: z.coerce.number({ invalid_type_error: "Largura invalida." }).positive("Largura invalida."),
  heightMm: z.coerce.number({ invalid_type_error: "Altura invalida." }).positive("Altura invalida."),
  quantity: z.coerce.number({ invalid_type_error: "Quantidade invalida." }).int().positive("Quantidade invalida."),
  glassOptionId: z.string().trim().min(1, "Selecione o vidro."),
  finishOptionId: optionalText,
});
export type QuoteItemInput = z.infer<typeof quoteItemSchema>;
