"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { permit } from "@/lib/authorize";
import { db } from "@/lib/db";

/**
 * Escrita do modulo Veiculos.
 *
 * Alem das duas regras de isolamento que valem em todo o projeto — companyId
 * sempre vindo da sessao e confirmacao de posse antes de escrever — aqui existe
 * um terceiro ponto de atencao:
 *
 *   O formulario envia um customerId. Esse id PRECISA ser validado contra a
 *   empresa da sessao antes de gravar. Sem isso, alguem poderia vincular um
 *   veiculo a um cliente de outra empresa, criando um registro que atravessa
 *   tenants pela relacao.
 */

export type VehicleState = { ok?: boolean; error?: string; id?: string } | undefined;

/** Portes aceitos — espelha o comentario do schema e o VEHICLE_SIZE da UI. */
const SIZES = ["pequeno", "medio", "grande", "suv"] as const;

const currentYear = new Date().getFullYear();

const vehicleSchema = z.object({
  customerId: z.string().min(1, "Selecione o cliente dono do veículo."),
  brand: z.string().min(1, "Informe a marca.").max(60, "Marca muito longa."),
  model: z.string().min(1, "Informe o modelo.").max(60, "Modelo muito longo."),
  year: z
    .string()
    .refine((v) => v === "" || /^\d{4}$/.test(v), { message: "Ano inválido." })
    .refine(
      (v) => v === "" || (Number(v) >= 1900 && Number(v) <= currentYear + 1),
      { message: `Ano deve estar entre 1900 e ${currentYear + 1}.` },
    ),
  plate: z
    .string()
    .max(10, "Placa inválida.")
    // Aceita o padrao antigo (ABC1234) e o Mercosul (ABC1D23).
    .refine((v) => v === "" || /^[A-Z]{3}[0-9][0-9A-Z][0-9]{2}$/.test(v.toUpperCase().replace(/[^A-Z0-9]/g, "")), {
      message: "Placa inválida. Use o formato ABC1234 ou ABC1D23.",
    }),
  color: z.string().max(30, "Cor muito longa."),
  size: z.enum(SIZES, { message: "Porte inválido." }),
  mileage: z
    .string()
    .refine((v) => v === "" || /^\d{1,7}$/.test(v.replace(/\D/g, "")), {
      message: "Quilometragem inválida.",
    }),
  notes: z.string().max(2000, "Observações muito longas."),
});

function readForm(formData: FormData) {
  return {
    customerId: String(formData.get("customerId") ?? "").trim(),
    brand: String(formData.get("brand") ?? "").trim(),
    model: String(formData.get("model") ?? "").trim(),
    year: String(formData.get("year") ?? "").trim(),
    plate: String(formData.get("plate") ?? "").trim(),
    color: String(formData.get("color") ?? "").trim(),
    size: String(formData.get("size") ?? "medio").trim(),
    mileage: String(formData.get("mileage") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  };
}

function toRecord(data: z.infer<typeof vehicleSchema>) {
  const plate = data.plate.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const mileage = data.mileage.replace(/\D/g, "");
  return {
    customerId: data.customerId,
    brand: data.brand,
    model: data.model,
    year: data.year ? Number(data.year) : null,
    plate: plate || null,
    color: data.color || null,
    size: data.size,
    mileage: mileage ? Number(mileage) : null,
    notes: data.notes || null,
  };
}

/**
 * Confirma que o cliente escolhido pertence a empresa da sessao.
 * Retorna o id validado ou null.
 */
async function assertCustomerBelongsToCompany(customerId: string, companyId: string) {
  const customer = await db.customer.findFirst({
    where: { id: customerId, companyId },
    select: { id: true },
  });
  return customer?.id ?? null;
}

function revalidateVehicle(vehicleId?: string, customerId?: string) {
  revalidatePath("/veiculos");
  if (vehicleId) revalidatePath(`/veiculos/${vehicleId}`);
  // O veiculo aparece na ficha do cliente e nas contagens do painel.
  if (customerId) revalidatePath(`/clientes/${customerId}`);
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
}

export async function createVehicleAction(
  _state: VehicleState,
  formData: FormData,
): Promise<VehicleState> {
  const gate = await permit("vehicles.write");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;

  const parsed = vehicleSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  // O cliente informado precisa ser desta empresa.
  const customerId = await assertCustomerBelongsToCompany(parsed.data.customerId, company.id);
  if (!customerId) {
    return { error: "Cliente não encontrado nesta empresa." };
  }

  const vehicle = await db.vehicle.create({
    // companyId da sessao; customerId ja validado acima.
    data: { companyId: company.id, ...toRecord(parsed.data), customerId },
    select: { id: true, customerId: true },
  });

  revalidateVehicle(vehicle.id, vehicle.customerId);
  return { ok: true, id: vehicle.id };
}

export async function updateVehicleAction(
  _state: VehicleState,
  formData: FormData,
): Promise<VehicleState> {
  const gate = await permit("vehicles.write");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Veículo não identificado." };

  // Posse do veiculo.
  const existing = await db.vehicle.findFirst({
    where: { id, companyId: company.id },
    select: { id: true, customerId: true },
  });
  if (!existing) return { error: "Veículo não encontrado nesta empresa." };

  const parsed = vehicleSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  // Posse do cliente — a edicao pode trocar o dono do veiculo.
  const customerId = await assertCustomerBelongsToCompany(parsed.data.customerId, company.id);
  if (!customerId) {
    return { error: "Cliente não encontrado nesta empresa." };
  }

  await db.vehicle.update({
    where: { id: existing.id },
    data: { ...toRecord(parsed.data), customerId },
  });

  // Se o dono mudou, as duas fichas precisam ser atualizadas.
  revalidateVehicle(existing.id, existing.customerId);
  if (customerId !== existing.customerId) revalidatePath(`/clientes/${customerId}`);

  return { ok: true, id: existing.id };
}

/**
 * Exclusao. Restrita a owner/manager, mesmo criterio ja usado em Clientes e
 * Configuracoes — vem do papel em Membership, nao de um sistema novo.
 *
 * O `onDelete: SetNull` das relacoes de Appointment, Quote e WorkOrder faz o
 * historico permanecer: as ordens de servico continuam existindo, apenas sem
 * veiculo vinculado. Isso preserva o faturamento nos relatorios.
 */
export async function deleteVehicleAction(
  _state: VehicleState,
  formData: FormData,
): Promise<VehicleState> {
  const gate = await permit("vehicles.delete");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Veículo não identificado." };

  const existing = await db.vehicle.findFirst({
    where: { id, companyId: company.id },
    select: { id: true, customerId: true },
  });
  if (!existing) return { error: "Veículo não encontrado nesta empresa." };

  await db.vehicle.delete({ where: { id: existing.id } });

  revalidateVehicle(undefined, existing.customerId);
  redirect("/veiculos?excluido=1");
}
