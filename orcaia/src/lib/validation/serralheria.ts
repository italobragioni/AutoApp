import { z } from "zod";
import { moneyCents, moneyCentsOptional, percentBps, optionalText, checkbox } from "./common";
import { isMaterialUnit, isBaseUnit, isServiceType } from "@/lib/niches/serralheria/options";

// ---- Catalogo ----

export const steelMaterialSchema = z.object({
  name: z.string().trim().min(1, "Informe o material."),
  unit: z.string().refine(isMaterialUnit, "Unidade invalida."),
  pricePerUnitCents: moneyCents,
  active: checkbox,
});
export type SteelMaterialInput = z.infer<typeof steelMaterialSchema>;

export const steelProductSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do produto/serviço."),
  serviceType: z.string().refine(isServiceType, "Selecione um tipo de serviço."),
  baseUnit: z.string().refine(isBaseUnit, "Selecione a unidade base."),
  materialName: optionalText,
  materialCostPerBaseCents: moneyCentsOptional,
  laborCostPerBaseCents: moneyCentsOptional,
  paintCostPerBaseCents: moneyCentsOptional,
  weightPerBaseKg: z.coerce
    .number({ invalid_type_error: "Peso invalido." })
    .min(0, "Peso invalido.")
    .default(0),
  marginBps: percentBps,
  active: checkbox,
});
export type SteelProductInput = z.infer<typeof steelProductSchema>;

// ---- Orcamento ----

export const steelQuoteHeaderSchema = z.object({
  customerId: z.string().trim().min(1, "Selecione um cliente."),
  validUntil: optionalText,
  marginBps: percentBps,
  installationCents: moneyCentsOptional,
  travelCents: moneyCentsOptional,
  otherCents: moneyCentsOptional,
  deliveryTime: optionalText,
  paymentTerms: optionalText,
  notes: optionalText,
});
export type SteelQuoteHeaderInput = z.infer<typeof steelQuoteHeaderSchema>;

export const steelQuoteItemSchema = z.object({
  description: z.string().trim().min(1, "Informe a descrição."),
  productId: z.string().trim().min(1, "Selecione o produto/serviço."),
  quantity: z.coerce
    .number({ invalid_type_error: "Quantidade invalida." })
    .int()
    .positive("Quantidade invalida."),
});
export type SteelQuoteItemInput = z.infer<typeof steelQuoteItemSchema>;
