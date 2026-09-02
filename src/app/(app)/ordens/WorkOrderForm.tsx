"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";

import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { useActionForm } from "@/components/ui/action-form";
import { Modal } from "@/components/ui/modal";
import {
  createWorkOrderAction,
  updateWorkOrderAction,
  type WorkOrderState,
} from "@/app/actions/work-orders";
import { cn, money } from "@/lib/format";
import { WORK_ORDER_STATUS } from "@/lib/labels";

export type CustomerOption = {
  id: string;
  name: string;
  vehicles: { id: string; label: string }[];
};

export type ServiceOption = { id: string; name: string; basePrice: number };

export type WorkOrderFormValues = {
  id: string;
  customerId: string;
  vehicleId: string;
  /** Preco praticado por servico, em centavos. */
  items: { serviceItemId: string; unitPriceCents: number }[];
  date: string;
  status: string;
  notes: string | null;
};

function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function inputToCents(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

/** Soma os precos digitados, para o total refletir o que esta na tela. */
function sumTyped(prices: Record<string, string>, ids: string[]) {
  return ids.reduce((sum, id) => {
    const raw = prices[id] ?? "";
    const parsed = Number(raw.replace(/\./g, "").replace(",", "."));
    return sum + (Number.isFinite(parsed) ? Math.round(parsed * 100) : 0);
  }, 0);
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Salvando..." : label}
    </Button>
  );
}

export function WorkOrderForm({
  open,
  order,
  customers,
  services,
  closeHref,
}: {
  open: boolean;
  order?: WorkOrderFormValues;
  customers: CustomerOption[];
  services: ServiceOption[];
  closeHref: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(order);

  const { state, onSubmit } = useActionForm<WorkOrderState>(
    isEdit ? updateWorkOrderAction : createWorkOrderAction,
    undefined,
  );

  const [values, setValues] = useState({
    customerId: order?.customerId ?? "",
    vehicleId: order?.vehicleId ?? "",
    date: order?.date ?? new Date().toISOString().slice(0, 10),
    status: order?.status ?? "aberta",
    notes: order?.notes ?? "",
  });

  const [serviceIds, setServiceIds] = useState<string[]>(
    order?.items.map((item) => item.serviceItemId) ?? [],
  );
  /** Preco por servico como texto — o usuario pode ajustar item a item. */
  const [prices, setPrices] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const item of order?.items ?? []) {
      initial[item.serviceItemId] = centsToInput(item.unitPriceCents);
    }
    return initial;
  });

  const set = (field: keyof typeof values) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setValues((current) => ({ ...current, [field]: event.target.value }));

  const vehicles = useMemo(
    () => customers.find((c) => c.id === values.customerId)?.vehicles ?? [],
    [customers, values.customerId],
  );

  /** Ao marcar um serviço, o preço do catálogo entra como sugestão editável. */
  function toggleService(id: string) {
    setServiceIds((current) => {
      if (current.includes(id)) return current.filter((s) => s !== id);
      const service = services.find((s) => s.id === id);
      if (service) {
        setPrices((p) => ({ ...p, [id]: p[id] ?? centsToInput(service.basePrice) }));
      }
      return [...current, id];
    });
  }

  function onCustomerChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const customerId = event.target.value;
    const list = customers.find((c) => c.id === customerId)?.vehicles ?? [];
    setValues((current) => ({
      ...current,
      customerId,
      vehicleId: list.length === 1 ? list[0].id : "",
    }));
  }

  useEffect(() => {
    if (!state?.ok) return;
    router.replace(state.id ? `/ordens/${state.id}` : closeHref);
    router.refresh();
  }, [state, router, closeHref]);

  function close() {
    router.replace(closeHref);
  }

  const subtotal = sumTyped(prices, serviceIds);

  return (
    <Modal
      open={open}
      onClose={close}
      title={isEdit ? "Editar ordem de serviço" : "Nova ordem de serviço"}
      description={
        isEdit
          ? "Ajuste serviços e valores antes de concluir."
          : "Escolha o cliente, o veículo e os serviços. Os valores vêm do catálogo e podem ser ajustados."
      }
      size="lg"
    >
      {customers.length === 0 ? (
        <div className="space-y-4 p-5">
          <p className="text-sm text-soft">
            Nenhum cliente com veículo cadastrado. Uma OS precisa dos dois.
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
        <form onSubmit={onSubmit} className="space-y-4 p-5" id="work-order-form">
          {isEdit && <input type="hidden" name="id" value={order!.id} />}
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
              hint={values.customerId ? undefined : "Escolha o cliente primeiro."}
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

          <Field label="Serviços" hint="O valor de cada serviço pode ser ajustado.">
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-ink-600 bg-ink-850 p-2">
              {services.map((service) => {
                const checked = serviceIds.includes(service.id);
                return (
                  <div
                    key={service.id}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                      checked ? "bg-volt-400/10 text-white" : "text-soft",
                    )}
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleService(service.id)}
                        className="size-4 shrink-0 accent-volt-400"
                      />
                      <span className="min-w-0 flex-1 truncate">{service.name}</span>
                    </label>
                    {checked ? (
                      <input
                        name={`price__${service.id}`}
                        inputMode="decimal"
                        value={prices[service.id] ?? ""}
                        onChange={(event) =>
                          setPrices((p) => ({ ...p, [service.id]: event.target.value }))
                        }
                        className="w-24 shrink-0 rounded-lg border border-ink-600 bg-ink-900 px-2 py-1 text-right text-base text-white focus-ring sm:text-sm"
                        aria-label={`Valor de ${service.name}`}
                      />
                    ) : (
                      <span className="shrink-0 text-xs text-muted">
                        {money(service.basePrice)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </Field>

          {/* Subtotal e total: o schema da OS nao tem desconto, entao sao iguais. */}
          <div className="space-y-1.5 rounded-xl border border-line bg-ink-850 px-3.5 py-3">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Subtotal</span>
              <span className="font-medium text-soft">{money(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-line pt-1.5 text-sm">
              <span className="font-medium text-white">Total da OS</span>
              <span className="font-display text-base font-bold text-volt-300">
                {money(subtotal)}
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data">
              <Input type="date" name="date" required value={values.date} onChange={set("date")} />
            </Field>
            <Field label="Status">
              <Select name="status" value={values.status} onChange={set("status")}>
                {Object.entries(WORK_ORDER_STATUS).map(([value, meta]) => (
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
              placeholder="Ex.: cliente pediu atenção especial nas rodas."
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={close} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Submit label={isEdit ? "Salvar alterações" : "Abrir OS"} />
          </div>
        </form>
      )}
    </Modal>
  );
}
