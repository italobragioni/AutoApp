import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone, MessageCircle, Plus, Target, TrendingUp, Users } from "lucide-react";

import { Badge, ButtonLink, Card, CardHeader, EmptyState, Meter } from "@/components/ui";
import { PageHeader, StatCard } from "@/components/ui/page";
import { db } from "@/lib/db";
import { dateFull, money } from "@/lib/format";
import { CAMPAIGN_STATUS, CHANNEL_LABEL, statusOf } from "@/lib/labels";
import { AUDIENCE_LABEL, audienceFor, getRetention } from "@/lib/retention";
import { requireContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Campanhas" };

export default async function CampaignsPage() {
  const { company } = await requireContext();

  const [campaigns, retention] = await Promise.all([
    db.campaign.findMany({
      where: { companyId: company.id },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    getRetention(company.id),
  ]);

  const sent = campaigns.filter((campaign) => campaign.status === "enviada");
  const totalSent = sent.reduce((sum, campaign) => sum + campaign.sentCount, 0);
  const totalConverted = sent.reduce((sum, campaign) => sum + campaign.convertedCount, 0);
  const totalRevenue = sent.reduce((sum, campaign) => sum + campaign.revenueCents, 0);
  const conversionRate = totalSent > 0 ? Math.round((totalConverted / totalSent) * 100) : 0;

  // Públicos calculados ao vivo pelo motor de retenção.
  const audiences = ["em_risco", "inativos", "sem_retorno", "vip", "todos"].map((key) => ({
    key,
    label: AUDIENCE_LABEL[key],
    size: audienceFor(retention, key).length,
    value: audienceFor(retention, key).reduce((sum, customer) => sum + customer.opportunityCents, 0),
  }));

  return (
    <div className="space-y-6">
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
        <StatCard label="Campanhas enviadas" value={sent.length} hint={`${campaigns.length} no total`} icon={<Megaphone size={17} />} />
        <StatCard label="Mensagens disparadas" value={totalSent} hint="Somando todas as campanhas" icon={<MessageCircle size={17} />} />
        <StatCard label="Taxa de conversão" value={`${conversionRate}%`} hint={`${totalConverted} clientes voltaram`} icon={<Target size={17} />} tone="volt" />
        <StatCard label="Receita gerada" value={money(totalRevenue)} hint="Faturamento recuperado" icon={<TrendingUp size={17} />} tone="volt" />
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
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
          {audiences.map((audience) => (
            <div key={audience.key} className="rounded-xl border border-line bg-ink-850/60 p-4">
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <Users size={13} />
                {audience.label}
              </p>
              <p className="mt-2.5 font-display text-2xl font-bold text-white">{audience.size}</p>
              <p className="mt-0.5 text-[0.7rem] text-volt-300">{money(audience.value)} em potencial</p>
            </div>
          ))}
        </div>
      </Card>

      {campaigns.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Megaphone size={20} />}
            title="Nenhuma campanha criada"
            description="Crie uma campanha para um dos públicos acima e traga clientes antigos de volta."
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {campaigns.map((campaign) => {
            const meta = statusOf(CAMPAIGN_STATUS, campaign.status);
            const rate =
              campaign.sentCount > 0
                ? Math.round((campaign.convertedCount / campaign.sentCount) * 100)
                : 0;

            return (
              <Card key={campaign.id} className="flex flex-col">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white">{campaign.name}</h3>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      <span>{CHANNEL_LABEL[campaign.channel] ?? campaign.channel}</span>
                      <span aria-hidden="true">·</span>
                      <span>{AUDIENCE_LABEL[campaign.audience] ?? campaign.audience}</span>
                      {campaign.sentAt && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>enviada em {dateFull(campaign.sentAt)}</span>
                        </>
                      )}
                      {campaign.scheduledAt && !campaign.sentAt && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>agendada para {dateFull(campaign.scheduledAt)}</span>
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
                  <p className="mt-2 text-[0.68rem] text-muted">
                    As variáveis <code className="text-soft">{"{nome}"}</code> e{" "}
                    <code className="text-soft">{"{veiculo}"}</code> são substituídas por cliente
                    no envio.
                  </p>

                  {campaign.status === "enviada" ? (
                    <div className="mt-5 space-y-3">
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="rounded-xl bg-ink-850 py-3">
                          <p className="font-display text-lg font-bold text-white">
                            {campaign.sentCount}
                          </p>
                          <p className="text-[0.65rem] text-muted">enviadas</p>
                        </div>
                        <div className="rounded-xl bg-ink-850 py-3">
                          <p className="font-display text-lg font-bold text-white">
                            {campaign.answeredCount}
                          </p>
                          <p className="text-[0.65rem] text-muted">responderam</p>
                        </div>
                        <div className="rounded-xl bg-volt-400/10 py-3">
                          <p className="font-display text-lg font-bold text-volt-300">
                            {campaign.convertedCount}
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
                        <span className="text-muted">Receita gerada: </span>
                        <span className="font-semibold text-volt-300">
                          {money(campaign.revenueCents)}
                        </span>
                      </p>
                    </div>
                  ) : (
                    <p className="mt-5 border-t border-line pt-3 text-xs text-muted">
                      {campaign.status === "agendada"
                        ? "Aguardando a data de envio."
                        : "Rascunho — defina o público e dispare quando quiser."}
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
