"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { permit } from "@/lib/authorize";
import { db } from "@/lib/db";

/**
 * Escrita do modulo Clientes.
 *
 * Duas regras valem para todas as acoes deste arquivo:
 *
 *   1. O companyId vem SEMPRE do contexto da sessao (requireContext), nunca do
 *      formulario. Assim nao ha como forjar um payload apontando para outra
 *      empresa.
 *   2. Toda operacao sobre um registro existente confirma antes que ele
 *      pertence a empresa ativa. Sem isso, um id valido de outro tenant seria
 *      editavel — o `where: { id }` do Prisma sozinho nao protege.
 */

export type CustomerState = { ok?: boolean; error?: string; id?: string } | undefined;

/** Origens aceitas — espelha o comentario do schema e o ORIGIN_LABEL da UI. */
const ORIGINS = ["indicacao", "instagram", "google", "passagem", "outro"] as const;

const customerSchema = z.object({
  name: z
    .string()
    .min(2, "Informe o nome do cliente.")
    .max(120, "O nome é muito longo."),
  phone: z
    .string()
    .max(20, "Telefone inválido.")
    .refine((value) => value === "" || value.replace(/\D/g, "").length >= 10, {
      message: "Telefone incompleto. Use DDD + número.",
    }),
  email: z.union([z.string().email("E-mail inválido."), z.literal("")]),
  birthDate: z
    .string()
    .refine((value) => value === "" || !Number.isNaN(Date.parse(value)), {
      message: "Data de nascimento inválida.",
    })
    .refine((value) => value === "" || new Date(value) <= new Date(), {
      message: "A data de nascimento não pode estar no futuro.",
    }),
  origin: z.enum(ORIGINS, { message: "Origem inválida." }),
  notes: z.string().max(2000, "Observações muito longas."),
});

function readForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    birthDate: String(formData.get("birthDate") ?? "").trim(),
    origin: String(formData.get("origin") ?? "indicacao").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

/** Campos vazios viram null no banco, em vez de string vazia. */
function toRecord(data: z.infer<typeof customerSchema>) {
  return {
    name: data.name,
    phone: data.phone || null,
    email: data.email || null,
    // A data chega como "YYYY-MM-DD"; fixamos meio-dia UTC para o fuso do
    // servidor nao empurrar o aniversario para o dia anterior.
    birthDate: data.birthDate ? new Date(`${data.birthDate}T12:00:00.000Z`) : null,
    origin: data.origin,
    notes: data.notes || null,
  };
}

/** Atualiza listagem e ficha depois de qualquer escrita. */
function revalidateCustomer(id?: string) {
  revalidatePath("/clientes");
  if (id) revalidatePath(`/clientes/${id}`);
  // O cliente novo muda contagens no painel e no motor de retencao.
  revalidatePath("/dashboard");
  revalidatePath("/retencao");
}

export async function createCustomerAction(
  _state: CustomerState,
  formData: FormData,
): Promise<CustomerState> {
  const gate = await permit("customers.write");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;

  const parsed = customerSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const customer = await db.customer.create({
    // companyId vem da sessao, jamais do formulario.
    data: { companyId: company.id, ...toRecord(parsed.data) },
    select: { id: true },
  });

  revalidateCustomer(customer.id);
  return { ok: true, id: customer.id };
}

export async function updateCustomerAction(
  _state: CustomerState,
  formData: FormData,
): Promise<CustomerState> {
  const gate = await permit("customers.write");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;
  const id = String(formData.get("id") ?? "");

  if (!id) return { error: "Cliente não identificado." };

  // Confirma a posse ANTES de escrever: um id de outra empresa nao existe aqui.
  const existing = await db.customer.findFirst({
    where: { id, companyId: company.id },
    select: { id: true },
  });
  if (!existing) return { error: "Cliente não encontrado nesta empresa." };

  const parsed = customerSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await db.customer.update({
    where: { id: existing.id },
    data: toRecord(parsed.data),
  });

  revalidateCustomer(existing.id);
  return { ok: true, id: existing.id };
}

/**
 * Exclusao. A permissao "customers.delete" e conferida no servidor por `permit`
 * (src/lib/authorize.ts), que le o papel do Membership — nunca do formulario.
 *
 * O `onDelete: Cascade` do schema leva junto veiculos, agendamentos, orcamentos
 * e ordens de servico do cliente. Por isso a interface avisa o que sera perdido
 * e exige confirmacao digitada.
 */
export async function deleteCustomerAction(
  _state: CustomerState,
  formData: FormData,
): Promise<CustomerState> {
  const gate = await permit("customers.delete");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Cliente não identificado." };

  const existing = await db.customer.findFirst({
    where: { id, companyId: company.id },
    select: { id: true },
  });
  if (!existing) return { error: "Cliente não encontrado nesta empresa." };

  await db.customer.delete({ where: { id: existing.id } });

  revalidateCustomer();
  redirect("/clientes?excluido=1");
}
