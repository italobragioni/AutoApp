"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/core/db";
import { authorizeState } from "@/lib/core/actions";
import type { Prisma } from "@prisma/client";

// Acoes de orcamento comuns a todos os nichos (a composicao dos itens ja esta
// congelada em spec/breakdown, entao duplicar independe do nicho).

/**
 * Duplica um orcamento (cabecalho + itens) em um novo, em rascunho. Serve tanto
 * para "duplicar" quanto para "transformar um orcamento anterior em um novo".
 */
export async function duplicateQuote(formData: FormData): Promise<void> {
  const { ctx } = await authorizeState();
  if (!ctx) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const source = await prisma.quote.findFirst({
    where: { id, companyId: ctx.company.id },
    include: { items: { orderBy: { id: "asc" } } },
  });
  if (!source) return;

  // Total dos materiais dos itens (mesma logica de recomputo dos nichos).
  const itemsMaterialsCents = source.items.reduce((sum, it) => {
    const b = it.breakdown as { materialsCents?: number } | null;
    return sum + (b && typeof b.materialsCents === "number" ? b.materialsCents : 0);
  }, 0);
  const costsBase =
    itemsMaterialsCents + source.installationCents + source.travelCents + source.otherCents;
  const marginCents = Math.round((costsBase * source.marginBps) / 10000);
  const totalCents = Math.max(0, costsBase + marginCents - source.discountCents);

  let newId: string;
  try {
    const agg = await prisma.quote.aggregate({
      where: { companyId: ctx.company.id },
      _max: { number: true },
    });
    const number = (agg._max.number ?? 0) + 1;

    const created = await prisma.quote.create({
      data: {
        companyId: ctx.company.id,
        number,
        customerId: source.customerId,
        status: "rascunho",
        validUntil: source.validUntil,
        marginBps: source.marginBps,
        installationCents: source.installationCents,
        travelCents: source.travelCents,
        otherCents: source.otherCents,
        discountCents: source.discountCents,
        deliveryTime: source.deliveryTime,
        paymentTerms: source.paymentTerms,
        notes: source.notes,
        subtotalCents: itemsMaterialsCents,
        totalCents,
        statusEvents: { create: { companyId: ctx.company.id, status: "rascunho" } },
        items: {
          create: source.items.map((it) => ({
            productId: it.productId,
            description: it.description,
            quantity: it.quantity,
            unit: it.unit,
            unitPriceCents: it.unitPriceCents,
            spec: (it.spec ?? undefined) as Prisma.InputJsonValue | undefined,
            breakdown: (it.breakdown ?? undefined) as Prisma.InputJsonValue | undefined,
          })),
        },
      },
    });
    newId = created.id;
  } catch {
    redirect("/orcamentos");
  }

  revalidatePath("/orcamentos");
  redirect(`/orcamentos/${newId}`);
}
