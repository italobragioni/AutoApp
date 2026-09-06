"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { permit } from "@/lib/authorize";
import { db } from "@/lib/db";
import { runAutomationsForCompany } from "@/lib/whatsapp/engine";
import { normalizePhoneBR } from "@/lib/whatsapp/phone";

export type WhatsAppState = { error?: string; ok?: string } | undefined;

/**
 * Actions do WhatsApp Automático.
 *
 * Todas passam por `permit("whatsapp.manage")` — usuário autenticado + Membership
 * + empresa da sessão + assinatura ativa + papel autorizado (dono/gerente).
 * O companyId vem SEMPRE do gate (nunca do formulário).
 */

const bool = (v: FormDataEntryValue | null) => v === "on" || v === "true" || v === "1";

const templateSchema = z
  .string()
  .trim()
  .max(1000, "Mensagem muito longa.")
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

const settingsSchema = z.object({
  timezone: z.string().trim().min(1).max(64).default("America/Sao_Paulo"),
});

/** Salva os interruptores e (opcionalmente) as mensagens personalizadas. */
export async function saveWhatsAppSettingsAction(
  _state: WhatsAppState,
  formData: FormData,
): Promise<WhatsAppState> {
  const gate = await permit("whatsapp.manage");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;

  const parsedTz = settingsSchema.safeParse({
    timezone: String(formData.get("timezone") ?? "America/Sao_Paulo"),
  });
  const timezone = parsedTz.success ? parsedTz.data.timezone : "America/Sao_Paulo";

  const data = {
    enabled: bool(formData.get("enabled")),
    retentionRiskEnabled: bool(formData.get("retentionRiskEnabled")),
    retentionInactiveEnabled: bool(formData.get("retentionInactiveEnabled")),
    appointmentReminderEnabled: bool(formData.get("appointmentReminderEnabled")),
    postServiceEnabled: bool(formData.get("postServiceEnabled")),
    timezone,
    riskTemplate: templateSchema.parse(String(formData.get("riskTemplate") ?? "")),
    inactiveTemplate: templateSchema.parse(String(formData.get("inactiveTemplate") ?? "")),
    reminderTemplate: templateSchema.parse(String(formData.get("reminderTemplate") ?? "")),
    postServiceTemplate: templateSchema.parse(String(formData.get("postServiceTemplate") ?? "")),
  };

  await db.whatsAppAutomationSettings.upsert({
    where: { companyId: company.id },
    create: { companyId: company.id, ...data },
    update: data,
  });

  revalidatePath("/whatsapp");
  return { ok: "Configurações salvas." };
}

/**
 * Simula a conexão do WhatsApp (fase mock), para testar a Tela 2 sem a Evolution
 * API. Deixa claro na interface que é simulação. A conexão real virá pelo
 * EvolutionProvider sem mudar nenhuma regra de negócio.
 */
export async function simulateConnectAction(
  _state?: WhatsAppState,
  _formData?: FormData,
): Promise<WhatsAppState> {
  const gate = await permit("whatsapp.manage");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;

  const phone = normalizePhoneBR(company.phone) ?? "+55 (simulação)";
  await db.whatsAppIntegration.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      provider: "mock",
      status: "connected",
      instanceName: `mock-${company.slug}`,
      phoneNumber: phone,
      connectedAt: new Date(),
    },
    update: { status: "connected", provider: "mock", phoneNumber: phone, connectedAt: new Date() },
  });

  // Garante uma linha de configuração (com os padrões) ao conectar.
  await db.whatsAppAutomationSettings.upsert({
    where: { companyId: company.id },
    create: { companyId: company.id },
    update: {},
  });

  revalidatePath("/whatsapp");
  return { ok: "WhatsApp conectado (simulação)." };
}

/** Desconecta a integração. Não apaga histórico nem configurações. */
export async function disconnectWhatsAppAction(
  _state?: WhatsAppState,
  _formData?: FormData,
): Promise<WhatsAppState> {
  const gate = await permit("whatsapp.manage");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;

  await db.whatsAppIntegration.updateMany({
    where: { companyId: company.id },
    data: { status: "disconnected" },
  });

  revalidatePath("/whatsapp");
  return { ok: "WhatsApp desconectado." };
}

/**
 * Executa as automações da empresa agora (simulação com o Mock Provider).
 * Ignora a janela de horário porque é uma ação manual do dono para testar.
 */
export async function runAutomationsNowAction(
  _state?: WhatsAppState,
  _formData?: FormData,
): Promise<WhatsAppState> {
  const gate = await permit("whatsapp.manage");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;

  const result = await runAutomationsForCompany(company.id, { enforceWindow: false });
  revalidatePath("/whatsapp");

  if (!result.ran) {
    const reasons: Record<string, string> = {
      automacao_desativada: "Ative o WhatsApp Automático primeiro.",
      whatsapp_nao_conectado: "Conecte o WhatsApp primeiro.",
      fora_do_horario: "Fora do horário permitido de envio.",
      empresa_inexistente: "Empresa não encontrada.",
    };
    return { error: reasons[result.reason ?? ""] ?? "Não foi possível executar agora." };
  }
  return {
    ok: `Simulação concluída: ${result.sent} enviada(s), ${result.failed} falha(s), ${result.skipped} ignorada(s).`,
  };
}
