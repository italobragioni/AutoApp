import { z } from "zod";
import { moneyCents, moneyCentsOptional, percentBps, optionalText, checkbox } from "./common";
import { isAreaMode } from "@/lib/niches/marcenaria/options";

// ---- Catalogo ----

export const woodMaterialSchema = z.object({
  name: z.string().trim().min(1, "Informe o material."),
  thicknessMm: z.coerce.number({ invalid_type_error: "Espessura invalida." }).int().positive("Espessura invalida."),
  pricePerM2Cents: moneyCents,
  active: checkbox,
});
export type WoodMaterialInput = z.infer<typeof woodMaterialSchema>;

export const woodFinishSchema = z.object({
  name: z.string().trim().min(1, "Informe o acabamento."),
  pricePerM2Cents: moneyCents,
  active: checkbox,
});
export type WoodFinishInput = z.infer<typeof woodFinishSchema>;

export const woodHardwareSchema = z.object({
  name: z.string().trim().min(1, "Informe a ferragem."),
  priceCents: moneyCents,
  active: checkbox,
});
export type WoodHardwareInput = z.infer<typeof woodHardwareSchema>;

// Modelo de produto. As ferragens sao lidas a parte (campos hw_<id>).
export const woodTemplateSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do modelo."),
  category: optionalText,
  areaMode: z.string().refine(isAreaMode, "Selecione o modo de área."),
  materialId: optionalText,
  finishId: optionalText,
  laborPerM2Cents: moneyCentsOptional,
  assemblyPerM2Cents: moneyCentsOptional,
  marginBps: percentBps,
  defaultWidthMm: z.coerce.number().int().min(0).default(0),
  defaultHeightMm: z.coerce.number().int().min(0).default(0),
  defaultDepthMm: z.coerce.number().int().min(0).default(0),
  active: checkbox,
});
export type WoodTemplateInput = z.infer<typeof woodTemplateSchema>;

// ---- Orcamento ----

export const woodQuoteHeaderSchema = z.object({
  customerId: z.string().trim().min(1, "Selecione um cliente."),
  validUntil: optionalText,
  marginBps: percentBps,
  installationCents: moneyCentsOptional,
  travelCents: moneyCentsOptional,
  otherCents: moneyCentsOptional,
  discountCents: moneyCentsOptional,
  deliveryTime: optionalText,
  paymentTerms: optionalText,
  notes: optionalText,
});
export type WoodQuoteHeaderInput = z.infer<typeof woodQuoteHeaderSchema>;

export const woodQuoteItemSchema = z.object({
  description: z.string().trim().min(1, "Informe a descrição."),
  templateId: z.string().trim().min(1, "Selecione um modelo."),
  materialId: optionalText, // override opcional
  finishId: optionalText, // override opcional
  quantity: z.coerce.number({ invalid_type_error: "Quantidade invalida." }).int().positive("Quantidade invalida."),
});
export type WoodQuoteItemInput = z.infer<typeof woodQuoteItemSchema>;
