"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { permit } from "@/lib/authorize";
import { db } from "@/lib/db";

export type SettingsState = { ok?: boolean; error?: string } | undefined;

const companySchema = z.object({
  name: z.string().min(2, "Informe o nome da empresa."),
  document: z.string().optional(),
  phone: z.string().optional(),
  email: z.union([z.string().email("E-mail inválido."), z.literal("")]).optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  address: z.string().optional(),
});

export async function updateCompanyAction(
  _state: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const gate = await permit("company.settings");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;

  const parsed = companySchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    document: String(formData.get("document") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    state: String(formData.get("state") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  // O where inclui o id da empresa ativa da sessão: nunca atualiza outro tenant.
  await db.company.update({
    where: { id: company.id },
    data: {
      name: parsed.data.name,
      document: parsed.data.document || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      city: parsed.data.city || null,
      state: parsed.data.state || null,
      address: parsed.data.address || null,
    },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}

const retentionSchema = z.object({
  retentionWindowDays: z
    .number()
    .int()
    .min(7, "O ciclo mínimo é de 7 dias.")
    .max(365, "O ciclo máximo é de 365 dias."),
  inactiveAfterDays: z
    .number()
    .int()
    .min(30, "O prazo mínimo de inatividade é de 30 dias.")
    .max(1095, "O prazo máximo é de 1095 dias."),
  // Configuracao central do cooldown de contato (src/lib/contacts.ts).
  contactCooldownDays: z
    .number()
    .int()
    .min(1, "O cooldown mínimo é de 1 dia.")
    .max(90, "O cooldown máximo é de 90 dias."),
  // Configuracao central da janela de atribuicao das campanhas
  // (src/lib/campaigns.ts).
  attributionWindowDays: z
    .number()
    .int()
    .min(1, "A janela mínima de atribuição é de 1 dia.")
    .max(180, "A janela máxima de atribuição é de 180 dias."),
});

export async function updateRetentionAction(
  _state: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const gate = await permit("company.settings");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;

  const parsed = retentionSchema.safeParse({
    retentionWindowDays: Number(formData.get("retentionWindowDays")),
    inactiveAfterDays: Number(formData.get("inactiveAfterDays")),
    contactCooldownDays: Number(formData.get("contactCooldownDays")),
    attributionWindowDays: Number(formData.get("attributionWindowDays")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Valores inválidos." };
  }

  if (parsed.data.inactiveAfterDays <= parsed.data.retentionWindowDays) {
    return { error: "O prazo de inatividade precisa ser maior que o ciclo de retorno." };
  }

  await db.company.update({
    where: { id: company.id },
    data: parsed.data,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
