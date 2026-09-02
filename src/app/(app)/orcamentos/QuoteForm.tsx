"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";

import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { useActionForm } from "@/components/ui/action-form";
import { Modal } from "@/components/ui/modal";
import { createQuoteAction, updateQuoteAction, type QuoteState } from "@/app/actions/quotes";
import { cn, money } from "@/lib/format";
import { QUOTE_STATUS } from "@/lib/labels";
import { quoteSubtotalCents, quoteTotalCents } from "@/lib/quotes";

export type CustomerOption = {
  id: string;
  name: string;
  vehicles: { id: string; label: string }[];
};

export type ServiceOption = { id: string; name: string; basePrice: number };

export type QuoteFormValues = {
  id: string;
  customerId: string;
  vehicleId: string;
  items: { serviceItemId: string; quantity: number; unitPriceCents: number }[];
  validUntil: string;
  discountCents: number;
  status: string;
  notes: string | null;
};

const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

/** Texto "1.234,56" -> centavos inteiros. Sem ponto flutuante no resultado. */
function inputToCents(value: string) {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Salvando..." : label}
    </Button>
  );
}

export function QuoteForm({
  open,
  quote,
  customers,
  services,
  closeHref,
}: {
  open: boolean;
  quote?: QuoteFormValues;
  customers: CustomerOption[];
  services: ServiceOption[];
  closeHref: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(quote);

  const { state, onSubmit } = useActionForm<QuoteState>(
    isEdit ? updateQuoteAction : createQuoteAction,
    undefined,
  );

  const defaultValidity = () => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  };

  const [values, setValues] = useState({
    customerId: quote?.customerId ?? "",
    vehicleId: quote?.vehicleId ?? "",
    validUntil: quote?.validUntil ?? defaultValidity(),
    discount: quote ? centsToInput(quote.discountCents) : "0,00",
    status: quote?.status ?? "rascunho",
    notes: quote?.notes ?? "",
  });

  const [serviceIds, setServiceIds] = useState<string[]>(
    quote?.items.map((i) => i.serviceItemId) ?? [],
  );
  const [prices, setPrices] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const item of quote?.items ?? []) {
      initial[item.serviceItemId] = centsToInput(item.unitPriceCents);
    }
    return initial;
  });
  const [quantities, setQuantities] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const item of quote?.items ?? []) initial[item.serviceItemId] = String(item.quantity);
    return initial;
  });

  const set = (field: keyof typeof values) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setValues((current) => ({ ...current, [field]: event.target.value }));

  const vehicles = useMemo(
    () => customers.find((c) => c.id === values.customerId)?.vehicles ?? [],
    [customers, values.customerId],
  );

  function toggleService(id: string) {
    setServiceIds((current) => {
      if (current.includes(id)) return current.filter((s) => s !== id);
      const service = services.find((s) => s.id === id);
      if (service) {
        setPrices((p) => ({ ...p, [id]: p[id] ?? centsToInput(service.basePrice) }));
        setQuantities((q) => ({ ...q, [id]: q[id] ?? "1" }));
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
    router.replace(state.id ? `/orcamentos/${state.id}` : closeHref);
    router.refresh();
  }, [state, router, closeHref]);

  function close() {
    router.replace(closeHref);
  }

  // Mesmo calculo das actions e da pagina (src/lib/quotes.ts).
  const subtotal = quoteSubtotalCents(
    serviceIds.map((id) => ({
      quantity: Number(quantities[id] ?? "1") || 1,
      unitPriceCents: inputToCents(prices[id] ?? "0"),
    })),
  );
  const discount = inputToCents(values.discount);
  const total = quoteTotalCents(subtotal, discount);

  return (
    <Modal
      open={open}
      onClose={close}
      title={isEdit ? "Editar orçamento" : "Novo orçamento"}
      description={
        isEdit
          ? "Ajuste serviços, quantidades e desconto."
          : "Monte a proposta. Os valores vêm do catálogo e podem ser ajustados."
      }
      size="lg"
    >
      {customers.length === 0 ? (
        <div className="space-y-4 p-5">
          <p className="text-sm text-soft">
            Nenhum cliente com veículo cadastrado. Um orçamento precisa dos dois.
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
        <form onSubmit={onSubmit} className="space-y-4 p-5" id="quote-form">
          {isEdit && <input type="hidden" name="id" value={quote!.id} />}
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

          <Field label="Serviços" hint="Quantidade e valor de cada item podem ser ajustados.">
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-ink-600 bg-ink-850 p-2">
              {services.map((service) => {
                const checked = serviceIds.includes(service.id);
                return (
                  <div
                    key={service.id}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
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
                      <>
                        <input
                          name={`qty__${service.id}`}
                          inputMode="numeric"
                          value={quantities[service.id] ?? "1"}
                          onChange={(e) =>
                            setQuantities((q) => ({ ...q, [service.id]: e.target.value }))
                          }
                          className="w-12 shrink-0 rounded-lg border border-ink-600 bg-ink-900 px-1.5 py-1 text-center text-base text-white focus-ring sm:text-sm"
                          aria-label={`Quantidade de ${service.name}`}
                        />
                        <input
                          name={`price__${service.id}`}
                          inputMode="decimal"
                          value={prices[service.id] ?? ""}
                          onChange={(e) =>
                            setPrices((p) => ({ ...p, [service.id]: e.target.value }))
                          }
                          className="w-24 shrink-0 rounded-lg border border-ink-600 bg-ink-900 px-2 py-1 text-right text-base text-white focus-ring sm:text-sm"
                          aria-label={`Valor de ${service.name}`}
                        />
                      </>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Validade" hint="Depois desta data o orçamento vence.">
              <Input
                type="date"
                name="validUntil"
                required
                value={values.validUntil}
                onChange={set("validUntil")}
              />
            </Field>
            <Field label="Desconto" hint="Valor em reais, abatido do subtotal.">
              <Input
                name="discount"
                inputMode="decimal"
                value={values.discount}
                onChange={set("discount")}
                placeholder="0,00"
              />
            </Field>
          </div>

          {/* Subtotal, desconto e total — mesmo cálculo das actions. */}
          <div className="space-y-1.5 rounded-xl border border-line bg-ink-850 px-3.5 py-3">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Subtotal</span>
              <span className="font-medium text-soft">{money(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Desconto</span>
              <span className="font-medium text-amber-300">− {money(discount)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-line pt-1.5 text-sm">
              <span className="font-medium text-white">Total</span>
              <span className="font-display text-base font-bold text-volt-300">
                {money(total)}
              </span>
            </div>
          </div>

          <Field label="Status">
            <Select name="status" value={values.status} onChange={set("status")}>
              {Object.entries(QUOTE_STATUS).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Observações">
            <Textarea
              name="notes"
              maxLength={2000}
              value={values.notes}
              onChange={set("notes")}
              placeholder="Ex.: condições da proposta, prazo de execução."
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={close} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Submit label={isEdit ? "Salvar alterações" : "Criar orçamento"} />
          </div>
        </form>
      )}
    </Modal>
  );
}
