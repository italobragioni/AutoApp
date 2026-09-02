import { db } from "@/lib/db";

/**
 * Motor de campanhas do AUTOVOLT.
 *
 * Regra que orienta o arquivo inteiro: TODO numero exibido em Campanhas sai de
 * `CampaignParticipant`. Nada e digitado, estimado ou herdado do seed.
 *
 *   participantes -> quantas linhas a campanha tem
 *   enviados      -> quantas foram marcadas como enviadas pelo usuario
 *   convertidos   -> quantas tem uma OS concluida atribuida
 *   receita       -> soma do valor daquelas OS
 *
 * Os contadores em `Campaign` (sentCount, answeredCount, convertedCount,
 * revenueCents) continuam existindo, mas viraram uma projecao: só
 * `syncCampaignTotals` escreve neles, sempre recalculando a partir dos
 * participantes. Nenhuma tela le um numero que alguem digitou.
 *
 * Este modulo NAO leva "server-only" de proposito: o seed (`npm run db:seed`)
 * roda fora do Next e precisa da mesma atribuicao, e duplicar essa regra seria
 * pior do que abrir mao do marcador.
 */

/** Estados de um participante. `sentAt` preenchido = a mensagem saiu. */
export const PARTICIPANT_STATUS = {
  pendente: { label: "Pendente", tone: "muted" as const },
  enviado: { label: "Enviado", tone: "info" as const },
  nao_enviado: { label: "Não enviado", tone: "muted" as const },
  respondeu: { label: "Respondeu", tone: "success" as const },
  sem_resposta: { label: "Sem resposta", tone: "warning" as const },
};

export type ParticipantStatus = keyof typeof PARTICIPANT_STATUS;

/** Marcar qualquer um destes significa que a mensagem foi enviada. */
export const SENT_STATUSES: ParticipantStatus[] = ["enviado", "respondeu", "sem_resposta"];

export type MetricInput = {
  sentAt: Date | null;
  status: string;
  workOrderId: string | null;
  revenueCents: number;
};

export type CampaignMetrics = {
  participants: number;
  sent: number;
  answered: number;
  converted: number;
  /** 0 a 1. Zero quando ninguem recebeu — sem divisao por zero. */
  conversionRate: number;
  revenueCents: number;
};

/**
 * As metricas de uma campanha, a partir das linhas de participante.
 *
 * Taxa de conversao = convertidos / enviados. O denominador e quem REALMENTE
 * recebeu a mensagem: quem ficou como pendente ou nao enviado nao pesa contra a
 * campanha.
 */
export function campaignMetrics(participants: MetricInput[]): CampaignMetrics {
  const sent = participants.filter((p) => p.sentAt !== null).length;
  const converted = participants.filter((p) => p.workOrderId !== null).length;

  return {
    participants: participants.length,
    sent,
    answered: participants.filter((p) => p.status === "respondeu").length,
    converted,
    conversionRate: sent > 0 ? converted / sent : 0,
    revenueCents: participants.reduce((total, p) => total + p.revenueCents, 0),
  };
}

/** Recalcula os contadores de `Campaign` a partir dos participantes. */
export async function syncCampaignTotals(campaignId: string) {
  const participants = await db.campaignParticipant.findMany({
    where: { campaignId },
    select: { sentAt: true, status: true, workOrderId: true, revenueCents: true },
  });

  const metrics = campaignMetrics(participants);

  await db.campaign.update({
    where: { id: campaignId },
    data: {
      sentCount: metrics.sent,
      answeredCount: metrics.answered,
      convertedCount: metrics.converted,
      revenueCents: metrics.revenueCents,
    },
  });

  return metrics;
}

/**
 * Atribui uma OS concluida a uma campanha, se houver uma elegivel.
 *
 * Elegibilidade (todas obrigatorias):
 *   - mesma empresa e mesmo cliente da OS;
 *   - o participante recebeu a mensagem (`sentAt` preenchido);
 *   - a OS foi concluida no dia do envio ou depois;
 *   - dentro da janela de atribuicao da empresa (padrao 30 dias);
 *   - o participante ainda nao converteu.
 *
 * Empate: vence a campanha enviada mais recentemente ao cliente. A busca ordena
 * por `sentAt` desc e fica com a primeira candidata que ainda esta dentro da
 * janela — regra deterministica, sem depender da ordem em que as OS fecham.
 *
 * A atribuicao e persistida (OS, data e valor congelados no participante), entao
 * o relatorio de uma campanha antiga nao muda depois. Idempotente: chamar duas
 * vezes para a mesma OS nao cria uma segunda conversao.
 */
export async function attributeWorkOrder(workOrderId: string) {
  const order = await db.workOrder.findUnique({
    where: { id: workOrderId },
    select: {
      id: true,
      companyId: true,
      customerId: true,
      status: true,
      finishedAt: true,
      totalCents: true,
    },
  });

  // So OS concluida e com data de conclusao gera conversao.
  if (!order || order.status !== "concluida" || !order.finishedAt) return null;

  // Esta OS ja foi atribuida a alguma campanha? Entao nao entra de novo em
  // lugar nenhum. (O @unique em workOrderId garante isso no banco; aqui a
  // checagem evita o erro e deixa a funcao idempotente.)
  const already = await db.campaignParticipant.findUnique({
    where: { workOrderId: order.id },
    select: { id: true, campaignId: true },
  });
  if (already) return already;

  const company = await db.company.findUnique({
    where: { id: order.companyId },
    select: { attributionWindowDays: true },
  });
  if (!company) return null;

  // Candidatas: campanhas que este cliente recebeu e ainda nao converteu, da
  // mais recente para a mais antiga. Sao poucas linhas por cliente.
  const candidates = await db.campaignParticipant.findMany({
    where: {
      companyId: order.companyId,
      customerId: order.customerId,
      workOrderId: null,
      sentAt: { not: null },
    },
    orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    select: { id: true, campaignId: true, sentAt: true },
  });

  // A comparacao com o inicio do DIA do envio, e nao com a hora exata, e
  // proposital: a conclusao de uma OS guarda so a data (gravada ao meio-dia).
  // Comparando hora contra hora, um cliente que recebe a campanha de manha e
  // volta a tarde ficaria de fora — justamente a conversao mais rapida.
  const eligible = candidates.find((candidate) => {
    const sentAt = candidate.sentAt!;
    const from = new Date(sentAt);
    from.setHours(0, 0, 0, 0);
    const until = new Date(
      sentAt.getTime() + company.attributionWindowDays * 24 * 60 * 60 * 1000,
    );
    return order.finishedAt! >= from && order.finishedAt! <= until;
  });
  if (!eligible) return null;

  const participant = await db.campaignParticipant.update({
    where: { id: eligible.id },
    data: {
      workOrderId: order.id,
      convertedAt: order.finishedAt,
      revenueCents: order.totalCents,
    },
    select: { id: true, campaignId: true },
  });

  await syncCampaignTotals(participant.campaignId);
  return participant;
}

/**
 * Desfaz a atribuicao quando a OS deixa de estar concluida.
 *
 * Sem isso, reabrir uma OS deixaria a receita da campanha contando um
 * atendimento que nao aconteceu.
 */
export async function detachWorkOrder(workOrderId: string) {
  const participant = await db.campaignParticipant.findUnique({
    where: { workOrderId },
    select: { id: true, campaignId: true },
  });
  if (!participant) return null;

  await db.campaignParticipant.update({
    where: { id: participant.id },
    data: { workOrderId: null, convertedAt: null, revenueCents: 0 },
  });

  await syncCampaignTotals(participant.campaignId);
  return participant;
}

/**
 * Troca as variaveis da mensagem pelos dados do cliente.
 * Sao as mesmas que a tela sempre anunciou: {nome} e {veiculo}.
 */
export function renderMessage(
  message: string,
  customer: { name: string; vehicleLabel?: string | null },
) {
  return message
    .replaceAll("{nome}", customer.name.split(" ")[0])
    .replaceAll("{veiculo}", customer.vehicleLabel ?? "seu carro");
}
