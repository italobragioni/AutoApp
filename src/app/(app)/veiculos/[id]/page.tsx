import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Car,
  CircleDollarSign,
  FileText,
  Gauge,
  Pencil,
  User,
  Wrench,
} from "lucide-react";

import { Badge, ButtonLink, Card, CardBody, CardHeader, EmptyState } from "@/components/ui";
import { StatCard } from "@/components/ui/page";
import { db } from "@/lib/db";
import { dateFull, money, plateMask, time } from "@/lib/format";
import {
  APPOINTMENT_STATUS,
  PAYMENT_LABEL,
  QUOTE_STATUS,
  VEHICLE_SIZE,
  WORK_ORDER_STATUS,
  statusOf,
} from "@/lib/labels";
import { can } from "@/lib/permissions";
import { requireContext } from "@/lib/tenant";

import { DeleteVehicle } from "../DeleteVehicle";
import { VehicleForm } from "../VehicleForm";

export const metadata: Metadata = { title: "Veículo" };

export default async function VehicleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editar?: string }>;
}) {
  const { company, role } = await requireContext();
  const { id } = await params;
  const editing = (await searchParams).editar === "1";

  // findFirst com companyId: veiculo de outra empresa nao existe aqui.
  const vehicle = await db.vehicle.findFirst({
    where: { id, companyId: company.id },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      _count: { select: { appointments: true, quotes: true, workOrders: true } },
      appointments: {
        orderBy: { startsAt: "desc" },
        take: 10,
        include: { services: { include: { serviceItem: { select: { name: true } } } } },
      },
      quotes: { orderBy: { createdAt: "desc" }, take: 10 },
      workOrders: {
        orderBy: { openedAt: "desc" },
        include: { items: true },
      },
    },
  });

  if (!vehicle) notFound();

  // O seletor de cliente do formulario so recebe clientes desta empresa.
  const customers = await db.customer.findMany({
    where: { companyId: company.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const completed = vehicle.workOrders.filter((order) => order.status === "concluida");
  const revenue = completed.reduce((sum, order) => sum + order.totalCents, 0);
  const lastService = completed[0]?.finishedAt ?? null;
  const label = `${vehicle.brand} ${vehicle.model}`;

  return (
    <div className="space-y-6">
      <VehicleForm
        open={editing}
        customers={customers}
        closeHref={`/veiculos/${vehicle.id}`}
        vehicle={{
          id: vehicle.id,
          customerId: vehicle.customerId,
          brand: vehicle.brand,
          model: vehicle.model,
          year: vehicle.year,
          plate: vehicle.plate,
          color: vehicle.color,
          size: vehicle.size,
          mileage: vehicle.mileage,
          notes: vehicle.notes,
        }}
      />

      <Link
        href="/veiculos"
        className="focus-ring inline-flex items-center gap-1.5 rounded text-xs font-medium text-muted transition-colors hover:text-white"
      >
        <ArrowLeft size={14} />
        Voltar para veículos
      </Link>

      {/* Cabecalho */}
      <Card>
        <CardBody className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-volt-400/12 text-volt-300">
              <Car size={26} />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-xl font-bold text-white sm:text-2xl">{label}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
                <span className="rounded-lg border border-line bg-ink-850 px-2 py-1 font-mono text-[0.72rem] text-soft">
                  {plateMask(vehicle.plate)}
                </span>
                <span>{vehicle.year ?? "Ano não informado"}</span>
                <span>{vehicle.color ?? "Cor não informada"}</span>
                <Link
                  href={`/clientes/${vehicle.customer.id}`}
                  className="focus-ring inline-flex items-center gap-1.5 rounded hover:text-volt-300"
                >
                  <User size={13} />
                  {vehicle.customer.name}
                </Link>
              </div>
              {vehicle.notes && (
                <p className="mt-3 max-w-xl rounded-xl border border-line bg-ink-850 px-3.5 py-2.5 text-xs leading-relaxed text-soft">
                  {vehicle.notes}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={vehicle.size === "suv" || vehicle.size === "grande" ? "volt" : "neutral"}>
              {VEHICLE_SIZE[vehicle.size] ?? vehicle.size}
            </Badge>
            <ButtonLink href={`/veiculos/${vehicle.id}?editar=1`} variant="secondary" size="md">
              <Pencil size={16} />
              Editar
            </ButtonLink>
            {/* Mesmo criterio de papel ja usado em Clientes e Configuracoes. */}
            {can(role, "vehicles.delete") && (
              <DeleteVehicle
                vehicle={{ id: vehicle.id, label }}
                counts={{
                  appointments: vehicle._count.appointments,
                  quotes: vehicle._count.quotes,
                  workOrders: vehicle._count.workOrders,
                }}
              />
            )}
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Serviços concluídos"
          value={completed.length}
          hint={lastService ? `Último em ${dateFull(lastService)}` : "Nenhum ainda"}
          icon={<Wrench size={17} />}
        />
        <StatCard
          label="Receita gerada"
          value={money(revenue)}
          hint="Somente ordens concluídas"
          icon={<CircleDollarSign size={17} />}
          tone="volt"
        />
        <StatCard
          label="Quilometragem"
          value={vehicle.mileage ? `${vehicle.mileage.toLocaleString("pt-BR")} km` : "—"}
          hint="Registrada no último atendimento"
          icon={<Gauge size={17} />}
        />
        <StatCard
          label="Agendamentos"
          value={vehicle._count.appointments}
          hint={`${vehicle._count.quotes} orçamento(s)`}
          icon={<CalendarDays size={17} />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Histórico de serviços"
            description={`${vehicle.workOrders.length} ordem(ns) de serviço.`}
          />
          {vehicle.workOrders.length === 0 ? (
            <EmptyState
              icon={<Wrench size={20} />}
              title="Nenhum serviço registrado"
              description="Assim que este veículo passar por um atendimento, o histórico aparece aqui."
            />
          ) : (
            <ul className="divide-y divide-line">
              {vehicle.workOrders.map((order) => {
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
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Agendamentos" description="Últimos 10 registros." />
            {vehicle.appointments.length === 0 ? (
              <EmptyState icon={<CalendarDays size={20} />} title="Sem agendamentos" />
            ) : (
              <ul className="divide-y divide-line">
                {vehicle.appointments.map((appointment) => {
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
                          {appointment.services
                            .map((entry) => entry.serviceItem?.name)
                            .join(", ") || "Sem serviço vinculado"}
                        </p>
                      </div>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Orçamentos" description="Propostas para este veículo." />
            {vehicle.quotes.length === 0 ? (
              <EmptyState icon={<FileText size={20} />} title="Sem orçamentos" />
            ) : (
              <ul className="divide-y divide-line">
                {vehicle.quotes.map((quote) => {
                  const status = statusOf(QUOTE_STATUS, quote.status);
                  return (
                    <li key={quote.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="text-sm text-white">
                          #{String(quote.number).padStart(4, "0")}
                          <span className="ml-2 text-xs text-muted">
                            {dateFull(quote.createdAt)}
                          </span>
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-sm font-medium text-white">
                          {money(quote.totalCents)}
                        </span>
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
    </div>
  );
}
