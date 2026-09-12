"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/core/db";
import { authorizeState, parseOrFail, fail, type FormState } from "@/lib/core/actions";
import { customerSchema } from "@/lib/validation/customer";

// Todas as operacoes sao escopadas por companyId. Em update/delete usamos
// `where: { id, companyId }` (via updateMany/deleteMany): um registro de outra
// empresa simplesmente nao e alcancado.

function readForm(formData: FormData) {
  return {
    name: formData.get("name"),
    document: formData.get("document") ?? "",
    phone: formData.get("phone") ?? "",
    whatsapp: formData.get("whatsapp") ?? "",
    email: formData.get("email") ?? "",
    address: formData.get("address") ?? "",
    notes: formData.get("notes") ?? "",
  };
}

export async function createCustomer(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx, state } = await authorizeState();
  if (!ctx) return state;

  const parsed = parseOrFail(customerSchema, readForm(formData));
  if (parsed.state) return parsed.state;

  try {
    await prisma.customer.create({
      data: { companyId: ctx.company.id, ...parsed.data },
    });
  } catch {
    return fail("Nao foi possivel salvar o cliente. Tente novamente.");
  }

  revalidatePath("/clientes");
  redirect("/clientes");
}

export async function updateCustomer(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx, state } = await authorizeState();
  if (!ctx) return state;

  const id = String(formData.get("id") ?? "");
  if (!id) return fail("Cliente invalido.");

  const parsed = parseOrFail(customerSchema, readForm(formData));
  if (parsed.state) return parsed.state;

  try {
    const result = await prisma.customer.updateMany({
      where: { id, companyId: ctx.company.id },
      data: parsed.data,
    });
    if (result.count === 0) return fail("Cliente nao encontrado.");
  } catch {
    return fail("Nao foi possivel salvar as alteracoes.");
  }

  revalidatePath("/clientes");
  redirect("/clientes");
}

export async function deleteCustomer(formData: FormData): Promise<void> {
  const { ctx } = await authorizeState();
  if (!ctx) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.customer.deleteMany({
    where: { id, companyId: ctx.company.id },
  });
  revalidatePath("/clientes");
}
