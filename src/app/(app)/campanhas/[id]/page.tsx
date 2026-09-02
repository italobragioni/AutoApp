import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CircleDollarSign,
  MessageCircle,
  Pencil,
  Send,
  Target,
  Users,
} from "lucide-react";

import {
  Avatar,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui";
import { PageHeader, StatCard } from "@/components/ui/page";
import { campaignMetrics, PARTICIPANT_STATUS, renderMessage } from "@/lib/campaigns";
import { db } from "@/lib/db";
import { dateFull, money, phoneMask, whatsappLink } from "@/lib/format";
import { CAMPAIGN_STATUS, CHANNEL_LABEL, statusOf } from "@/lib/labels";
import {
  AUDIENCE_LABEL,
  CAMPAIGN_AUDIENCES,
  STAGE_LABEL,
  STAGE_TONE,
  audienceFor,
  getRetention,
  type RetentionStage,
} from "@/lib/retention";
import { requirePermission } from "@/lib/authorize";

import { CampaignForm } from "../CampaignForm";
import {
  CampaignStatusActions,
  DeleteCampaign,
  ParticipantActions,
  RemoveParticipant,
  SendCampaign,
} from "../CampaignActions";

export const metadata: Metadata = { title: "Campanha" };

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editar?: string }>;
}) {
  // Sem esta permissao a pagina nem carrega — a trava e do servidor.
  const { company } = await requirePermission("campaigns.write");
  const { id } = await params;
  const editing = (await searchParams).editar === "1";

  // findFirst com companyId: campanha de outra empresa nao existe aqui.
  const campaign = await db.campaign.findFirst({
    where: { id, companyId: company.id },
    include: {
      participants: {
        orderBy: [{ convertedAt: "desc" }, { createdAt: "asc" }],
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              vehicles: { select: { brand: true, model: true }, take: 1 },
            },
          },
          workOrder: {
            select: { id: true, number: true, totalCents: true, finishedAt: true },
          },
        },
      },
    },
  });

  if (!campaign) notFound();

  // Os publicos vem do mesmo motor de retencao usado na listagem — o form de
  // edicao precisa deles para o seletor, ainda que nao refaca o snapshot.
  const retention = await getRetention(company.id);
  const audiences = CAMPAIGN_AUDIENCES.map((key) => ({
    key,
    label: AUDIENCE_LABEL[key] ?? key,
    customerIds: audienceFor(retention, key).map((customer) => customer.id),
  }));

  const metrics = campaignMetrics(campaign.participants);
  const status = statusOf(CAMPAIGN_STATUS, campaign.status);
  const pendingCount = campaign.participants.filter((p) => p.status === "pendente").length;
  const rate = Math.round(metrics.conversionRate * 100);

  return (
    <div className="space-y-6">
      <CampaignForm
        open={editing}
        audiences={audiences}
        customers={[]}
        closeHref={`/campanhas/${campaign.id}`}
        campaign={{
          id: campaign.id,
          name: campaign.name,
          channel: campaign.channel,
          audience: campaign.audience,
          status: campaign.status,
          message: campaign.message,
          scheduledAt: campaign.scheduledAt
            ? campaign.scheduledAt.toISOString().slice(0, 10)
            : "",
        }}
      />

      <Link
        href="/campanhas"
        className="focus-ring inline-flex items-center gap-1.5 rounded text-xs font-medium text-muted transition-colors hover:text-white"
      >
        <ArrowLeft size={14} />
        Voltar para campanhas
      </Link>

      <Card>
        <CardBody className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-xl font-bold text-white sm:text-2xl">
                {campaign.name}
              </h1>
              <Badge tone={status.tone} dot>
                {status.label}
              </Badge>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Users size={13} />
                {AUDIENCE_LABEL[campaign.audience] ?? campaign.audience}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle size={13} />
                {CHANNEL_LABEL[campaign.channel] ?? campaign.channel}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock size={13} />
                Criada em {dateFull(campaign.createdAt)}
              </span>
              {campaign.sentAt && (
                <span className="inline-flex items-center gap-1.5">
                  <Send size={13} />
                  Enviada em {dateFull(campaign.sentAt)}
                </span>
              )}
            </div>

            <p className="mt-3 max-w-xl rounded-xl border border-line bg-ink-850 px-3.5 py-2.5 text-sm leading-relaxed text-soft">
              {campaign.message}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href={`/campanhas/${campaign.id}?editar=1`} variant="secondary" size="md">
              <Pencil size={16} />
              Editar
            </ButtonLink>
            <SendCampaign campaign={{ id: campaign.id }} pendingCount={pendingCount} />
            <DeleteCampaign campaign={{ id: campaign.id, name: campaign.name }} />
          </div>
        </CardBody>

        <div className="border-t border-line px-5 py-3">
          <CampaignStatusActions campaign={{ id: campaign.id, status: campaign.status }} />
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Participantes"
          value={metrics.participants}
          hint="Congelados na criação"
          icon={<Users size={17} />}
        />
        <StatCard
          label="Enviadas"
          value={metrics.sent}
          hint={`${metrics.answered} ${metrics.answered === 1 ? "resposta" : "respostas"}`}
          icon={<Send size={17} />}
        />
        <StatCard
          label="Taxa de conversão"
          value={`${rate}%`}
          hint={
            metrics.sent > 0
              ? `${metrics.converted} de ${metrics.sent} que receberam`
              : "Nenhum envio registrado"
          }
          icon={<Target size={17} />}
          tone={metrics.converted > 0 ? "volt" : "default"}
        />
        <StatCard
          label="Receita atribuída"
          value={money(metrics.revenueCents)}
          hint={`OS concluídas em até ${company.attributionWindowDays} dias após o envio`}
          icon={<CircleDollarSign size={17} />}
          tone="volt"
        />
      </div>

      <Card>
        <CardHeader
          title="Participantes"
          description="Marque o que aconteceu com cada cliente. A conversão é registrada sozinha quando a OS é concluída."
        />

        {campaign.participants.length === 0 ? (
          <EmptyState
            icon={<Users size={20} />}
            title="Sem participantes"
            description="Todos os clientes foram removidos desta campanha."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Cliente</Th>
                <Th>No envio</Th>
                <Th>Situação</Th>
                <Th>Enviada em</Th>
                <Th>Conversão</Th>
                <Th className="text-right">Ação</Th>
              </tr>
            </thead>
            <tbody>
              {campaign.participants.map((participant) => {
                const vehicle = participant.customer.vehicles[0];
                const vehicleLabel = vehicle ? `${vehicle.brand} ${vehicle.model}` : null;
                const meta =
                  PARTICIPANT_STATUS[participant.status as keyof typeof PARTICIPANT_STATUS] ??
                  PARTICIPANT_STATUS.pendente;

                return (
                  <Tr key={participant.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/clientes/${participant.customer.id}`}
                          className="focus-ring flex items-center gap-3 rounded"
                        >
                          <Avatar name={participant.customer.name} size={34} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-white">
                              {participant.customer.name}
                            </span>
                            <span className="block text-xs text-muted">
                              {vehicleLabel ?? phoneMask(participant.customer.phone)}
                            </span>
                          </span>
                        </Link>
                        {participant.customer.phone && (
                          <a
                            href={whatsappLink(
                              participant.customer.phone,
                              renderMessage(campaign.message, {
                                name: participant.customer.name,
                                vehicleLabel,
                              }),
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Abrir conversa no WhatsApp"
                            className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-volt-400/12 px-2.5 py-1.5 text-xs font-semibold text-volt-300 transition-colors hover:bg-volt-400/20"
                          >
                            <MessageCircle size={13} />
                            Chamar
                          </a>
                        )}
                      </div>
                    </Td>
                    <Td>
                      {/* Estagio congelado no momento do snapshot. */}
                      <Badge tone={STAGE_TONE[participant.stage as RetentionStage] ?? "neutral"}>
                        {STAGE_LABEL[participant.stage as RetentionStage] ?? participant.stage}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge tone={meta.tone} dot>
                        {meta.label}
                      </Badge>
                    </Td>
                    <Td className="text-sm text-soft">
                      {participant.sentAt ? (
                        dateFull(participant.sentAt)
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                    <Td className="text-sm">
                      {participant.workOrder ? (
                        <>
                          <Link
                            href={`/ordens/${participant.workOrder.id}`}
                            className="focus-ring block rounded font-medium text-volt-300 hover:text-volt-200"
                          >
                            OS #{String(participant.workOrder.number).padStart(4, "0")}
                          </Link>
                          <span className="block text-xs text-muted">
                            {money(participant.revenueCents)}
                            {participant.convertedAt && ` · ${dateFull(participant.convertedAt)}`}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <ParticipantActions
                          participant={{ id: participant.id, status: participant.status }}
                        />
                        <RemoveParticipant participant={{ id: participant.id }} />
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}

        <p className="border-t border-line px-5 py-3.5 text-[0.7rem] leading-relaxed text-muted">
          Uma OS concluída conta como conversão desta campanha quando é do mesmo cliente, da mesma
          empresa, foi finalizada depois do envio e dentro da janela de{" "}
          {company.attributionWindowDays} dias. Se o cliente estiver em mais de uma campanha
          elegível, a OS vai para a mais recente — e nunca para duas.
        </p>
      </Card>
    </div>
  );
}
