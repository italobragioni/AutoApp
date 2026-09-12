import { z } from "zod";
import { optionalText, moneyCentsOptional, percentBps } from "./common";
import { isNiche } from "@/lib/niches";

// Dados cadastrais da empresa.
export const companyProfileSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da empresa."),
  document: optionalText,
  phone: optionalText,
  email: optionalText,
  city: optionalText,
  state: optionalText,
  address: optionalText,
});
export type CompanyProfileInput = z.infer<typeof companyProfileSchema>;

// Politicas de preco padrao (margem + mao de obra padrao).
export const pricingDefaultsSchema = z.object({
  defaultMarginBps: percentBps,
  defaultLaborRateCents: moneyCentsOptional,
});
export type PricingDefaultsInput = z.infer<typeof pricingDefaultsSchema>;

// Criacao de uma nova empresa (multiempresa).
export const newCompanySchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da empresa."),
  niche: z.string().refine(isNiche, "Selecione um nicho valido."),
});
export type NewCompanyInput = z.infer<typeof newCompanySchema>;

// Perfil do usuario.
export const profileSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome."),
});
export type ProfileInput = z.infer<typeof profileSchema>;

// Troca de senha.
export const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual."),
  newPassword: z.string().min(8, "A nova senha deve ter ao menos 8 caracteres."),
});
export type PasswordInput = z.infer<typeof passwordSchema>;
