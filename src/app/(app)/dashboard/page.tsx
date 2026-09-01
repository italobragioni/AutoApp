import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CircleDollarSign,
  FileText,
  Repeat2,
  Users,
  Wrench,
} from "lucide-react";

import { LineChart } from "@/components/charts";
import { Badge, Card, CardBody, CardHeader, ButtonLink, EmptyState } from "@/components/ui";
import { OpportunityBanner, PageHeader, StatCard } from "@/components/ui/page";
import { db } from "@/lib/db";
import { dateFull, money, moneyCompact, phoneMask, samePeriodHint, time, whatsappLink } from "@/lib/format";
import { APPOINTMENT_STATUS, WORK_ORDER_STATUS, statusOf } from "@/lib/labels";
import { endOfDay, getDashboardMetrics, revenueByMonth, startOfDay } from "@/lib/metrics";
import { STAGE_LABEL, getRetention } from "@/lib/retention";
import { requireContext } from "@/lib/tenant";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { company, user } = await requireContext();
  const companyId = company.id;

  const [metrics, revenue, retention, todayAgenda, activeOrders] = await Promise.all([
    getDashboardMetrics(companyId),
    revenueByMonth(companyId, 6),
    getRetention(companyId),
    db.appointment.findMany({
      where: {
        companyId,
        startsAt: { gte: startOfDay(), lte: endOfDay() },
        status: { not: "cancelado" },
      },
      orderBy: { startsAt: "asc" },
      include: {
        customer: { select: { name: true } },
        vehicle: { select: { brand: true, model: true, plate: true } },
        services: { include: { serviceItem: { select: { name: true, basePrice: true } } } },
      },
    }),
    db.workOrder.findMany({
      where: { companyId, status: { in: ["aberta", "em_andamento", "aguardando_retirada"] } },
      orderBy: { openedAt: "asc" },
      take: 5,
      include: {
        customer: { select: { name: true } },
        vehicle: { select: { brand: true, model: true } },
      },
    }),
  ]);

  const firstName = user.name.split(" ")[0];
  const priority = [...retention.byStage.em_risco, ...retention.byStage.inativo].slice(0, 5);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={dateFull(new Date())}
        title={`Olá, ${firstName}`}
        description={`Visão geral de ${company.name}. Tudo que precisa de atenção hoje está aqui.`}
        actions={
          <>
            <ButtonLink href="/agenda" variant="secondary" size="md">
              <CalendarDays size={16} />
              Ver agenda
            </ButtonLink>
            <ButtonLink href="/retencao" size="md">
              <Repeat2 size={16} />
              Oportunidades
            </ButtonLink>
          </>
        }
      />

      {/* A promessa do produto, transformada em número */}
      {retention.opportunityCents > 0 && (
        <OpportunityBanner
          title={`${moneyCompact(retention.opportunityCents)} em oportunidades de retorno`}
          description={
            <>
              <strong className="text-white">{retention.needsContactCount}</strong>{" "}
              {retention.needsContactCount === 1 ? "cliente passou" : "clientes passaram"} do ciclo ideal
              de retorno. Um contato hoje evita perder esse faturamento.
            </>
          }
          action={
            <ButtonLink href="/retencao">
              Recuperar clientes
              <ArrowRight size={16} />
            </ButtonLink>
          }
        />
      )}

      {/* Indicadores principais */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Faturamento do mês"
          value={money(metrics.revenueMonthCents)}
          delta={metrics.revenueDelta}
          hint={
            metrics.monthInProgress
              ? samePeriodHint(metrics.monthElapsedDays)
              : "vs. mês anterior"
          }
          icon={<CircleDollarSign size={17} />}
          tone="volt"
        />
        <StatCard
          label="Ticket médio"
          value={money(metrics.averageTicketCents)}
          hint={`${metrics.ordersMonth} ${metrics.ordersMonth === 1 ? "serviço" : "serviços"} no mês`}
          icon={<Wrench size={17} />}
        />
        <StatCard
          label="Agendamentos hoje"
          value={metrics.appointmentsToday}
          hint={`${metrics.appointmentsWeek} nos próximos 7 dias`}
          icon={<CalendarDays size={17} />}
        />
        <StatCard
          label="Orçamentos em aberto"
          value={metrics.openQuotes}
          hint={`${money(metrics.openQuotesValueCents)} aguardando resposta`}
          icon={<FileText size={17} />}
          tone={metrics.openQuotes > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Faturamento */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Faturamento dos últimos 6 meses"
            description={
              metrics.monthInProgress
                ? "Somente ordens concluídas. O mês atual ainda está em andamento."
                : "Somente ordens de serviço concluídas."
            }
            action={
              <Link
                href="/relatorios"
                className="focus-ring rounded text-xs font-medium text-volt-400 hover:text-volt-300"
              >
                Ver relatórios
              </Link>
            }
          />
          <CardBody>
            <LineChart data={revenue} format={(value) => moneyCompact(value)} />
          </CardBody>
        </Card>

        {/* Retencao resumida */}
        <Card>
          <CardHeader
            title="Saúde da carteira"
            description={`${retention.customers.length} clientes cadastrados.`}
          />
          <CardBody className="space-y-3">
            {(["em_dia", "atencao", "em_risco", "inativo", "novo"] as const).map((stage) => {
              const count = retention.counts[stage];
              const total = retention.customers.length || 1;
              const percent = Math.round((count / total) * 100);
              const bar = {
                em_dia: "bg-emerald-400",
                atencao: "bg-amber-400",
                em_risco: "bg-rose-400",
                inativo: "bg-ink-500",
                novo: "bg-sky-400",
              }[stage];

              return (
                <div key={stage}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="text-soft">{STAGE_LABEL[stage]}</span>
                    <span className="font-medium text-white">
                      {count} <span className="text-muted">· {percent}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
                    <div className={`h-full rounded-full ${bar}`} style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}

            <Link
              href="/retencao"
              className="focus-ring mt-4 flex items-center justify-between rounded-xl bg-ink-850 px-3.5 py-3 text-sm text-soft transition-colors hover:bg-ink-800 hover:text-white"
            >
              Abrir motor de retenção
              <ArrowRight size={15} className="text-volt-400" />
            </Link>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Agenda de hoje */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Agenda de hoje"
            description={`${todayAgenda.length} ${todayAgenda.length === 1 ? "atendimento" : "atendimentos"} programados.`}
            action={
              <Link
                href="/agenda"
                className="focus-ring rounded text-xs font-medium text-volt-400 hover:text-volt-300"
              >
                Ver tudo
              </Link>
            }
          />
          {todayAgenda.length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={20} />}
              title="Nenhum atendimento hoje"
              description="Bom momento para acionar clientes que estão passando do ciclo de retorno."
            />
          ) : (
            <ul className="divide-y divide-line">
              {todayAgenda.map((item) => {
                const status = statusOf(APPOINTMENT_STATUS, item.status);
                const total = item.services.reduce(
                  (sum, entry) => sum + (entry.serviceItem?.basePrice ?? 0),
                  0,
                );
                return (
                  <li key={item.id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="w-14 shrink-0 text-center">
                      <p className="font-display text-sm font-bold text-white">{time(item.startsAt)}</p>
                      <p className="text-[0.65rem] text-muted">{time(item.endsAt)}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">{item.customer.name}</p>
                      <p className="truncate text-xs text-muted">
                        {item.vehicle
                          ? `${item.vehicle.brand} ${item.vehicle.model}`
                          : "Sem veículo"}
                        {" · "}
                        {item.services.map((entry) => entry.serviceItem?.name).join(", ")}
                      </p>
                    </div>
                    <div className="hidden shrink-0 text-right sm:block">
                      <p className="text-sm font-medium text-white">{money(total)}</p>
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Prioridade de contato */}
        <Card>
          <CardHeader
            title="Contatar hoje"
            description="Clientes com maior risco de não voltar."
          />
          {priority.length === 0 ? (
            <EmptyState
              icon={<Repeat2 size={20} />}
              title="Carteira em dia"
              description="Nenhum cliente passou do ciclo de retorno."
            />
          ) : (
            <ul className="divide-y divide-line">
              {priority.map((customer) => (
                <li key={customer.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/clientes/${customer.id}`}
                        className="focus-ring block truncate rounded text-sm font-medium text-white hover:text-volt-300"
                      >
                        {customer.name}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {customer.vehicleLabel ?? "Sem veículo"} ·{" "}
                        {customer.daysSinceLastVisit} dias sem voltar
                      </p>
                    </div>
                    <Badge tone={customer.stage === "inativo" ? "muted" : "danger"}>
                      {STAGE_LABEL[customer.stage]}
                    </Badge>
                  </div>
                  {customer.phone && (
                    <a
                      href={whatsappLink(
                        customer.phone,
                        `Olá ${customer.name.split(" ")[0]}! Aqui é da ${company.name}. Faz um tempo que não cuidamos do seu ${customer.vehicleLabel ?? "carro"} — quer agendar um horário?`,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="focus-ring mt-2 inline-block rounded text-xs font-medium text-volt-400 hover:text-volt-300"
                    >
                      Chamar no WhatsApp · {phoneMask(customer.phone)}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Ordens em andamento */}
      <Card>
        <CardHeader
          title="Ordens de serviço em andamento"
          description={`${metrics.activeWorkOrders} ${metrics.activeWorkOrders === 1 ? "OS aberta" : "OS abertas"} no pátio.`}
          action={
            <Link
              href="/ordens"
              className="focus-ring rounded text-xs font-medium text-volt-400 hover:text-volt-300"
            >
              Ver todas
            </Link>
          }
        />
        {activeOrders.length === 0 ? (
          <EmptyState
            icon={<Wrench size={20} />}
            title="Nenhuma OS aberta"
            description="Todos os serviços foram entregues."
          />
        ) : (
          <ul className="divide-y divide-line">
            {activeOrders.map((order) => {
              const status = statusOf(WORK_ORDER_STATUS, order.status);
              return (
                <li key={order.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {order.customer.name}
                      </p>
                      <p className="truncate text-xs text-muted">
                        <span className="font-display font-bold">
                          OS #{String(order.number).padStart(4, "0")}
                        </span>
                        {" · "}
                        {order.vehicle
                          ? `${order.vehicle.brand} ${order.vehicle.model}`
                          : "Sem veículo"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-sm font-medium text-white">
                        {money(order.totalCents)}
                      </span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* Rodape: base cadastral */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Clientes cadastrados"
          value={metrics.customersTotal}
          hint={`${metrics.customersNewMonth} novos neste mês`}
          icon={<Users size={17} />}
        />
        <StatCard
          label="Veículos na base"
          value={metrics.vehiclesTotal}
          hint="Histórico por placa e modelo"
          icon={<Wrench size={17} />}
        />
        <StatCard
          label="Precisam de contato"
          value={retention.needsContactCount}
          hint={`${retention.counts.atencao} em atenção · ${retention.counts.em_risco} em risco · ${retention.counts.inativo} inativos`}
          icon={<Repeat2 size={17} />}
          tone={retention.needsContactCount > 0 ? "danger" : "default"}
        />
      </div>
    </div>
  );
}
