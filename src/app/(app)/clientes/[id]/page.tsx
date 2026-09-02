import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Car,
  FileText,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Repeat2,
  Wrench,
} from "lucide-react";

import {
  Avatar,
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
} from "@/components/ui";
import { StatCard } from "@/components/ui/page";
import { db } from "@/lib/db";
import { dateFull, money, phoneMask, plateMask, time, whatsappLink } from "@/lib/format";
import {
  APPOINTMENT_STATUS,
  ORIGIN_LABEL,
  PAYMENT_LABEL,
  QUOTE_STATUS,
  VEHICLE_SIZE,
  WORK_ORDER_STATUS,
  statusOf,
} from "@/lib/labels";
import { STAGE_HINT, STAGE_LABEL, STAGE_TONE, getRetention } from "@/lib/retention";
import { can } from "@/lib/permissions";
import { requireContext } from "@/lib/tenant";

import { CustomerForm } from "../CustomerForm";
import { DeleteCustomer } from "../DeleteCustomer";

export const metadata: Metadata = { title: "Ficha do cliente" };

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editar?: string }>;
}) {
  const { company, role } = await requireContext();
  const { id } = await params;
  const editing = (await searchParams).editar === "1";

  // findFirst com companyId: um id de outra empresa simplesmente nao existe aqui.
  const customer = await db.customer.findFirst({
    where: { id, companyId: company.id },
    include: {
      _count: {
        select: { vehicles: true, appointments: true, quotes: true, workOrders: true },
      },
      vehicles: { orderBy: { createdAt: "asc" } },
      appointments: {
        orderBy: { startsAt: "desc" },
        take: 10,
        include: { services: { include: { serviceItem: { select: { name: true } } } } },
      },
      quotes: { orderBy: { createdAt: "desc" }, take: 10 },
      workOrders: {
        orderBy: { openedAt: "desc" },
        include: {
          items: true,
          vehicle: { select: { brand: true, model: true } },
        },
      },
    },
  });

  if (!customer) notFound();

  const retention = await getRetention(company.id);
  const info = retention.customers.find((item) => item.id === customer.id);

  const completed = customer.workOrders.filter((order) => order.status === "concluida");
  const firstName = customer.name.split(" ")[0];
  const vehicleLabel = customer.vehicles[0]
    ? `${customer.vehicles[0].brand} ${customer.vehicles[0].model}`
    : "seu carro";

  const suggestedMessage = `Olá ${firstName}! Aqui é da ${company.name}. Faz ${info?.daysSinceLastVisit ?? "um"} dias que cuidamos do seu ${vehicleLabel}. Quer agendar a próxima manutenção? Tenho horário disponível esta semana.`;

  return (
    <div className="space-y-6">
      <CustomerForm
        open={editing}
        closeHref={`/clientes/${customer.id}`}
        customer={{
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          // O input[type=date] espera "YYYY-MM-DD".
          birthDate: customer.birthDate
            ? customer.birthDate.toISOString().slice(0, 10)
            : null,
          origin: customer.origin,
          notes: customer.notes,
        }}
      />

      <Link
        href="/clientes"
        className="focus-ring inline-flex items-center gap-1.5 rounded text-xs font-medium text-muted transition-colors hover:text-white"
      >
        <ArrowLeft size={14} />
        Voltar para clientes
      </Link>

      {/* Cabecalho da ficha */}
      <Card>
        <CardBody className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar name={customer.name} size={56} />
            <div className="min-w-0">
              <h1 className="font-display text-xl font-bold text-white sm:text-2xl">
                {customer.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
                {customer.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone size={13} />
                    {phoneMask(customer.phone)}
                  </span>
                )}
                {customer.email && (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail size={13} />
                    {customer.email}
                  </span>
                )}
                <span>Origem: {ORIGIN_LABEL[customer.origin] ?? customer.origin}</span>
                <span>Cliente desde {dateFull(customer.createdAt)}</span>
              </div>
              {customer.notes && (
                <p className="mt-3 max-w-xl rounded-xl border border-line bg-ink-850 px-3.5 py-2.5 text-xs leading-relaxed text-soft">
                  {customer.notes}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {info && (
              <Badge tone={STAGE_TONE[info.stage]} dot>
                {STAGE_LABEL[info.stage]}
              </Badge>
            )}
            <ButtonLink href={`/clientes/${customer.id}?editar=1`} variant="secondary" size="md">
              <Pencil size={16} />
              Editar
            </ButtonLink>
            {/* Exclusao segue a estrutura de papeis ja existente: owner e manager. */}
            {can(role, "customers.delete") && (
              <DeleteCustomer
                customer={{ id: customer.id, name: customer.name }}
                counts={{
                  vehicles: customer._count.vehicles,
                  appointments: customer._count.appointments,
                  quotes: customer._count.quotes,
                  workOrders: customer._count.workOrders,
                }}
              />
            )}
            {customer.phone && (
              <ButtonLink
                href={whatsappLink(customer.phone, suggestedMessage)}
                target="_blank"
                rel="noopener noreferrer"
                size="md"
              >
                <MessageCircle size={16} />
                WhatsApp
              </ButtonLink>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Diagnostico de retencao — a leitura que o dono precisa */}
      {info && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Serviços realizados"
            value={info.visits}
            hint={info.lastVisitAt ? `Último em ${dateFull(info.lastVisitAt)}` : "Nenhum ainda"}
            icon={<Wrench size={17} />}
          />
          <StatCard
            label="Total gasto"
            value={money(info.totalSpentCents)}
            hint={`Ticket médio ${money(info.averageTicketCents)}`}
          />
          <StatCard
            label="Dias sem voltar"
            value={info.daysSinceLastVisit ?? "—"}
            hint={info.dueAt ? `Retorno ideal em ${dateFull(info.dueAt)}` : "Sem histórico"}
            icon={<Repeat2 size={17} />}
            tone={info.overdueDays > 0 ? "warning" : "default"}
          />
          <StatCard
            label="Oportunidade de retorno"
            value={money(info.opportunityCents)}
            hint={info.overdueDays > 0 ? `${info.overdueDays} dias atrasado` : "Dentro do ciclo"}
            tone={info.overdueDays > 30 ? "danger" : "volt"}
          />
        </div>
      )}

      {info && info.stage !== "em_dia" && info.stage !== "novo" && (
        <div className="rounded-2xl border border-volt-400/25 bg-ink-900 p-5">
          <p className="text-sm font-semibold text-white">{STAGE_HINT[info.stage]}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted">Mensagem sugerida:</p>
          <p className="mt-1.5 rounded-xl border border-line bg-ink-850 px-3.5 py-3 text-sm leading-relaxed text-soft">
            {suggestedMessage}
          </p>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        {/* Veiculos */}
        <Card>
          <CardHeader
            title="Veículos"
            description={`${customer.vehicles.length} cadastrado(s).`}
            action={
              <Link
                href="/veiculos"
                className="focus-ring rounded text-xs font-medium text-volt-400 hover:text-volt-300"
              >
                Gerenciar
              </Link>
            }
          />
          {customer.vehicles.length === 0 ? (
            <EmptyState icon={<Car size={20} />} title="Sem veículo cadastrado" />
          ) : (
            <ul className="divide-y divide-line">
              {customer.vehicles.map((vehicle) => (
                <li key={vehicle.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-volt-300">
                    <Car size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {vehicle.brand} {vehicle.model}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {vehicle.year ?? "—"} · {vehicle.color ?? "—"} ·{" "}
                      {VEHICLE_SIZE[vehicle.size] ?? vehicle.size}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg border border-line bg-ink-850 px-2 py-1 font-mono text-[0.7rem] text-soft">
                    {plateMask(vehicle.plate)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Historico de servicos */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Histórico de serviços"
            description={`${completed.length} atendimento(s) concluído(s).`}
          />
          {customer.workOrders.length === 0 ? (
            <EmptyState
              icon={<Wrench size={20} />}
              title="Nenhum serviço registrado"
              description="Assim que a primeira OS for concluída, o ciclo de retorno começa a ser calculado."
            />
          ) : (
            <ul className="divide-y divide-line">
              {customer.workOrders.map((order) => {
                const status = statusOf(WORK_ORDER_STATUS, order.status);
                return (
                  <li key={order.id} className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white">
                          OS #{String(order.number).padStart(4, "0")}
                          <span className="ml-2 text-xs font-normal text-muted">
                            {order.finishedAt
                              ? dateFull(order.finishedAt)
                              : `aberta em ${dateFull(order.openedAt)}`}
                          </span>
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted">
                          {order.items.map((item) => item.description).join(", ")}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-sm font-medium text-white">
                          {money(order.totalCents)}
                        </span>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </div>
                    </div>
                    {order.paymentMethod && (
                      <p className="mt-1 text-[0.7rem] text-muted">
                        Pagamento: {PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}
                        {order.vehicle && ` · ${order.vehicle.brand} ${order.vehicle.model}`}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Agendamentos */}
        <Card>
          <CardHeader title="Agendamentos" description="Últimos 10 registros." />
          {customer.appointments.length === 0 ? (
            <EmptyState icon={<CalendarDays size={20} />} title="Sem agendamentos" />
          ) : (
            <ul className="divide-y divide-line">
              {customer.appointments.map((appointment) => {
                const status = statusOf(APPOINTMENT_STATUS, appointment.status);
                return (
                  <li
                    key={appointment.id}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-white">
                        {dateFull(appointment.startsAt)} · {time(appointment.startsAt)}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {appointment.services.map((entry) => entry.serviceItem?.name).join(", ") ||
                          "Sem serviço vinculado"}
                      </p>
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Orcamentos */}
        <Card>
          <CardHeader title="Orçamentos" description="Propostas enviadas a este cliente." />
          {customer.quotes.length === 0 ? (
            <EmptyState icon={<FileText size={20} />} title="Sem orçamentos" />
          ) : (
            <ul className="divide-y divide-line">
              {customer.quotes.map((quote) => {
                const status = statusOf(QUOTE_STATUS, quote.status);
                return (
                  <li key={quote.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm text-white">
                        #{String(quote.number).padStart(4, "0")}
                        <span className="ml-2 text-xs text-muted">{dateFull(quote.createdAt)}</span>
                      </p>
                      <p className="text-xs text-muted">
                        {quote.validUntil ? `Válido até ${dateFull(quote.validUntil)}` : "Sem validade"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-medium text-white">{money(quote.totalCents)}</span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
