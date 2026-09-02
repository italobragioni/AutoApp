"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, AlertTriangle } from "lucide-react";

import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { useActionForm } from "@/components/ui/action-form";
import { Modal } from "@/components/ui/modal";
import {
  createAppointmentAction,
  updateAppointmentAction,
  type AppointmentState,
} from "@/app/actions/appointments";
import { suggestedDurationMin, suggestedPriceCents } from "@/lib/agenda";
import { cn, money } from "@/lib/format";
import { APPOINTMENT_STATUS } from "@/lib/labels";

export type CustomerOption = {
  id: string;
  name: string;
  vehicles: { id: string; label: string }[];
};

export type ServiceOption = {
  id: string;
  name: string;
  basePrice: number;
  durationMin: number;
};

export type AppointmentFormValues = {
  id: string;
  customerId: string;
  vehicleId: string;
  serviceIds: string[];
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  durationMin: number;
  priceCents: number;
  status: string;
  notes: string | null;
};

function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function Submit({ label, warned }: { label: string; warned: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      variant={warned ? "danger" : "primary"}
      className="w-full sm:w-auto"
    >
      {pending ? "Salvando..." : warned ? "Salvar mesmo assim" : label}
    </Button>
  );
}

export function AppointmentForm({
  open,
  appointment,
  customers,
  services,
  closeHref,
}: {
  open: boolean;
  appointment?: AppointmentFormValues;
  customers: CustomerOption[];
  services: ServiceOption[];
  closeHref: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(appointment);

  // useActionForm em vez de `action={formAction}`: evita o reset de formulario
  // do React 19, que zerava cliente/veiculo/serviços depois do aviso de conflito.
  const { state, onSubmit } = useActionForm<AppointmentState>(
    isEdit ? updateAppointmentAction : createAppointmentAction,
    undefined,
  );

  // Campos controlados: o React 19 reseta o formulario apos a Server Action.
  const [values, setValues] = useState({
    customerId: appointment?.customerId ?? "",
    vehicleId: appointment?.vehicleId ?? "",
    date: appointment?.date ?? new Date().toISOString().slice(0, 10),
    time: appointment?.time ?? "09:00",
    durationMin: appointment ? String(appointment.durationMin) : "",
    price: appointment ? centsToInput(appointment.priceCents) : "",
    status: appointment?.status ?? "agendado",
    notes: appointment?.notes ?? "",
  });
  const [serviceIds, setServiceIds] = useState<string[]>(appointment?.serviceIds ?? []);
  /** O usuario editou o valor à mão? Se sim, o serviço não sobrescreve mais. */
  const [priceTouched, setPriceTouched] = useState(Boolean(appointment));
  const [durationTouched, setDurationTouched] = useState(Boolean(appointment));

  const set = (field: keyof typeof values) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setValues((current) => ({ ...current, [field]: event.target.value }));

  // Só os veículos do cliente escolhido — filtrado a partir da lista que já veio
  // do servidor, sem ida extra ao banco.
  const vehicles = useMemo(
    () => customers.find((c) => c.id === values.customerId)?.vehicles ?? [],
    [customers, values.customerId],
  );

  const chosenServices = useMemo(
    () => services.filter((s) => serviceIds.includes(s.id)),
    [services, serviceIds],
  );

  function toggleService(id: string) {
    setServiceIds((current) => {
      const next = current.includes(id)
        ? current.filter((s) => s !== id)
        : [...current, id];

      // Preenche preço e duração a partir do catálogo, enquanto o usuário não
      // tiver mexido nesses campos manualmente.
      const chosen = services.filter((s) => next.includes(s.id));
      setValues((v) => ({
        ...v,
        price: priceTouched ? v.price : centsToInput(suggestedPriceCents(chosen)),
        durationMin: durationTouched ? v.durationMin : String(suggestedDurationMin(chosen)),
      }));
      return next;
    });
  }

  // Trocar de cliente invalida o veículo selecionado.
  function onCustomerChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const customerId = event.target.value;
    const first = customers.find((c) => c.id === customerId)?.vehicles ?? [];
    setValues((current) => ({
      ...current,
      customerId,
      vehicleId: first.length === 1 ? first[0].id : "",
    }));
  }

  useEffect(() => {
    if (!state?.ok) return;
    router.replace(closeHref);
    router.refresh();
  }, [state, router, closeHref]);

  function close() {
    router.replace(closeHref);
  }

  const conflicts = state?.conflicts ?? [];
  const hasConflict = conflicts.length > 0;

  return (
    <Modal
      open={open}
      onClose={close}
      title={isEdit ? "Editar agendamento" : "Novo agendamento"}
      description={
        isEdit
          ? "Altere horário, serviços, cliente ou veículo. A agenda atualiza na hora."
          : "Escolha o cliente, o veículo e os serviços. Preço e duração vêm do catálogo."
      }
      size="lg"
    >
      {customers.length === 0 ? (
        <div className="space-y-4 p-5">
          <p className="text-sm text-soft">
            Nenhum cliente com veículo cadastrado. Um agendamento precisa dos dois.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={close} className="w-full sm:w-auto">
              Fechar
            </Button>
            <Button
              type="button"
              onClick={() => router.push("/clientes?novo=1")}
              className="w-full sm:w-auto"
            >
              Cadastrar cliente
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4 p-5" id="appointment-form">
          {isEdit && <input type="hidden" name="id" value={appointment!.id} />}
          {/* Depois do aviso de conflito, o próximo envio é confirmado. */}
          {hasConflict && <input type="hidden" name="force" value="1" />}
          {serviceIds.map((id) => (
            <input key={id} type="hidden" name="serviceIds" value={id} />
          ))}

          {state?.error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-2.5 text-xs text-rose-200"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {state.error}
            </p>
          )}

          {hasConflict && (
            <div
              role="alert"
              className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3.5"
            >
              <p className="flex items-center gap-2 text-xs font-semibold text-amber-200">
                <AlertTriangle size={14} className="shrink-0" />
                Já existe atendimento neste horário
              </p>
              <ul className="mt-2 space-y-1 text-xs text-amber-100/90">
                {conflicts.map((c) => (
                  <li key={`${c.customerName}-${c.startsAt}`}>
                    {c.customerName} ·{" "}
                    {new Date(c.startsAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" – "}
                    {new Date(c.endsAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </li>
                ))}
              </ul>
              <p className="mt-2.5 text-[0.7rem] leading-relaxed text-amber-100/70">
                Se você atende mais de um carro ao mesmo tempo, pode salvar assim mesmo.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cliente">
              <Select
                name="customerId"
                required
                value={values.customerId}
                onChange={onCustomerChange}
              >
                <option value="" disabled>
                  Selecione o cliente
                </option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Veículo"
              hint={
                values.customerId
                  ? `${vehicles.length} veículo(s) deste cliente.`
                  : "Escolha o cliente primeiro."
              }
            >
              <Select
                name="vehicleId"
                required
                disabled={!values.customerId}
                value={values.vehicleId}
                onChange={set("vehicleId")}
              >
                <option value="" disabled>
                  {values.customerId ? "Selecione o veículo" : "—"}
                </option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="Serviços"
            hint="Preço e duração são preenchidos pelo catálogo — e podem ser ajustados."
          >
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-ink-600 bg-ink-850 p-2">
              {services.map((service) => {
                const checked = serviceIds.includes(service.id);
                return (
                  <label
                    key={service.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                      checked ? "bg-volt-400/10 text-white" : "text-soft hover:bg-ink-800",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleService(service.id)}
                      className="size-4 shrink-0 accent-volt-400"
                    />
                    <span className="min-w-0 flex-1 truncate">{service.name}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {money(service.basePrice)} · {service.durationMin}min
                    </span>
                  </label>
                );
              })}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Data">
              <Input type="date" name="date" required value={values.date} onChange={set("date")} />
            </Field>
            <Field label="Horário">
              <Input type="time" name="time" required value={values.time} onChange={set("time")} />
            </Field>
            <Field label="Duração (min)">
              <Input
                name="durationMin"
                inputMode="numeric"
                required
                maxLength={4}
                value={values.durationMin}
                onChange={(event) => {
                  setDurationTouched(true);
                  set("durationMin")(event);
                }}
                placeholder="90"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Valor"
              hint={
                chosenServices.length > 0
                  ? `Catálogo: ${money(suggestedPriceCents(chosenServices))}`
                  : "Some os serviços ou informe um valor."
              }
            >
              <Input
                name="price"
                inputMode="decimal"
                required
                value={values.price}
                onChange={(event) => {
                  setPriceTouched(true);
                  set("price")(event);
                }}
                placeholder="190,00"
              />
            </Field>

            <Field label="Status">
              <Select name="status" value={values.status} onChange={set("status")}>
                {Object.entries(APPOINTMENT_STATUS).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Observações">
            <Textarea
              name="notes"
              maxLength={2000}
              value={values.notes}
              onChange={set("notes")}
              placeholder="Ex.: cliente vai aguardar no local."
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={close} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Submit
              label={isEdit ? "Salvar alterações" : "Agendar"}
              warned={hasConflict}
            />
          </div>
        </form>
      )}
    </Modal>
  );
}
