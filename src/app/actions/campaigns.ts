"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  PARTICIPANT_STATUS,
  SENT_STATUSES,
  syncCampaignTotals,
  type ParticipantStatus,
} from "@/lib/campaigns";
import { permit } from "@/lib/authorize";
import { db } from "@/lib/db";
import { CAMPAIGN_STATUS, CHANNEL_LABEL } from "@/lib/labels";
import { AUDIENCE_LABEL, audienceFor, getRetention } from "@/lib/retention";

/**
 * Escrita do modulo Campanhas.
 *
 * O ponto central e o SNAPSHOT: ao criar a campanha, os participantes viram
 * linhas em `CampaignParticipant` com o estagio de retencao congelado. Depois
 * disso o motor de retencao pode reclassificar o cliente a vontade — a campanha
 * ja registrou quem recebeu o que, e a medicao continua valendo.
 *
 * O publico vem de `audienceFor` (src/lib/retention.ts), o mesmo calculo que a
 * tela de Retencao usa. Nao ha segunda regra de publico aqui.
 *
 * Isolamento: companyId sempre da sessao; todo id de cliente que chega do
 * formulario e conferido contra a empresa antes de virar participante.
 */

export type CampaignState =
  | { ok?: boolean; error?: string; id?: string }
  | undefined;

const STATUSES = Object.keys(CAMPAIGN_STATUS) as [string, ...string[]];
const CHANNELS = Object.keys(CHANNEL_LABEL) as [string, ...string[]];
const AUDIENCES = Object.keys(AUDIENCE_LABEL) as [string, ...string[]];
const PARTICIPANT_STATUSES = Object.keys(PARTICIPANT_STATUS) as [string, ...string[]];

const campaignSchema = z.object({
  name: z.string().min(2, "Dê um nome à campanha."),
  channel: z.enum(CHANNELS, { message: "Canal inválido." }),
  audience: z.enum(AUDIENCES, { message: "Público inválido." }),
  status: z.enum(STATUSES, { message: "Status inválido." }),
  message: z.string().min(5, "Escreva a mensagem da campanha.").max(2000, "Mensagem muito longa."),
  scheduledAt: z.string(),
});

function readForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    channel: String(formData.get("channel") ?? "whatsapp").trim(),
    audience: String(formData.get("audience") ?? "").trim(),
    status: String(formData.get("status") ?? "rascunho").trim(),
    message: String(formData.get("message") ?? "").trim(),
    scheduledAt: String(formData.get("scheduledAt") ?? "").trim(),
  };
}

function revalidateCampaign(id?: string) {
  revalidatePath("/campanhas");
  if (id) revalidatePath(`/campanhas/${id}`);
  revalidatePath("/dashboard");
}

/**
 * Cria a campanha e congela os participantes.
 *
 * Os ids vem do formulario (o usuario pode ter removido gente da previa), mas
 * so entram os que a consulta confirma serem clientes DESTA empresa. Um id de
 * outra empresa simplesmente nao encontra correspondencia e fica de fora.
 */
export async function createCampaignAction(
  _state: CampaignState,
  formData: FormData,
): Promise<CampaignState> {
  const gate = await permit("campaigns.write");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;

  const parsed = campaignSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const chosenIds = formData.getAll("customerIds").map(String).filter(Boolean);
  if (chosenIds.length === 0) {
    return { error: "Selecione ao menos um cliente para a campanha." };
  }

  // Filtro de empresa no banco: ids de fora simplesmente nao voltam.
  const customers = await db.customer.findMany({
    where: { id: { in: chosenIds }, companyId: company.id },
    select: { id: true },
  });
  if (customers.length === 0) {
    return { error: "Nenhum dos clientes selecionados pertence a esta empresa." };
  }

  // O estagio congelado vem do mesmo motor que a tela de Retencao usa.
  const retention = await getRetention(company.id);
  const stageById = new Map(retention.customers.map((c) => [c.id, c.stage]));

  const scheduledAt =
    parsed.data.scheduledAt && /^\d{4}-\d{2}-\d{2}$/.test(parsed.data.scheduledAt)
      ? new Date(`${parsed.data.scheduledAt}T12:00:00`)
      : null;

  const campaign = await db.campaign.create({
    data: {
      companyId: company.id,
      name: parsed.data.name,
      channel: parsed.data.channel,
      audience: parsed.data.audience,
      status: parsed.data.status,
      message: parsed.data.message,
      scheduledAt,
      // Nenhum contador nasce preenchido: criar campanha nao envia nada.
      participants: {
        create: customers.map((customer) => ({
          companyId: company.id,
          customerId: customer.id,
          stage: stageById.get(customer.id) ?? "novo",
        })),
      },
    },
    select: { id: true },
  });

  revalidateCampaign(campaign.id);
  return { ok: true, id: campaign.id };
}

/** Edita os dados da campanha. O snapshot de participantes nao e refeito. */
export async function updateCampaignAction(
  _state: CampaignState,
  formData: FormData,
): Promise<CampaignState> {
  const gate = await permit("campaigns.write");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;

  const id = String(formData.get("id") ?? "");
  const existing = await db.campaign.findFirst({
    where: { id, companyId: company.id },
    select: { id: true },
  });
  if (!existing) return { error: "Campanha não encontrada nesta empresa." };

  const parsed = campaignSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const scheduledAt =
    parsed.data.scheduledAt && /^\d{4}-\d{2}-\d{2}$/.test(parsed.data.scheduledAt)
      ? new Date(`${parsed.data.scheduledAt}T12:00:00`)
      : null;

  await db.campaign.update({
    where: { id: existing.id },
    data: {
      name: parsed.data.name,
      channel: parsed.data.channel,
      audience: parsed.data.audience,
      status: parsed.data.status,
      message: parsed.data.message,
      scheduledAt,
    },
  });

  revalidateCampaign(existing.id);
  return { ok: true, id: existing.id };
}

export async function changeCampaignStatusAction(
  _state: CampaignState,
  formData: FormData,
): Promise<CampaignState> {
  const gate = await permit("campaigns.write");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!(status in CAMPAIGN_STATUS)) return { error: "Status inválido." };

  const existing = await db.campaign.findFirst({
    where: { id, companyId: company.id },
    select: { id: true },
  });
  if (!existing) return { error: "Campanha não encontrada nesta empresa." };

  await db.campaign.update({ where: { id: existing.id }, data: { status } });

  revalidateCampaign(existing.id);
  return { ok: true, id: existing.id };
}

export async function deleteCampaignAction(
  _state: CampaignState,
  formData: FormData,
): Promise<CampaignState> {
  const gate = await permit("campaigns.write");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;

  const id = String(formData.get("id") ?? "");
  const existing = await db.campaign.findFirst({
    where: { id, companyId: company.id },
    select: { id: true },
  });
  if (!existing) return { error: "Campanha não encontrada nesta empresa." };

  // Os participantes saem junto (onDelete: Cascade).
  await db.campaign.delete({ where: { id: existing.id } });

  revalidateCampaign();
  return { ok: true };
}

/**
 * Registra que a campanha foi disparada.
 *
 * Marca como enviados apenas os participantes que ainda estao pendentes — quem
 * o usuario ja marcou como "não enviado" continua de fora, e quem ja recebeu
 * mantem a data original (a janela de atribuicao dele nao pode ser reiniciada).
 */
export async function sendCampaignAction(
  _state: CampaignState,
  formData: FormData,
): Promise<CampaignState> {
  const gate = await permit("campaigns.write");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;

  const id = String(formData.get("id") ?? "");
  const campaign = await db.campaign.findFirst({
    where: { id, companyId: company.id },
    select: { id: true, sentAt: true },
  });
  if (!campaign) return { error: "Campanha não encontrada nesta empresa." };

  const pending = await db.campaignParticipant.count({
    where: { campaignId: campaign.id, status: "pendente" },
  });
  if (pending === 0) {
    return { error: "Nenhum participante pendente para registrar envio." };
  }

  const now = new Date();
  await db.campaignParticipant.updateMany({
    where: { campaignId: campaign.id, status: "pendente" },
    data: { status: "enviado", sentAt: now },
  });

  await db.campaign.update({
    where: { id: campaign.id },
    data: { status: "enviada", sentAt: campaign.sentAt ?? now },
  });

  await syncCampaignTotals(campaign.id);

  revalidateCampaign(campaign.id);
  return { ok: true, id: campaign.id };
}

/**
 * Marca um participante individualmente.
 *
 * `sentAt` e gravado na primeira marcacao que signifique "a mensagem saiu", e
 * nunca reescrito depois: e ele que abre a janela de atribuicao, entao mudar de
 * "enviado" para "respondeu" nao pode empurrar a janela para frente.
 */
export async function setParticipantStatusAction(
  _state: CampaignState,
  formData: FormData,
): Promise<CampaignState> {
  const gate = await permit("campaigns.write");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;

  const participantId = String(formData.get("participantId") ?? "");
  const status = String(formData.get("status") ?? "");

  const parsed = z.enum(PARTICIPANT_STATUSES).safeParse(status);
  if (!parsed.success) return { error: "Status de participante inválido." };

  // O participante precisa ser da empresa da sessao.
  const participant = await db.campaignParticipant.findFirst({
    where: { id: participantId, companyId: company.id },
    select: { id: true, campaignId: true, sentAt: true },
  });
  if (!participant) return { error: "Participante não encontrado nesta empresa." };

  const marksAsSent = SENT_STATUSES.includes(parsed.data as ParticipantStatus);

  await db.campaignParticipant.update({
    where: { id: participant.id },
    data: {
      status: parsed.data,
      sentAt: marksAsSent ? (participant.sentAt ?? new Date()) : null,
      // Voltar para "pendente"/"não enviado" desfaz o envio: sem data, o
      // participante sai do denominador da taxa de conversao.
    },
  });

  // A campanha passa a "Em andamento" na primeira mensagem que sai de fato.
  if (marksAsSent) {
    const campaign = await db.campaign.findUnique({
      where: { id: participant.campaignId },
      select: { status: true, sentAt: true },
    });
    if (campaign && (campaign.status === "rascunho" || campaign.status === "agendada")) {
      await db.campaign.update({
        where: { id: participant.campaignId },
        data: { status: "enviada", sentAt: campaign.sentAt ?? new Date() },
      });
    }
  }

  await syncCampaignTotals(participant.campaignId);

  revalidateCampaign(participant.campaignId);
  return { ok: true, id: participant.campaignId };
}

/** Tira um participante da campanha depois de criada. */
export async function removeParticipantAction(
  _state: CampaignState,
  formData: FormData,
): Promise<CampaignState> {
  const gate = await permit("campaigns.write");
  if (!gate.ok) return { error: gate.error };
  const { company } = gate;

  const participantId = String(formData.get("participantId") ?? "");
  const participant = await db.campaignParticipant.findFirst({
    where: { id: participantId, companyId: company.id },
    select: { id: true, campaignId: true },
  });
  if (!participant) return { error: "Participante não encontrado nesta empresa." };

  await db.campaignParticipant.delete({ where: { id: participant.id } });
  await syncCampaignTotals(participant.campaignId);

  revalidateCampaign(participant.campaignId);
  return { ok: true, id: participant.campaignId };
}
