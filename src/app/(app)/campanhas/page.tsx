import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone, MessageCircle, Plus, Target, TrendingUp, Users } from "lucide-react";

import { Badge, ButtonLink, Card, CardHeader, EmptyState, Meter } from "@/components/ui";
import { PageHeader, StatCard } from "@/components/ui/page";
import { campaignMetrics } from "@/lib/campaigns";
import { db } from "@/lib/db";
import { dateFull, money } from "@/lib/format";
import { CAMPAIGN_STATUS, CHANNEL_LABEL, statusOf } from "@/lib/labels";
import {
  AUDIENCE_LABEL,
  CAMPAIGN_AUDIENCES,
  STAGE_LABEL,
  STAGE_TONE,
  audienceFor,
  getRetention,
} from "@/lib/retention";
import { requirePermission } from "@/lib/authorize";

import { CampaignForm } from "./CampaignForm";

export const metadata: Metadata = { title: "Campanhas" };

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ nova?: string }>;
}) {
  // Sem esta permissao a pagina nem carrega — a trava e do servidor.
  const { company } = await requirePermission("campaigns.write");
  const creating = (await searchParams).nova === "1";

  const [campaigns, retention] = await Promise.all([
    db.campaign.findMany({
      where: { companyId: company.id },
      orderBy: [{ createdAt: "desc" }],
      include: {
        // A métrica sai daqui, não dos contadores gravados.
        participants: {
          select: { sentAt: true, status: true, workOrderId: true, revenueCents: true },
        },
      },
    }),
    getRetention(company.id),
  ]);

  // Um cálculo só: `audienceFor` é o mesmo usado na tela de Retenção.
  const audiences = CAMPAIGN_AUDIENCES.map((key) => {
    const list = audienceFor(retention, key);
    return {
      key,
      label: AUDIENCE_LABEL[key] ?? key,
      customerIds: list.map((customer) => customer.id),
      opportunityCents: list.reduce((sum, customer) => sum + customer.opportunityCents, 0),
    };
  });

  const customers = retention.customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    stageLabel: STAGE_LABEL[customer.stage],
    stageTone: STAGE_TONE[customer.stage],
    vehicleLabel: customer.vehicleLabel,
  }));

  const withMetrics = campaigns.map((campaign) => ({
    campaign,
    metrics: campaignMetrics(campaign.participants),
  }));

  // Totais da empresa: soma das campanhas, que por sua vez somam participantes.
  const totals = withMetrics.reduce(
    (acc, item) => ({
      sent: acc.sent + item.metrics.sent,
      converted: acc.converted + item.metrics.converted,
      revenueCents: acc.revenueCents + item.metrics.revenueCents,
    }),
    { sent: 0, converted: 0, revenueCents: 0 },
  );
  const conversionRate = totals.sent > 0 ? Math.round((totals.converted / totals.sent) * 100) : 0;
  const running = withMetrics.filter((item) => item.metrics.sent > 0).length;

  return (
    <div className="space-y-6">
      <CampaignForm
        open={creating}
        audiences={audiences}
        customers={customers}
        closeHref="/campanhas"
      />

      <PageHeader
        eyebrow="Crescimento"
        title="Campanhas"
        description="Mensagens de reativação para os públicos que a plataforma separa sozinha, a partir do comportamento real dos seus clientes."
        actions={
          <ButtonLink href="/campanhas?nova=1" size="md">
            <Plus size={16} />
            Nova campanha
          </ButtonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Campanhas com envio"
          value={running}
          hint={`${campaigns.length} no total`}
          icon={<Megaphone size={17} />}
        />
        <StatCard
          label="Mensagens registradas"
          value={totals.sent}
          hint="Marcadas como enviadas por você"
          icon={<MessageCircle size={17} />}
        />
        <StatCard
          label="Taxa de conversão"
          value={`${conversionRate}%`}
          hint={`${totals.converted} ${totals.converted === 1 ? "cliente voltou" : "clientes voltaram"}`}
          icon={<Target size={17} />}
          tone="volt"
        />
        <StatCard
          label="Receita atribuída"
          value={money(totals.revenueCents)}
          hint={`OS concluídas em até ${company.attributionWindowDays} dias`}
          icon={<TrendingUp size={17} />}
          tone="volt"
        />
      </div>

      {/* Publicos prontos */}
      <Card>
        <CardHeader
          title="Públicos prontos para acionar"
          description="Calculados agora, a partir do histórico de cada cliente."
          action={
            <Link
              href="/retencao"
              className="focus-ring rounded text-xs font-medium text-volt-400 hover:text-volt-300"
            >
              Ver detalhes
            </Link>
          }
        />
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {audiences
            .filter((audience) => audience.key !== "todos")
            .map((audience) => (
              <Link
                key={audience.key}
                href={`/campanhas?nova=1`}
                className="focus-ring rounded-xl border border-line bg-ink-850/60 p-4 transition-colors hover:border-ink-600"
              >
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <Users size={13} />
                  {audience.label}
                </p>
                <p className="mt-2.5 font-display text-2xl font-bold text-white">
                  {audience.customerIds.length}
                </p>
                <p className="mt-0.5 text-[0.7rem] text-volt-300">
                  {money(audience.opportunityCents)} em potencial
                </p>
              </Link>
            ))}
        </div>
      </Card>

      {campaigns.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Megaphone size={20} />}
            title="Nenhuma campanha criada"
            description="Crie uma campanha para um dos públicos acima e traga clientes antigos de volta."
            action={
              <ButtonLink href="/campanhas?nova=1" size="sm">
                Nova campanha
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {withMetrics.map(({ campaign, metrics }) => {
            const meta = statusOf(CAMPAIGN_STATUS, campaign.status);
            const rate = Math.round(metrics.conversionRate * 100);

            return (
              <Card key={campaign.id} className="flex flex-col">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
                  <div className="min-w-0">
                    <Link
                      href={`/campanhas/${campaign.id}`}
                      className="focus-ring rounded text-sm font-semibold text-white hover:text-volt-300"
                    >
                      {campaign.name}
                    </Link>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      <span>{CHANNEL_LABEL[campaign.channel] ?? campaign.channel}</span>
                      <span aria-hidden="true">·</span>
                      <span>{AUDIENCE_LABEL[campaign.audience] ?? campaign.audience}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {metrics.participants}{" "}
                        {metrics.participants === 1 ? "participante" : "participantes"}
                      </span>
                      {campaign.sentAt && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>enviada em {dateFull(campaign.sentAt)}</span>
                        </>
                      )}
                      {campaign.scheduledAt && !campaign.sentAt && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>programada para {dateFull(campaign.scheduledAt)}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <Badge tone={meta.tone} dot>
                    {meta.label}
                  </Badge>
                </div>

                <div className="flex-1 p-5">
                  <p className="rounded-xl border border-line bg-ink-850 px-3.5 py-3 text-sm leading-relaxed text-soft">
                    {campaign.message}
                  </p>

                  {metrics.sent > 0 ? (
                    <div className="mt-5 space-y-3">
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="rounded-xl bg-ink-850 py-3">
                          <p className="font-display text-lg font-bold text-white">
                            {metrics.sent}
                          </p>
                          <p className="text-[0.65rem] text-muted">enviadas</p>
                        </div>
                        <div className="rounded-xl bg-ink-850 py-3">
                          <p className="font-display text-lg font-bold text-white">
                            {metrics.answered}
                          </p>
                          <p className="text-[0.65rem] text-muted">responderam</p>
                        </div>
                        <div className="rounded-xl bg-volt-400/10 py-3">
                          <p className="font-display text-lg font-bold text-volt-300">
                            {metrics.converted}
                          </p>
                          <p className="text-[0.65rem] text-muted">voltaram</p>
                        </div>
                      </div>

                      <div>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="text-muted">Conversão</span>
                          <span className="font-medium text-white">{rate}%</span>
                        </div>
                        <Meter value={rate} />
                      </div>

                      <p className="border-t border-line pt-3 text-sm">
                        <span className="text-muted">Receita atribuída: </span>
                        <span className="font-semibold text-volt-300">
                          {money(metrics.revenueCents)}
                        </span>
                      </p>
                    </div>
                  ) : (
                    <p className="mt-5 border-t border-line pt-3 text-xs text-muted">
                      {metrics.participants} {metrics.participants === 1 ? "cliente" : "clientes"}{" "}
                      no público. Nenhum envio registrado ainda —{" "}
                      <Link
                        href={`/campanhas/${campaign.id}`}
                        className="text-volt-400 hover:text-volt-300"
                      >
                        abrir campanha
                      </Link>
                      .
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
