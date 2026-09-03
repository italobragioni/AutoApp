"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireContext } from "@/lib/tenant";

/**
 * Dispensar / retomar o guia de primeiros passos.
 *
 * E uma preferencia de exibicao por empresa, nao um dado de negocio: so escreve
 * `onboardingDismissedAt` na empresa da sessao. NAO cria, altera ou apaga
 * nenhum registro operacional, e nao interfere no calculo de conclusao — este
 * continua vindo dos dados reais.
 *
 * Qualquer membro da empresa pode esconder ou reexibir o card (esconder um guia
 * nao e uma acao sensivel). A empresa vem sempre da sessao — nunca do cliente.
 */

export type OnboardingState = { ok?: boolean; error?: string } | undefined;

export async function dismissOnboardingAction(): Promise<OnboardingState> {
  const { company } = await requireContext();

  await db.company.update({
    where: { id: company.id },
    data: { onboardingDismissedAt: new Date() },
  });

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function restoreOnboardingAction(): Promise<OnboardingState> {
  const { company } = await requireContext();

  await db.company.update({
    where: { id: company.id },
    data: { onboardingDismissedAt: null },
  });

  revalidatePath("/dashboard");
  return { ok: true };
}
