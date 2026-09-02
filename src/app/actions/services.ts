"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { permit } from "@/lib/authorize";
import { db } from "@/lib/db";
import { parseMoneyToCents } from "@/lib/format";

/**
 * Escrita do modulo Servicos (catalogo).
 *
 * Sobre a recorrencia: este arquivo NAO calcula nada de retencao. Ele apenas
 * grava `recurrenceDays` no ServiceItem. O motor em src/lib/retention.ts le
 * esse campo ao vivo, pela relacao WorkOrderItem -> ServiceItem, entao editar
 * aqui muda o ciclo de retorno na hora seguinte, sem regra duplicada.
 *
 * Sobre desativar: nao existe exclusao. `active: false` tira o servico do uso
 * futuro, mas o historico continua intacto — cada WorkOrderItem guarda o nome
 * e o preco praticados na epoca (`description` e `unitPriceCents`), entao
 * ordens antigas nao mudam quando o catalogo muda.
 */

export type ServiceState = { ok?: boolean; error?: string; id?: string } | undefined;

const CATEGORIES = [
  "lavagem",
  "polimento",
  "protecao",
  "higienizacao",
  "estetica",
  "outro",
] as const;

const serviceSchema = z.object({
  name: z.string().min(2, "Informe o nome do serviço.").max(80, "Nome muito longo."),
  category: z.enum(CATEGORIES, { message: "Categoria inválida." }),
  description: z.string().max(500, "Descrição muito longa."),
  // Recebe o texto cru; a conversao para centavos acontece depois da validacao.
  price: z.string().refine((v) => v.replace(/\D/g, "").length > 0, {
    message: "Informe o preço.",
  }),
  durationMin: z
    .string()
    .refine((v) => /^\d{1,4}$/.test(v.replace(/\D/g, "")), {
      message: "Informe a duração em minutos.",
    })
    .refine((v) => Number(v.replace(/\D/g, "")) >= 5, {
      message: "A duração mínima é de 5 minutos.",
    }),
  // Vazio = sem recorrencia definida; o motor cai no padrao da empresa.
  recurrenceDays: z
    .string()
    .refine((v) => v === "" || /^\d{1,4}$/.test(v.replace(/\D/g, "")), {
      message: "Ciclo de retorno inválido.",
    })
    .refine((v) => v === "" || Number(v.replace(/\D/g, "")) >= 1, {
      message: "O ciclo de retorno precisa ser de pelo menos 1 dia.",
    }),
  active: z.boolean(),
});

function readForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    category: String(formData.get("category") ?? "lavagem").trim(),
    description: String(formData.get("description") ?? "").trim(),
    price: String(formData.get("price") ?? "").trim(),
    durationMin: String(formData.get("durationMin") ?? "").trim(),
    recurrenceDays: String(formData.get("recurrenceDays") ?? "").trim(),
    // Checkbox ausente no FormData significa desmarcado.
    active: formData.get("active") === "on",
  };
}

function toRecord(data: z.infer<typeof serviceSchema>) {
  const recurrence = data.recurrenceDays.replace(/\D/g, "");
  return {
    name: data.name,
    category: data.category,
    description: data.description || null,
    // Valores monetarios seguem o padrao do projeto: centavos, inteiros.
    basePrice: parseMoneyToCents(data.price),
    durationMin: Number(data.durationMin.replace(/\D/g, "")),
    recurrenceDays: recurrence ? Number(recurrence) : null,
    active: data.active,
  };
}

/**
 * O catalogo alimenta o motor de retencao e os relatorios, entao uma mudanca
 * aqui precisa refletir nessas telas tambem.
 */
function revalidateService() {
  revalidatePath("/servicos");
  revalidatePath("/retencao");
  revalidatePath("/dashboard");
  revalidatePath("/relatorios");
}

export async function createServiceAction(
  _state: ServiceState,
  formData: FormData,
): Promise<ServiceState> {
  const gate = await permit("services.write");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;

  const parsed = serviceSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const service = await db.serviceItem.create({
    // companyId vem da sessao, nunca do formulario.
    data: { companyId: company.id, ...toRecord(parsed.data) },
    select: { id: true },
  });

  revalidateService();
  return { ok: true, id: service.id };
}

export async function updateServiceAction(
  _state: ServiceState,
  formData: FormData,
): Promise<ServiceState> {
  const gate = await permit("services.write");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Serviço não identificado." };

  // Confirma a posse antes de escrever: id de outra empresa nao existe aqui.
  const existing = await db.serviceItem.findFirst({
    where: { id, companyId: company.id },
    select: { id: true },
  });
  if (!existing) return { error: "Serviço não encontrado nesta empresa." };

  const parsed = serviceSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  await db.serviceItem.update({
    where: { id: existing.id },
    data: toRecord(parsed.data),
  });

  revalidateService();
  return { ok: true, id: existing.id };
}

/**
 * Ativa ou desativa. Nao apaga nada: e so uma troca de status, para o servico
 * sair do uso futuro sem tirar nada do historico.
 */
export async function toggleServiceActiveAction(
  _state: ServiceState,
  formData: FormData,
): Promise<ServiceState> {
  const gate = await permit("services.write");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Serviço não identificado." };

  const existing = await db.serviceItem.findFirst({
    where: { id, companyId: company.id },
    select: { id: true, active: true },
  });
  if (!existing) return { error: "Serviço não encontrado nesta empresa." };

  await db.serviceItem.update({
    where: { id: existing.id },
    data: { active: !existing.active },
  });

  revalidateService();
  return { ok: true, id: existing.id };
}
