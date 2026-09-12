import { z } from "zod";
import { isNiche } from "@/lib/niches";

// Schemas Zod compartilhados entre as Server Actions e (futuramente) a API.
// Uma unica fonte de verdade para as regras de entrada.

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome."),
  email: z.string().trim().toLowerCase().email("E-mail invalido."),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres."),
  companyName: z.string().trim().min(2, "Informe o nome da empresa."),
  niche: z
    .string()
    .refine(isNiche, "Selecione um nicho valido."),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail invalido."),
  password: z.string().min(1, "Informe a senha."),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
