import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  MessageCircle,
  Repeat2,
  TrendingUp,
} from "lucide-react";

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
import { attachContacts, type RetentionCustomerWithContact } from "@/lib/contacts";
import { dateFull, dateShort, money, phoneMask, whatsappLink } from "@/lib/format";
import { CONTACT_CHANNEL, CONTACT_OUTCOME, statusOf } from "@/lib/labels";
import {
  STAGE_HINT,
  STAGE_LABEL,
  STAGE_TONE,
  type RetentionCustomer,
  type RetentionStage,
  getRetention,
} from "@/lib/retention";
import { requireContext } from "@/lib/tenant";

import { RegisterContact } from "./ContactActions";

export const metadata: Metadata = { title: "Retenção" };

const STAGE_COLOR: Record<RetentionStage, string> = {
  em_dia: "#34D399",
  atencao: "#FBBF24",
  em_risco: "#FB7185",
  inativo: "#33445A",
  novo: "#38BDF8",
};

/**
 * Abas da lista.
 *
 * "prioridade" e "cooldown" sao as duas metades da fila de contato: quem
 * precisa ser chamado agora e quem ja foi chamado ha pouco. As abas por
 * estagio continuam mostrando a carteira inteira — um contato registrado nao
 * tira ninguem do motor de retencao.
 */
const TABS: { key: string; label: string; stages?: RetentionStage[] }[] = [
  { key: "prioridade", label: "Prioridade de contato" },
  { key: "cooldown", label: "Aguardando retorno" },
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

/** Coluna "Último contato": data, resultado e o cooldown quando ativo. */
function ContactCell({ customer }: { customer: RetentionCustomerWithContact }) {
  const { last, inCooldown, nextContactAt, cooldownDaysLeft } = customer.contact;

  if (!last) {
    return <span className="text-xs text-muted">Nenhum contato registrado</span>;
  }

  const outcome = statusOf(CONTACT_OUTCOME, last.outcome);

  return (
    <div className="space-y-1">
      <span className="block text-sm text-soft">{dateFull(last.at)}</span>
      <span className="block text-xs text-muted">
        {CONTACT_CHANNEL[last.channel] ?? last.channel}
        {last.byName ? ` · ${last.byName.split(" ")[0]}` : ""}
      </span>
      <Badge tone={outcome.tone}>{outcome.label}</Badge>
      {inCooldown && nextContactAt && (
        <span className="flex items-center gap-1 text-[0.68rem] text-sky-300">
          <Clock size={11} className="shrink-0" />
          Aguardando {cooldownDaysLeft} {cooldownDaysLeft === 1 ? "dia" : "dias"} · volta em{" "}
          {dateShort(nextContactAt)}
        </span>
      )}
    </div>
  );
}

export default async function RetentionPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string }>;
}) {
  const { company } = await requireContext();
  const tabKey = (await searchParams).aba ?? "prioridade";
  const tab = TABS.find((item) => item.key === tabKey) ?? TABS[0];

  // O motor de retencao roda exatamente como antes; `attachContacts` so anexa
  // o historico de contato por cima do resultado dele.
  const retention = await getRetention(company.id);
  const board = await attachContacts(retention, company.id, company.contactCooldownDays);

  function listFor(key: string) {
    const item = TABS.find((entry) => entry.key === key);
    if (key === "prioridade") return board.priority;
    if (key === "cooldown") return board.inCooldown;
    return (item?.stages ?? [])
      .flatMap((stage) => board.byStage[stage])
      .sort((a, b) => b.overdueDays - a.overdueDays || b.opportunityCents - a.opportunityCents);
  }

  const list = listFor(tab.key);

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
            retorno. São <strong className="text-white">{board.priority.length}</strong> clientes
            esperando um contato seu
            {board.inCooldown.length > 0 && (
              <>
                {" "}
                — outros <strong className="text-white">{board.inCooldown.length}</strong> já foram
                contatados nos últimos {company.contactCooldownDays} dias
              </>
            )}
            .
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
          label="Contatar agora"
          value={board.priority.length}
          hint={
            board.inCooldown.length > 0
              ? `${board.inCooldown.length} aguardando retorno`
              : `Cooldown de ${company.contactCooldownDays} dias`
          }
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
            . Registrar um contato não muda o estágio do cliente: apenas tira ele da fila de
            prioridade por {company.contactCooldownDays} dias.
          </p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap gap-2 border-b border-line p-4">
          {TABS.map((item) => {
            const count = listFor(item.key).length;
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
            title={
              tab.key === "cooldown" ? "Ninguém aguardando retorno" : "Nenhum cliente nesta lista"
            }
            description={
              tab.key === "cooldown"
                ? "Aqui ficam os clientes já contatados, durante o período de espera."
                : "Boa notícia: ninguém aqui precisa de contato agora."
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Cliente</Th>
                <Th>Veículo</Th>
                <Th>Último serviço</Th>
                <Th>Retorno ideal</Th>
                <Th>Último contato</Th>
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
                  <Td>
                    <ContactCell customer={customer} />
                  </Td>
                  <Td>
                    <Badge tone={STAGE_TONE[customer.stage]} dot>
                      {STAGE_LABEL[customer.stage]}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap items-center justify-end gap-2">
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
                      <RegisterContact
                        customer={{ id: customer.id, name: customer.name }}
                        cooldownDays={company.contactCooldownDays}
                        compact
                      />
                    </div>
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
