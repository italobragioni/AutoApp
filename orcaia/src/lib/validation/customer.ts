import { z } from "zod";
import { optionalText, optionalEmail } from "./common";

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do cliente."),
  document: optionalText, // CPF ou CNPJ
  phone: optionalText,
  whatsapp: optionalText,
  email: optionalEmail,
  address: optionalText,
  notes: optionalText,
});

export type CustomerInput = z.infer<typeof customerSchema>;
