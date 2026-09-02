import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Car,
  CircleDollarSign,
  Pencil,
  User,
  Wallet,
  Wrench,
} from "lucide-react";

import { Badge, ButtonLink, Card, CardBody, CardHeader } from "@/components/ui";
import { StatCard } from "@/components/ui/page";
import { db } from "@/lib/db";
import { dateFull, money, plateMask, time } from "@/lib/format";
import { PAYMENT_LABEL, WORK_ORDER_STATUS, statusOf } from "@/lib/labels";
import { requireContext } from "@/lib/tenant";

import { CompleteWorkOrder, WorkOrderStatusActions } from "../WorkOrderActions";
import { WorkOrderForm } from "../WorkOrderForm";

export const metadata: Metadata = { title: "Ordem de Serviço" };

export default async function WorkOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editar?: string }>;
}) {
  const { company } = await requireContext();
  const { id } = await params;
  const editing = (await searchParams).editar === "1";

  // findFirst com companyId: OS de outra empresa nao existe aqui.
  const order = await db.workOrder.findFirst({
    where: { id, companyId: company.id },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      vehicle: { select: { id: true, brand: true, model: true, plate: true } },
      items: true,
      appointment: {
        select: { id: true, startsAt: true, status: true },
      },
    },
  });

  if (!order) notFound();

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
      select: { id: true, name: true, basePrice: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const customerOptions = customerRows.map((customer) => ({
    id: customer.id,
    name: customer.name,
    vehicles: customer.vehicles.map((v) => ({
      id: v.id,
      label: `${v.brand} ${v.model}${v.plate ? ` · ${v.plate}` : ""}`,
    })),
  }));

  const status = statusOf(WORK_ORDER_STATUS, order.status);
  const numero = `OS #${String(order.number).padStart(4, "0")}`;
  const subtotal = order.items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);

  return (
    <div className="space-y-6">
      <WorkOrderForm
        open={editing}
        customers={customerOptions}
        services={serviceRows}
        closeHref={`/ordens/${order.id}`}
        order={{
          id: order.id,
          customerId: order.customerId,
          vehicleId: order.vehicleId ?? "",
          items: order.items
            .filter((item) => item.serviceItemId)
            .map((item) => ({
              serviceItemId: item.serviceItemId!,
              unitPriceCents: item.unitPriceCents,
            })),
          date: order.openedAt.toISOString().slice(0, 10),
          status: order.status,
          notes: order.notes,
        }}
      />

      <Link
        href="/ordens"
        className="focus-ring inline-flex items-center gap-1.5 rounded text-xs font-medium text-muted transition-colors hover:text-white"
      >
        <ArrowLeft size={14} />
        Voltar para ordens de serviço
      </Link>

      {/* Cabecalho operacional */}
      <Card>
        <CardBody className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-xl font-bold text-white sm:text-2xl">{numero}</h1>
              <Badge tone={status.tone} dot>
                {status.label}
              </Badge>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
              <Link
                href={`/clientes/${order.customer.id}`}
                className="focus-ring inline-flex items-center gap-1.5 rounded hover:text-volt-300"
              >
                <User size={13} />
                {order.customer.name}
              </Link>
              {order.vehicle && (
                <Link
                  href={`/veiculos/${order.vehicle.id}`}
                  className="focus-ring inline-flex items-center gap-1.5 rounded hover:text-volt-300"
                >
                  <Car size={13} />
                  {order.vehicle.brand} {order.vehicle.model} · {plateMask(order.vehicle.plate)}
                </Link>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={13} />
                Aberta em {dateFull(order.openedAt)}
              </span>
            </div>

            {/* Agendamento vinculado, quando a OS nasceu da agenda */}
            {order.appointment && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-xl border border-volt-400/25 bg-volt-400/10 px-3 py-2 text-xs text-volt-200">
                <CalendarDays size={13} className="shrink-0" />
                Criada a partir do agendamento de {dateFull(order.appointment.startsAt)} às{" "}
                {time(order.appointment.startsAt)}
                <Link
                  href={`/agenda?semana=${order.appointment.startsAt.toISOString().slice(0, 10)}`}
                  className="focus-ring rounded font-medium underline underline-offset-2"
                >
                  ver na agenda
                </Link>
              </p>
            )}

            {order.notes && (
              <p className="mt-3 max-w-xl rounded-xl border border-line bg-ink-850 px-3.5 py-2.5 text-xs leading-relaxed text-soft">
                {order.notes}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink href={`/ordens/${order.id}?editar=1`} variant="secondary" size="md">
              <Pencil size={16} />
              Editar
            </ButtonLink>
            <CompleteWorkOrder
              order={{ id: order.id, totalCents: order.totalCents, status: order.status }}
            />
          </div>
        </CardBody>

        <div className="border-t border-line px-5 py-3">
          <WorkOrderStatusActions order={{ id: order.id, status: order.status }} />
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Serviços na OS"
          value={order.items.length}
          hint="Itens registrados"
          icon={<Wrench size={17} />}
        />
        <StatCard
          label="Total da OS"
          value={money(order.totalCents)}
          hint={order.status === "concluida" ? "Valor recebido" : "A receber"}
          icon={<CircleDollarSign size={17} />}
          tone="volt"
        />
        <StatCard
          label="Pagamento"
          value={order.paymentMethod ? PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod : "—"}
          hint={order.paymentMethod ? "Forma registrada" : "Ainda não registrado"}
          icon={<Wallet size={17} />}
        />
        <StatCard
          label="Conclusão"
          value={order.finishedAt ? dateFull(order.finishedAt) : "—"}
          hint={order.finishedAt ? "Entra no faturamento" : "OS em aberto"}
          icon={<CalendarDays size={17} />}
          tone={order.finishedAt ? "volt" : "default"}
        />
      </div>

      <Card>
        <CardHeader
          title="Serviços realizados"
          description="Nome e valor praticados ficam registrados na OS, independentes do catálogo."
        />
        <div className="divide-y divide-line">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{item.description}</p>
                {item.quantity > 1 && (
                  <p className="text-xs text-muted">Quantidade: {item.quantity}</p>
                )}
              </div>
              <span className="shrink-0 text-sm font-medium text-white">
                {money(item.unitPriceCents * item.quantity)}
              </span>
            </div>
          ))}
        </div>
        <CardBody className="space-y-1.5 border-t border-line">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Subtotal</span>
            <span className="font-medium text-soft">{money(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-line pt-2 text-sm">
            <span className="font-medium text-white">Total</span>
            <span className="font-display text-lg font-bold text-volt-300">
              {money(order.totalCents)}
            </span>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
