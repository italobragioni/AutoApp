import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Clock, Pencil } from "lucide-react";

import { Badge, ButtonLink, Card, CardBody, CardHeader, EmptyState } from "@/components/ui";
import { PageHeader, StatCard } from "@/components/ui/page";
import { db } from "@/lib/db";
import { cn, money, time } from "@/lib/format";
import { APPOINTMENT_STATUS, statusOf } from "@/lib/labels";
import { appointmentValueCents } from "@/lib/agenda";
import { requireContext } from "@/lib/tenant";

import { AppointmentForm } from "./AppointmentForm";
import { AppointmentStatusActions } from "./AppointmentStatusActions";

export const metadata: Metadata = { title: "Agenda" };

const DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Segunda-feira da semana que contém `date`. */
function weekStart(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  const weekday = value.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  return new Date(value.getTime() + diff * DAY);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string; novo?: string; editar?: string }>;
}) {
  const { company } = await requireContext();
  const params = await searchParams;
  const creating = params.novo === "1";

  const base = params.semana ? new Date(`${params.semana}T12:00:00`) : new Date();
  const start = weekStart(Number.isNaN(base.getTime()) ? new Date() : base);
  const end = new Date(start.getTime() + 7 * DAY);

  const appointments = await db.appointment.findMany({
    where: { companyId: company.id, startsAt: { gte: start, lt: end } },
    orderBy: { startsAt: "asc" },
    include: {
      customer: { select: { id: true, name: true } },
      vehicle: { select: { brand: true, model: true, plate: true } },
      services: {
        include: { serviceItem: { select: { id: true, name: true, basePrice: true } } },
      },
    },
  });

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY);
    return {
      date,
      items: appointments.filter(
        (item) => isoDate(new Date(item.startsAt)) === isoDate(date),
      ),
    };
  });

  // Opcoes do formulario — sempre escopadas pela empresa da sessao.
  // Só clientes com veículo entram: um agendamento exige os dois.
  const [customerRows, serviceRows] = await Promise.all([
    db.customer.findMany({
      where: { companyId: company.id, vehicles: { some: {} } },
      select: {
        id: true,
        name: true,
        vehicles: { select: { id: true, brand: true, model: true, plate: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.serviceItem.findMany({
      where: { companyId: company.id, active: true },
      select: { id: true, name: true, basePrice: true, durationMin: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const customerOptions = customerRows.map((customer) => ({
    id: customer.id,
    name: customer.name,
    vehicles: customer.vehicles.map((vehicle) => ({
      id: vehicle.id,
      label: `${vehicle.brand} ${vehicle.model}${vehicle.plate ? ` · ${vehicle.plate}` : ""}`,
    })),
  }));

  // Busca independente do filtro de semana: editar um agendamento de outra
  // semana precisa funcionar (o link direto, por exemplo). O escopo continua
  // sendo a empresa da sessao — id de outra empresa simplesmente nao retorna.
  const editing = params.editar
    ? await db.appointment.findFirst({
        where: { id: params.editar, companyId: company.id },
        include: {
          // Os precos vem junto para o helper calcular o valor efetivo de
          // agendamentos antigos, que tem priceCents nulo.
          services: { include: { serviceItem: { select: { id: true, basePrice: true } } } },
        },
      })
    : null;

  const todayIso = isoDate(new Date());
  const active = appointments.filter((item) => item.status !== "cancelado");
  // Usa o valor combinado quando existir; senao, a soma do catalogo.
  const weekValue = active.reduce((sum, item) => sum + appointmentValueCents(item), 0);
  const occupiedMinutes = active.reduce(
    (sum, item) => sum + (item.endsAt.getTime() - item.startsAt.getTime()) / 60000,
    0,
  );

  const previousWeek = isoDate(new Date(start.getTime() - 7 * DAY));
  const nextWeek = isoDate(new Date(start.getTime() + 7 * DAY));

  const rangeLabel = `${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} — ${new Date(end.getTime() - DAY).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;

  return (
    <div className="space-y-6">
      <AppointmentForm
        open={creating}
        customers={customerOptions}
        services={serviceRows}
        closeHref="/agenda"
      />
      {editing && (
        <AppointmentForm
          open
          customers={customerOptions}
          services={serviceRows}
          closeHref="/agenda"
          appointment={{
            id: editing.id,
            customerId: editing.customerId,
            vehicleId: editing.vehicleId ?? "",
            serviceIds: editing.services.map((entry) => entry.serviceItemId),
            date: isoDate(editing.startsAt),
            time: editing.startsAt.toTimeString().slice(0, 5),
            durationMin: Math.round(
              (editing.endsAt.getTime() - editing.startsAt.getTime()) / 60000,
            ),
            // Valor combinado quando existir; senao, a soma do catalogo.
            priceCents: appointmentValueCents(editing),
            status: editing.status,
            notes: editing.notes,
          }}
        />
      )}

      <PageHeader
        eyebrow="Operação"
        title="Agenda"
        description="Semana inteira em uma tela: quem chega, qual serviço e quanto vale."
        actions={
          <ButtonLink href="/agenda?novo=1" size="md">
            <CalendarPlus size={16} />
            Novo agendamento
          </ButtonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Atendimentos na semana"
          value={active.length}
          hint={rangeLabel}
          icon={<CalendarDays size={17} />}
        />
        <StatCard
          label="Valor agendado"
          value={money(weekValue)}
          hint="Soma dos serviços marcados"
          icon={<Clock size={17} />}
          tone="volt"
        />
        <StatCard
          label="Horas ocupadas"
          value={`${Math.round(occupiedMinutes / 60)}h`}
          hint="Tempo de box comprometido"
        />
      </div>

      {/* Navegacao por semana */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/agenda?semana=${previousWeek}`}
            className="focus-ring flex size-9 items-center justify-center rounded-xl border border-line bg-ink-900 text-soft transition-colors hover:border-ink-600 hover:text-white"
            aria-label="Semana anterior"
          >
            <ChevronLeft size={16} />
          </Link>
          <Link
            href={`/agenda?semana=${nextWeek}`}
            className="focus-ring flex size-9 items-center justify-center rounded-xl border border-line bg-ink-900 text-soft transition-colors hover:border-ink-600 hover:text-white"
            aria-label="Próxima semana"
          >
            <ChevronRight size={16} />
          </Link>
          <span className="ml-1 font-display text-sm font-semibold text-white">{rangeLabel}</span>
        </div>
        <Link
          href="/agenda"
          className="focus-ring rounded text-xs font-medium text-volt-400 hover:text-volt-300"
        >
          Voltar para hoje
        </Link>
      </div>

      {/* Grade semanal */}
      <div className="grid gap-3 lg:grid-cols-7">
        {days.map((day) => {
          const isToday = isoDate(day.date) === todayIso;
          return (
            <div
              key={day.date.toISOString()}
              className={cn(
                "surface flex flex-col overflow-hidden",
                isToday && "ring-1 ring-inset ring-volt-400/35",
              )}
            >
              <div
                className={cn(
                  "border-b border-line px-3 py-2.5",
                  isToday ? "bg-volt-400/10" : "bg-ink-850/60",
                )}
              >
                <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted">
                  {WEEKDAYS[day.date.getDay()]}
                </p>
                <p
                  className={cn(
                    "font-display text-lg font-bold",
                    isToday ? "text-volt-300" : "text-white",
                  )}
                >
                  {day.date.getDate()}
                </p>
              </div>

              <div className="flex-1 space-y-2 p-2.5">
                {day.items.length === 0 ? (
                  <p className="px-1 py-4 text-center text-[0.7rem] text-muted">Livre</p>
                ) : (
                  day.items.map((item) => {
                    const status = statusOf(APPOINTMENT_STATUS, item.status);
                    return (
                      <Link
                        key={item.id}
                        href={`/clientes/${item.customer.id}`}
                        className={cn(
                          "focus-ring block rounded-xl border border-line bg-ink-850 p-2.5 transition-colors hover:border-ink-600",
                          item.status === "cancelado" && "opacity-50",
                        )}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-display text-xs font-bold text-volt-300">
                            {time(item.startsAt)}
                          </span>
                          <Badge tone={status.tone} className="px-1.5 py-0.5 text-[0.6rem]">
                            {status.label}
                          </Badge>
                        </div>
                        <p className="mt-1.5 truncate text-xs font-medium text-white">
                          {item.customer.name}
                        </p>
                        <p className="truncate text-[0.68rem] text-muted">
                          {item.vehicle ? `${item.vehicle.brand} ${item.vehicle.model}` : "Sem veículo"}
                        </p>
                        <p className="mt-1 truncate text-[0.68rem] text-soft">
                          {item.services.map((entry) => entry.serviceItem?.name).join(", ")}
                        </p>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lista detalhada da semana */}
      <Card>
        <CardHeader
          title="Detalhamento da semana"
          description="Todos os atendimentos em ordem cronológica."
        />
        {appointments.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={20} />}
            title="Semana sem atendimentos"
            description="Use a Retenção para acionar clientes que estão passando do ciclo de retorno e encher a agenda."
            action={
              <ButtonLink href="/retencao" size="sm" variant="secondary">
                Ver oportunidades
              </ButtonLink>
            }
          />
        ) : (
          <CardBody className="space-y-2.5 p-3">
            {appointments.map((item) => {
              const status = statusOf(APPOINTMENT_STATUS, item.status);
              const total = appointmentValueCents(item);
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex flex-wrap items-center gap-3 rounded-xl border border-line bg-ink-850/60 px-4 py-3",
                    (item.status === "cancelado" || item.status === "nao_compareceu") &&
                      "opacity-60",
                  )}
                >
                  <div className="w-24 shrink-0">
                    <p className="text-xs font-medium text-white">
                      {item.startsAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </p>
                    <p className="text-[0.7rem] text-muted">
                      {time(item.startsAt)} – {time(item.endsAt)}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/clientes/${item.customer.id}`}
                      className="focus-ring block truncate rounded text-sm font-medium text-white hover:text-volt-300"
                    >
                      {item.customer.name}
                    </Link>
                    <p className="truncate text-xs text-muted">
                      {item.vehicle
                        ? `${item.vehicle.brand} ${item.vehicle.model} · ${item.vehicle.plate ?? "sem placa"}`
                        : "Sem veículo"}
                    </p>
                  </div>
                  <p className="hidden min-w-0 flex-1 truncate text-xs text-soft md:block">
                    {item.services.map((entry) => entry.serviceItem?.name).join(", ")}
                  </p>
                  <span className="text-sm font-medium text-white">{money(total)}</span>
                  <Badge tone={status.tone}>{status.label}</Badge>
                  <div className="flex w-full flex-wrap items-center gap-1 border-t border-line pt-2 lg:w-auto lg:border-0 lg:pt-0">
                    <Link
                      href={`/agenda?editar=${item.id}${params.semana ? `&semana=${params.semana}` : ""}`}
                      className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[0.7rem] font-medium text-soft transition-colors hover:bg-ink-800 hover:text-white"
                    >
                      <Pencil size={12} />
                      Editar
                    </Link>
                    <AppointmentStatusActions
                      appointment={{ id: item.id, status: item.status }}
                    />
                  </div>
                </div>
              );
            })}
          </CardBody>
        )}
      </Card>
    </div>
  );
}
