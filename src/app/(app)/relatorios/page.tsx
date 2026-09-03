import type { Metadata } from "next";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CircleDollarSign,
  Info,
  Minus,
  Repeat2,
  Users,
} from "lucide-react";

import { BarChart, DonutChart, LineChart } from "@/components/charts";
import { Card, CardBody, CardHeader, EmptyState, Meter, Table, Td, Th, Tr } from "@/components/ui";
import { PageHeader, StatCard } from "@/components/ui/page";
import { requirePermission } from "@/lib/authorize";
import { dateFull, money, moneyCompact } from "@/lib/format";
import { buildReport, compare, resolvePeriod, type Comparison } from "@/lib/reports";

export const metadata: Metadata = { title: "Relatórios" };

import { PeriodFilter } from "./PeriodFilter";

const ORIGIN_COLORS = ["#12E29B", "#38BDF8", "#FBBF24", "#FB7185", "#A78BFA", "#33445A"];

const iso = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Linha de comparacao com o periodo anterior.
 *
 * Quando o periodo anterior foi zero nao existe percentual honesto, entao a
 * variacao aparece em palavras em vez de um numero inventado.
 */
function Delta({
  data,
  format,
}: {
  data: Comparison;
  format: (value: number) => string;
}) {
  const subiu = data.diff > 0;
  const parado = data.diff === 0;
  const Icon = parado ? Minus : subiu ? ArrowUpRight : ArrowDownRight;
  const tone = parado ? "text-muted" : subiu ? "text-volt-300" : "text-rose-300";

  return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.7rem]">
      <span className={`inline-flex items-center gap-0.5 font-medium ${tone}`}>
        <Icon size={12} />
        {parado
          ? "sem variação"
          : data.percent === null
            ? "sem base anterior"
            : `${data.percent > 0 ? "+" : ""}${data.percent.toFixed(1)}%`}
      </span>
      <span className="text-muted">
        {parado ? "" : `${format(Math.abs(data.diff))} · `}antes {format(data.previous)}
      </span>
    </span>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string }>;
}) {
  // Sem esta permissao a pagina nem carrega — a trava e do servidor.
  const { company } = await requirePermission("reports.finance");

  // O periodo vem da URL, mas nada dele e usado sem passar por `resolvePeriod`,
  // que valida chave e datas. A empresa vem da sessao.
  const period = resolvePeriod(await searchParams);
  const report = await buildReport(company.id, period);

  const { summary, previousSummary: antes, previous } = report;
  const maxServiceRevenue = report.services[0]?.revenueCents ?? 1;
  const paymentTotal = report.payments.reduce((sum, row) => sum + row.revenueCents, 0);

  const intervalo = `${dateFull(period.from)} a ${dateFull(period.to)}`;
  const intervaloAnterior = `${dateFull(previous.from)} a ${dateFull(previous.to)}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Crescimento"
        title="Relatórios"
        description="Os números que mostram se a operação está crescendo — e de onde vem o crescimento."
      />

      <PeriodFilter active={period.key} from={iso(period.from)} to={iso(period.to)} />

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span className="font-medium text-soft">{period.label}:</span>
        <span>{intervalo}</span>
        <span aria-hidden="true">·</span>
        <span>
          comparado com <span className="text-soft">{intervaloAnterior}</span>
        </span>
      </p>

      {summary.empty ? (
        <Card>
          <EmptyState
            icon={<BarChart3 size={20} />}
            title="Nenhum dado neste período"
            description={`Não houve ordem de serviço concluída nem cliente novo entre ${intervalo}. Escolha outro período para ver os números.`}
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Faturamento"
              value={money(summary.revenueCents)}
              hint={<Delta data={compare(summary.revenueCents, antes.revenueCents)} format={money} />}
              icon={<CircleDollarSign size={17} />}
              tone="volt"
            />
            <StatCard
              label="OS concluídas"
              value={summary.orders}
              hint={
                <Delta data={compare(summary.orders, antes.orders)} format={(v) => String(v)} />
              }
              icon={<BarChart3 size={17} />}
            />
            <StatCard
              label="Ticket médio"
              value={money(summary.averageTicketCents)}
              hint={
                <Delta
                  data={compare(summary.averageTicketCents, antes.averageTicketCents)}
                  format={money}
                />
              }
            />
            <StatCard
              label="Taxa de recompra"
              value={`${(summary.repurchaseRate * 100).toFixed(1)}%`}
              hint={`${summary.returningCustomers} de ${summary.customersServed} clientes atendidos voltaram mais de uma vez`}
              icon={<Repeat2 size={17} />}
              tone={summary.repurchaseRate >= 0.5 ? "volt" : "warning"}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Clientes atendidos"
              value={summary.customersServed}
              hint={
                <Delta
                  data={compare(summary.customersServed, antes.customersServed)}
                  format={(v) => String(v)}
                />
              }
              icon={<Users size={17} />}
            />
            <StatCard
              label="Clientes novos"
              value={summary.newCustomers}
              hint={
                <Delta
                  data={compare(summary.newCustomers, antes.newCustomers)}
                  format={(v) => String(v)}
                />
              }
            />
            <StatCard
              label="Clientes que voltaram"
              value={summary.returningCustomers}
              hint={
                <Delta
                  data={compare(summary.returningCustomers, antes.returningCustomers)}
                  format={(v) => String(v)}
                />
              }
            />
            <StatCard
              label="Dias no período"
              value={period.days}
              hint={`${moneyCompact(
                period.days > 0 ? Math.round(summary.revenueCents / period.days) : 0,
              )} por dia, em média`}
            />
          </div>

          <Card>
            <CardHeader
              title="Faturamento no período"
              description={`Somente ordens de serviço concluídas, agrupadas por ${
                period.days <= 31 ? "dia" : period.days <= 120 ? "semana" : "mês"
              }.`}
            />
            {report.revenue.length === 0 ? (
              <EmptyState
                icon={<CircleDollarSign size={20} />}
                title="Sem ordens concluídas"
                description="Nenhuma OS foi concluída neste período."
              />
            ) : (
              <CardBody>
                <LineChart
                  data={report.revenue}
                  format={(value) => moneyCompact(value)}
                  height={220}
                />
              </CardBody>
            )}
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Serviços que mais faturam"
                description="Por receita gerada em OS concluídas no período."
              />
              {report.services.length === 0 ? (
                <EmptyState icon={<BarChart3 size={20} />} title="Sem serviços concluídos" />
              ) : (
                <CardBody className="space-y-4">
                  {report.services.slice(0, 8).map((service) => (
                    <div key={service.name}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate text-soft">{service.name}</span>
                        <span className="shrink-0 font-medium text-white">
                          {money(service.revenueCents)}
                        </span>
                      </div>
                      <Meter value={service.revenueCents} max={maxServiceRevenue} />
                      <p className="mt-1 text-[0.68rem] text-muted">
                        {service.count} {service.count === 1 ? "venda" : "vendas"}
                      </p>
                    </div>
                  ))}
                </CardBody>
              )}
            </Card>

            <div className="space-y-5">
              <Card>
                <CardHeader
                  title="Origem dos clientes novos"
                  description="De onde vem quem chegou no período."
                />
                <CardBody>
                  {report.origins.length === 0 ? (
                    <EmptyState
                      icon={<Users size={20} />}
                      title="Nenhum cliente novo"
                      description="Ninguém foi cadastrado neste período."
                    />
                  ) : (
                    <DonutChart
                      data={report.origins.map((origin, index) => ({
                        ...origin,
                        color: ORIGIN_COLORS[index % ORIGIN_COLORS.length],
                      }))}
                      centerValue={String(summary.newCustomers)}
                      centerLabel="clientes"
                    />
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="Clientes novos no período"
                  description="Cadastros, na mesma granularidade do faturamento."
                />
                <CardBody>
                  {report.newCustomers.length === 0 ? (
                    <p className="text-sm text-muted">Nenhum cadastro neste período.</p>
                  ) : (
                    <BarChart data={report.newCustomers} height={140} />
                  )}
                </CardBody>
              </Card>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Formas de pagamento"
                description="Somente ordens concluídas no período."
              />
              {report.payments.length === 0 ? (
                <EmptyState
                  icon={<CircleDollarSign size={20} />}
                  title="Sem pagamentos registrados"
                />
              ) : (
                <Table className="min-w-0">
                  <thead>
                    <tr>
                      <Th>Forma</Th>
                      <Th className="text-right">Ordens</Th>
                      <Th className="text-right">Valor</Th>
                      <Th className="text-right">Participação</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.payments.map((row) => (
                      <Tr key={row.method}>
                        <Td className="text-sm text-soft">{row.label}</Td>
                        <Td className="text-right text-sm text-soft">{row.orders}</Td>
                        <Td className="text-right text-sm font-medium text-white">
                          {money(row.revenueCents)}
                        </Td>
                        <Td className="text-right text-sm text-volt-300">
                          {paymentTotal > 0
                            ? `${Math.round((row.revenueCents / paymentTotal) * 100)}%`
                            : "—"}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Clientes por valor gerado"
                description="Receita real de OS concluídas no período."
              />
              {report.ranking.length === 0 ? (
                <EmptyState icon={<Users size={20} />} title="Nenhum cliente atendido" />
              ) : (
                <Table className="min-w-0">
                  <thead>
                    <tr>
                      <Th>Cliente</Th>
                      <Th className="text-right">OS</Th>
                      <Th className="text-right">Ticket médio</Th>
                      <Th className="text-right">Total</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.ranking.map((customer) => (
                      <Tr key={customer.id}>
                        <Td className="text-sm text-white">{customer.name}</Td>
                        <Td className="text-right text-sm text-soft">{customer.orders}</Td>
                        <Td className="text-right text-sm text-soft">
                          {money(customer.averageTicketCents)}
                        </Td>
                        <Td className="text-right text-sm font-medium text-white">
                          {money(customer.revenueCents)}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          </div>
        </>
      )}

      {/* As definicoes ficam a vista: numero sem formula nao se confere. */}
      <Card>
        <CardBody className="space-y-2 text-[0.7rem] leading-relaxed text-muted">
          <p className="flex items-center gap-1.5 font-semibold text-soft">
            <Info size={13} />
            Como estes números são calculados
          </p>
          <p>
            <strong className="text-soft">Faturamento:</strong> soma do valor recebido em ordens de
            serviço com status <em>concluída</em> e data de conclusão dentro do período. OS abertas,
            canceladas e orçamentos não entram.
          </p>
          <p>
            <strong className="text-soft">Taxa de recompra:</strong> clientes com mais de uma OS
            concluída no período ÷ clientes com ao menos uma OS concluída no período.
          </p>
          <p>
            <strong className="text-soft">Comparação:</strong> o período imediatamente anterior, de
            mesma duração ({period.days} {period.days === 1 ? "dia" : "dias"}).
          </p>
          <p>
            <strong className="text-soft">Clientes novos e origem:</strong> clientes cadastrados no
            período. Cadastro sem origem informada aparece como &quot;Não informado&quot;.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
