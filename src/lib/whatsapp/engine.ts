import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { getProvider } from "@/lib/messaging";
import {
  inactiveCandidates,
  postServiceCandidates,
  reminderCandidates,
  riskCandidates,
  type AutomationContext,
  type Candidate,
} from "@/lib/whatsapp/automations";
import { AUTOMATION_TYPES, COOLDOWN_DAYS, type AutomationType } from "@/lib/whatsapp/config";
import { isWithinSendWindow } from "@/lib/whatsapp/decision";
import { renderTemplate, templateFor } from "@/lib/whatsapp/templates";

/**
 * Automation Engine — o cérebro do WhatsApp Automático.
 *
 * Encontra candidatos (retenção, agenda, OS), aplica a camada de decisão
 * (integração conectada, automação ativa, telefone válido, cooldown, janela de
 * horário, deduplicação) e "envia" pelo Messaging Provider (mock nesta fase),
 * registrando a mensagem FINAL no histórico. Roda sem depender de nenhuma tela
 * aberta — é chamado pela action de teste e, no futuro, por um cron.
 *
 * Tudo escopado por companyId. Nunca lança para o chamador em massa: erros de
 * envio viram status "failed" numa linha do histórico.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type PerType = { sent: number; failed: number; skipped: number };

export type EngineResult = {
  companyId: string;
  ran: boolean;
  reason?: string;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  byType: Record<AutomationType, PerType>;
};

function emptyByType(): Record<AutomationType, PerType> {
  return {
    risco: { sent: 0, failed: 0, skipped: 0 },
    inativo: { sent: 0, failed: 0, skipped: 0 },
    lembrete: { sent: 0, failed: 0, skipped: 0 },
    pos_servico: { sent: 0, failed: 0, skipped: 0 },
  };
}

type EffectiveSettings = {
  enabled: boolean;
  retentionRiskEnabled: boolean;
  retentionInactiveEnabled: boolean;
  appointmentReminderEnabled: boolean;
  postServiceEnabled: boolean;
  timezone: string;
  riskTemplate: string | null;
  inactiveTemplate: string | null;
  reminderTemplate: string | null;
  postServiceTemplate: string | null;
};

const DEFAULT_SETTINGS: EffectiveSettings = {
  enabled: true,
  retentionRiskEnabled: true,
  retentionInactiveEnabled: true,
  appointmentReminderEnabled: true,
  postServiceEnabled: true,
  timezone: "America/Sao_Paulo",
  riskTemplate: null,
  inactiveTemplate: null,
  reminderTemplate: null,
  postServiceTemplate: null,
};

/** Clientes que já receberam este tipo dentro do cooldown (evita repetir). */
async function customersInCooldown(
  companyId: string,
  type: AutomationType,
  now: Date,
): Promise<Set<string>> {
  const days = COOLDOWN_DAYS[type];
  if (days <= 0) return new Set();
  const since = new Date(now.getTime() - days * MS_PER_DAY);
  const rows = await db.whatsAppMessage.findMany({
    where: {
      companyId,
      automationType: type,
      createdAt: { gte: since },
      status: { in: ["sent", "sending", "queued"] },
    },
    select: { customerId: true },
  });
  return new Set(rows.map((r) => r.customerId));
}

/**
 * Roda todas as automações ativas de UMA empresa.
 *
 * @param opts.now       instante de referência (injetável para testes).
 * @param opts.enforceWindow  respeitar a janela de horário (cron = true; a
 *                            execução manual do dono passa false para testar).
 */
export async function runAutomationsForCompany(
  companyId: string,
  opts: { now?: Date; enforceWindow?: boolean } = {},
): Promise<EngineResult> {
  const now = opts.now ?? new Date();
  const enforceWindow = opts.enforceWindow ?? true;
  const byType = emptyByType();
  const base: EngineResult = {
    companyId,
    ran: false,
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    byType,
  };

  const [company, integration, settingsRow] = await Promise.all([
    db.company.findUnique({ where: { id: companyId }, select: { name: true } }),
    db.whatsAppIntegration.findUnique({ where: { companyId } }),
    db.whatsAppAutomationSettings.findUnique({ where: { companyId } }),
  ]);

  if (!company) return { ...base, reason: "empresa_inexistente" };

  const settings: EffectiveSettings = settingsRow
    ? {
        enabled: settingsRow.enabled,
        retentionRiskEnabled: settingsRow.retentionRiskEnabled,
        retentionInactiveEnabled: settingsRow.retentionInactiveEnabled,
        appointmentReminderEnabled: settingsRow.appointmentReminderEnabled,
        postServiceEnabled: settingsRow.postServiceEnabled,
        timezone: settingsRow.timezone,
        riskTemplate: settingsRow.riskTemplate,
        inactiveTemplate: settingsRow.inactiveTemplate,
        reminderTemplate: settingsRow.reminderTemplate,
        postServiceTemplate: settingsRow.postServiceTemplate,
      }
    : DEFAULT_SETTINGS;

  // Checagens gerais (a mesma ordem da camada de decisão).
  if (!settings.enabled) return { ...base, reason: "automacao_desativada" };
  if (!integration || integration.status !== "connected") {
    return { ...base, reason: "whatsapp_nao_conectado" };
  }
  if (enforceWindow && !isWithinSendWindow(settings.timezone, now)) {
    return { ...base, reason: "fora_do_horario" };
  }

  const ctx: AutomationContext = {
    companyId,
    companyName: company.name,
    timezone: settings.timezone,
    now,
  };
  const provider = getProvider(
    (integration.provider as "mock" | "evolution" | "cloud") ?? undefined,
  );

  // Monta a fila conforme os interruptores da empresa.
  const candidates: Candidate[] = [];
  if (settings.retentionRiskEnabled) candidates.push(...(await riskCandidates(ctx)));
  if (settings.retentionInactiveEnabled) candidates.push(...(await inactiveCandidates(ctx)));
  if (settings.appointmentReminderEnabled) candidates.push(...(await reminderCandidates(ctx)));
  if (settings.postServiceEnabled) candidates.push(...(await postServiceCandidates(ctx)));

  // Cooldown por tipo, pré-carregado (uma consulta por tipo com cooldown > 0).
  const cooldownSets: Partial<Record<AutomationType, Set<string>>> = {};
  for (const type of AUTOMATION_TYPES) {
    if (COOLDOWN_DAYS[type] > 0) cooldownSets[type] = await customersInCooldown(companyId, type, now);
  }

  const customTemplates = {
    riskTemplate: settings.riskTemplate,
    inactiveTemplate: settings.inactiveTemplate,
    reminderTemplate: settings.reminderTemplate,
    postServiceTemplate: settings.postServiceTemplate,
  };

  for (const candidate of candidates) {
    base.processed += 1;

    // Sem telefone válido → não envia (não registra: pode ganhar número depois).
    if (!candidate.phone) {
      base.skipped += 1;
      byType[candidate.type].skipped += 1;
      continue;
    }
    // Cooldown: já recebeu esse tipo há pouco.
    if (cooldownSets[candidate.type]?.has(candidate.customerId)) {
      base.skipped += 1;
      byType[candidate.type].skipped += 1;
      continue;
    }

    const content = renderTemplate(templateFor(candidate.type, customTemplates), candidate.vars);

    // Claim idempotente: a linha é o "evento processado". Se já existe
    // (dedupeKey único), pula — reexecução/retry não duplica.
    let messageId: string;
    try {
      const created = await db.whatsAppMessage.create({
        data: {
          companyId,
          customerId: candidate.customerId,
          vehicleId: candidate.vehicleId ?? null,
          appointmentId: candidate.appointmentId ?? null,
          workOrderId: candidate.workOrderId ?? null,
          automationType: candidate.type,
          provider: provider.name,
          status: "sending",
          content,
          toPhone: candidate.phone,
          dedupeKey: candidate.dedupeKey,
        },
        select: { id: true },
      });
      messageId = created.id;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        base.skipped += 1;
        byType[candidate.type].skipped += 1;
        continue;
      }
      throw error;
    }

    // "Envia" pelo provider (mock nesta fase — nada real sai).
    const result = await provider.send({ to: candidate.phone, message: content });
    await db.whatsAppMessage.update({
      where: { id: messageId },
      data: {
        status: result.status,
        externalMessageId: result.externalMessageId ?? null,
        error: result.error ?? null,
        sentAt: result.status === "sent" ? new Date() : null,
      },
    });

    if (result.status === "sent") {
      base.sent += 1;
      byType[candidate.type].sent += 1;
      // Marca este cliente como em cooldown para não repetir na mesma execução.
      cooldownSets[candidate.type]?.add(candidate.customerId);
    } else {
      base.failed += 1;
      byType[candidate.type].failed += 1;
    }
  }

  return { ...base, ran: true };
}
