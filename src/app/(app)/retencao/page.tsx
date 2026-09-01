import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, MessageCircle, Repeat2, TrendingUp } from "lucide-react";

import { DonutChart } from "@/components/charts";
import {
  Avatar,
  Badge,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui";
import { OpportunityBanner, PageHeader, StatCard } from "@/components/ui/page";
import { dateFull, money, phoneMask, whatsappLink } from "@/lib/format";
import {
  STAGE_HINT,
  STAGE_LABEL,
  STAGE_TONE,
  type RetentionCustomer,
  type RetentionStage,
  getRetention,
} from "@/lib/retention";
import { requireContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Retenção" };

const STAGE_COLOR: Record<RetentionStage, string> = {
  em_dia: "#34D399",
  atencao: "#FBBF24",
  em_risco: "#FB7185",
  inativo: "#33445A",
  novo: "#38BDF8",
};

const TABS: { key: string; label: string; stages: RetentionStage[] }[] = [
  { key: "prioridade", label: "Prioridade de contato", stages: ["em_risco", "inativo", "atencao"] },
  { key: "em_risco", label: "Em risco", stages: ["em_risco"] },
  { key: "inativo", label: "Inativos", stages: ["inativo"] },
  { key: "atencao", label: "Atenção", stages: ["atencao"] },
  { key: "em_dia", label: "Em dia", stages: ["em_dia"] },
  { key: "novo", label: "Novos", stages: ["novo"] },
];

function messageFor(customer: RetentionCustomer, companyName: string) {
  const firstName = customer.name.split(" ")[0];
  const vehicle = customer.vehicleLabel ?? "seu carro";

  if (customer.stage === "inativo") {
    return `Olá ${firstName}! Aqui é da ${companyName}. Faz um tempo que não cuidamos do ${vehicle} e sentimos sua falta. Preparei uma condição especial para trazer ele de volta ao brilho — quer que eu reserve um horário?`;
  }
  if (customer.stage === "em_risco") {
    return `Olá ${firstName}! Aqui é da ${companyName}. Notei que já se passaram ${customer.daysSinceLastVisit} dias desde o último serviço no ${vehicle}. Quer agendar a manutenção antes que a proteção perca o efeito?`;
  }
  return `Olá ${firstName}! Aqui é da ${companyName}. O ${vehicle} está chegando no período ideal de manutenção. Tenho horários disponíveis esta semana — quer garantir o seu?`;
}

export default async function RetentionPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const { company } = await requireContext();
  const tabKey = (await searchParams).aba ?? "prioridade";
  const tab = TABS.find((item) => item.key === tabKey) ?? TABS[0];

  const retention = await getRetention(company.id);

  const list = tab.stages
    .flatMap((stage) => retention.byStage[stage])
    .sort((a, b) => b.overdueDays - a.overdueDays || b.opportunityCents - a.opportunityCents);

  const donut = (["em_dia", "atencao", "em_risco", "inativo", "novo"] as RetentionStage[])
    .map((stage) => ({
      label: STAGE_LABEL[stage],
      value: retention.counts[stage],
      color: STAGE_COLOR[stage],
    }))
    .filter((slice) => slice.value > 0);

  const recoverableRevenue = retention.opportunityCents;
  const inRiskRevenue = [...retention.byStage.em_risco, ...retention.byStage.inativo].reduce(
    (sum, customer) => sum + customer.opportunityCents,
    0,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Crescimento"
        title="Retenção"
        description="Quem deveria estar voltando e não voltou. Esta é a lista que transforma histórico em faturamento."
        actions={
          <ButtonLink href="/campanhas" size="md">
            <MessageCircle size={16} />
            Criar campanha
          </ButtonLink>
        }
      />

      <OpportunityBanner
        title={`${money(recoverableRevenue)} podem voltar para o caixa`}
        description={
          <>
            Cálculo baseado no ticket médio histórico de cada cliente que passou do ciclo ideal de
            retorno. São <strong className="text-white">{retention.needsContactCount}</strong>{" "}
            clientes esperando um contato seu.
          </>
        }
        action={
          <ButtonLink href="/retencao?aba=prioridade">
            Ver prioridades
            <ArrowRight size={16} />
          </ButtonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Clientes em risco"
          value={retention.counts.em_risco}
          hint="Muito atrasados no retorno"
          icon={<AlertTriangle size={17} />}
          tone="danger"
        />
        <StatCard
          label="Clientes inativos"
          value={retention.counts.inativo}
          hint={`Sem retorno há mais de ${company.inactiveAfterDays} dias`}
          tone="warning"
        />
        <StatCard
          label="Receita a recuperar"
          value={money(inRiskRevenue)}
          hint="Risco + inativos"
          icon={<TrendingUp size={17} />}
          tone="volt"
        />
        <StatCard
          label="Carteira em dia"
          value={`${Math.round((retention.counts.em_dia / (retention.customers.length || 1)) * 100)}%`}
          hint={`${retention.counts.em_dia} de ${retention.customers.length} clientes`}
          icon={<Repeat2 size={17} />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader
            title="Distribuição da carteira"
            description={`Ciclo padrão de ${company.retentionWindowDays} dias.`}
          />
          <div className="p-5">
            {donut.length === 0 ? (
              <EmptyState icon={<Repeat2 size={20} />} title="Sem clientes ainda" />
            ) : (
              <DonutChart
                data={donut}
                centerValue={String(retention.customers.length)}
                centerLabel="clientes"
              />
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Como o AUTOVOLT calcula"
            description="Transparência sobre a régua de retenção."
          />
          <ul className="divide-y divide-line">
            {(["em_dia", "atencao", "em_risco", "inativo", "novo"] as RetentionStage[]).map(
              (stage) => (
                <li key={stage} className="flex items-start gap-4 px-5 py-3.5">
                  <Badge tone={STAGE_TONE[stage]} dot className="mt-0.5 shrink-0">
                    {STAGE_LABEL[stage]}
                  </Badge>
                  <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted">
                    {STAGE_HINT[stage]}
                  </p>
                  <span className="shrink-0 font-display text-sm font-bold text-white">
                    {retention.counts[stage]}
                  </span>
                </li>
              ),
            )}
          </ul>
          <p className="border-t border-line px-5 py-3.5 text-[0.7rem] leading-relaxed text-muted">
            O ciclo de cada cliente vem da recorrência do serviço que ele contratou (definida em{" "}
            <Link href="/servicos" className="text-volt-400 hover:text-volt-300">
              Serviços
            </Link>
            ). Sem recorrência definida, vale o padrão da empresa, ajustável em{" "}
            <Link href="/configuracoes" className="text-volt-400 hover:text-volt-300">
              Configurações
            </Link>
            .
          </p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap gap-2 border-b border-line p-4">
          {TABS.map((item) => {
            const count = item.stages.reduce((sum, stage) => sum + retention.counts[stage], 0);
            const active = item.key === tab.key;
            return (
              <Link
                key={item.key}
                href={`/retencao?aba=${item.key}`}
                className={`focus-ring rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-volt-400 text-ink-950"
                    : "border border-line bg-ink-850 text-soft hover:border-ink-600 hover:text-white"
                }`}
              >
                {item.label}
                <span className={active ? "ml-1.5 opacity-70" : "ml-1.5 text-muted"}>{count}</span>
              </Link>
            );
          })}
        </div>

        {list.length === 0 ? (
          <EmptyState
            icon={<Repeat2 size={20} />}
            title="Nenhum cliente nesta lista"
            description="Boa notícia: ninguém aqui precisa de contato agora."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Cliente</Th>
                <Th>Veículo</Th>
                <Th>Último serviço</Th>
                <Th>Retorno ideal</Th>
                <Th className="text-right">Ticket médio</Th>
                <Th>Situação</Th>
                <Th className="text-right">Ação</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((customer) => (
                <Tr key={customer.id}>
                  <Td>
                    <Link
                      href={`/clientes/${customer.id}`}
                      className="focus-ring flex items-center gap-3 rounded"
                    >
                      <Avatar name={customer.name} size={34} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-white">
                          {customer.name}
                        </span>
                        <span className="block text-xs text-muted">
                          {phoneMask(customer.phone)}
                        </span>
                      </span>
                    </Link>
                  </Td>
                  <Td className="text-sm text-soft">{customer.vehicleLabel ?? "—"}</Td>
                  <Td className="text-sm">
                    {customer.lastVisitAt ? (
                      <>
                        <span className="block text-soft">{dateFull(customer.lastVisitAt)}</span>
                        <span className="block text-xs text-muted">
                          há {customer.daysSinceLastVisit} dias · {customer.visits}{" "}
                          {customer.visits === 1 ? "visita" : "visitas"}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted">Nunca atendido</span>
                    )}
                  </Td>
                  <Td className="text-sm">
                    {customer.dueAt ? (
                      <>
                        <span className="block text-soft">{dateFull(customer.dueAt)}</span>
                        {customer.overdueDays > 0 && (
                          <span className="block text-xs text-rose-300">
                            {customer.overdueDays} dias de atraso
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </Td>
                  <Td className="text-right text-sm font-medium text-white">
                    {money(customer.averageTicketCents)}
                  </Td>
                  <Td>
                    <Badge tone={STAGE_TONE[customer.stage]} dot>
                      {STAGE_LABEL[customer.stage]}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    {customer.phone ? (
                      <a
                        href={whatsappLink(customer.phone, messageFor(customer, company.name))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="focus-ring inline-flex items-center gap-1.5 rounded-xl bg-volt-400/12 px-3 py-1.5 text-xs font-semibold text-volt-300 transition-colors hover:bg-volt-400/20"
                      >
                        <MessageCircle size={13} />
                        Chamar
                      </a>
                    ) : (
                      <span className="text-xs text-muted">Sem telefone</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
