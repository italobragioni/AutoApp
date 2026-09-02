"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { permit } from "@/lib/authorize";
import { db } from "@/lib/db";
import { CONTACT_CHANNELS, CONTACT_OUTCOMES } from "@/lib/contacts";

/**
 * Registro de contato de retencao.
 *
 * E uma acao explicita do usuario: abrir o WhatsApp nao registra nada. Sem
 * essa confirmacao manual, um clique sem mensagem enviada tiraria o cliente da
 * fila por uma semana.
 *
 * O registro nao altera o estagio de retencao do cliente — quem calcula
 * estagio continua sendo src/lib/retention.ts, com o historico real de OS
 * concluidas. Aqui so entra a informacao "ja falei com ele em tal dia", que a
 * fila usa como cooldown.
 *
 * Isolamento: companyId e userId vem da sessao, nunca do formulario, e o
 * customerId enviado pelo cliente e validado contra a empresa antes de gravar.
 */

export type ContactState = { ok?: boolean; error?: string } | undefined;

const CHANNELS = CONTACT_CHANNELS as [string, ...string[]];
const OUTCOMES = CONTACT_OUTCOMES as [string, ...string[]];

const contactSchema = z.object({
  customerId: z.string().min(1, "Cliente não informado."),
  channel: z.enum(CHANNELS, { message: "Tipo de contato inválido." }),
  outcome: z.enum(OUTCOMES, { message: "Status de contato inválido." }),
  // "YYYY-MM-DDTHH:MM", o formato do input datetime-local.
  contactedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Informe a data e a hora do contato."),
  notes: z.string().max(1000, "Observação muito longa."),
});

export async function registerContactAction(
  _state: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const gate = await permit("retention.contact");
  if (!gate.ok) return { error: gate.error };
  const { company, user } = gate;

  const parsed = contactSchema.safeParse({
    customerId: String(formData.get("customerId") ?? "").trim(),
    channel: String(formData.get("channel") ?? "").trim(),
    outcome: String(formData.get("outcome") ?? "").trim(),
    contactedAt: String(formData.get("contactedAt") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const contactedAt = new Date(parsed.data.contactedAt);
  if (Number.isNaN(contactedAt.getTime())) {
    return { error: "Data do contato inválida." };
  }
  // Contato no futuro adiantaria o cooldown sem que a conversa tenha existido.
  if (contactedAt.getTime() > Date.now() + 60 * 1000) {
    return { error: "A data do contato não pode estar no futuro." };
  }

  // O id vem do formulario: so vale se o cliente for MESMO desta empresa.
  const customer = await db.customer.findFirst({
    where: { id: parsed.data.customerId, companyId: company.id },
    select: { id: true },
  });
  if (!customer) {
    return { error: "Cliente não encontrado nesta empresa." };
  }

  await db.contactLog.create({
    data: {
      companyId: company.id,
      customerId: customer.id,
      userId: user.id,
      channel: parsed.data.channel,
      outcome: parsed.data.outcome,
      contactedAt,
      notes: parsed.data.notes || null,
    },
  });

  revalidatePath("/retencao");
  revalidatePath("/dashboard");
  revalidatePath(`/clientes/${customer.id}`);

  return { ok: true };
}
