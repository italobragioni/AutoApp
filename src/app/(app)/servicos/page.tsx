import type { Metadata } from "next";
import { Clock, Plus, Repeat2, Sparkles, TrendingUp } from "lucide-react";

import { Badge, ButtonLink, Card, CardHeader, EmptyState } from "@/components/ui";
import { PageHeader, StatCard } from "@/components/ui/page";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { SERVICE_CATEGORY } from "@/lib/labels";
import { topServices } from "@/lib/metrics";
import { requireContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Serviços" };

export default async function ServicesPage() {
  const { company } = await requireContext();

  const [services, ranking] = await Promise.all([
    db.serviceItem.findMany({
      where: { companyId: company.id },
      orderBy: [{ category: "asc" }, { basePrice: "desc" }],
      include: { _count: { select: { workOrderItems: true } } },
    }),
    topServices(company.id, 180),
  ]);

  const revenueByName = new Map(ranking.map((item) => [item.name, item]));

  const grouped = services.reduce<Record<string, typeof services>>((acc, service) => {
    (acc[service.category] ??= []).push(service);
    return acc;
  }, {});

  const active = services.filter((service) => service.active);
  const averagePrice =
    active.length > 0
      ? Math.round(active.reduce((sum, service) => sum + service.basePrice, 0) / active.length)
      : 0;
  const recurring = services.filter((service) => service.recurrenceDays);
  const bestSeller = ranking[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operação"
        title="Serviços"
        description="Seu catálogo: preço, duração e — o mais importante — de quanto em quanto tempo cada serviço precisa ser refeito."
        actions={
          <ButtonLink href="/servicos?novo=1" size="md">
            <Plus size={16} />
            Novo serviço
          </ButtonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Serviços ativos" value={active.length} hint={`${services.length} no catálogo`} icon={<Sparkles size={17} />} />
        <StatCard label="Preço médio" value={money(averagePrice)} hint="Base do catálogo" />
        <StatCard
          label="Com ciclo de retorno"
          value={recurring.length}
          hint="Alimentam o motor de retenção"
          icon={<Repeat2 size={17} />}
          tone="volt"
        />
        <StatCard
          label="Mais vendido (6 meses)"
          value={bestSeller ? money(bestSeller.revenueCents) : "—"}
          hint={bestSeller ? bestSeller.name : "Sem dados ainda"}
          icon={<TrendingUp size={17} />}
        />
      </div>

      <div className="rounded-2xl border border-line bg-ink-900 p-5">
        <p className="text-sm font-semibold text-white">Por que o ciclo de retorno importa</p>
        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted">
          O campo <strong className="text-soft">recorrência</strong> diz de quanto em quanto tempo
          cada serviço precisa ser refeito. É a partir dele que o AUTOVOLT calcula quando cada
          cliente deveria voltar e monta, sozinho, as listas de recuperação em{" "}
          <strong className="text-soft">Retenção</strong>.
        </p>
      </div>

      {services.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Sparkles size={20} />}
            title="Catálogo vazio"
            description="Cadastre seus serviços com preço, duração e ciclo de recorrência para começar."
          />
        </Card>
      ) : (
        Object.entries(grouped).map(([category, list]) => (
          <Card key={category}>
            <CardHeader
              title={SERVICE_CATEGORY[category] ?? category}
              description={`${list.length} ${list.length === 1 ? "serviço" : "serviços"} nesta categoria.`}
            />
            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((service) => {
                const performance = revenueByName.get(service.name);
                return (
                  <article
                    key={service.id}
                    className="flex flex-col rounded-xl border border-line bg-ink-850/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-white">{service.name}</h4>
                      {!service.active && <Badge tone="muted">Inativo</Badge>}
                    </div>

                    {service.description && (
                      <p className="mt-1.5 text-xs leading-relaxed text-muted">
                        {service.description}
                      </p>
                    )}

                    <p className="mt-4 font-display text-xl font-bold text-white">
                      {money(service.basePrice)}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-ink-800 px-2 py-1 text-[0.7rem] text-soft">
                        <Clock size={12} className="text-muted" />
                        {service.durationMin >= 60
                          ? `${(service.durationMin / 60).toFixed(service.durationMin % 60 === 0 ? 0 : 1)}h`
                          : `${service.durationMin}min`}
                      </span>
                      {service.recurrenceDays && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-volt-400/10 px-2 py-1 text-[0.7rem] text-volt-300">
                          <Repeat2 size={12} />
                          a cada {service.recurrenceDays} dias
                        </span>
                      )}
                    </div>

                    <p className="mt-4 border-t border-line pt-3 text-[0.7rem] text-muted">
                      {performance ? (
                        <>
                          <span className="font-medium text-soft">{performance.count}</span> vendas
                          em 6 meses ·{" "}
                          <span className="font-medium text-soft">
                            {money(performance.revenueCents)}
                          </span>
                        </>
                      ) : (
                        "Ainda sem vendas registradas"
                      )}
                    </p>
                  </article>
                );
              })}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
