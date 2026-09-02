"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";

import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { useActionForm } from "@/components/ui/action-form";
import { Modal } from "@/components/ui/modal";
import {
  createVehicleAction,
  updateVehicleAction,
  type VehicleState,
} from "@/app/actions/vehicles";
import { VEHICLE_SIZE } from "@/lib/labels";

export type VehicleFormValues = {
  id: string;
  customerId: string;
  brand: string;
  model: string;
  year: number | null;
  plate: string | null;
  color: string | null;
  size: string;
  mileage: number | null;
  notes: string | null;
};

/** Apenas clientes da empresa atual chegam aqui — a lista vem do servidor. */
export type CustomerOption = { id: string; name: string };

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Salvando..." : label}
    </Button>
  );
}

export function VehicleForm({
  open,
  vehicle,
  customers,
  closeHref,
  /** Pre-seleciona o dono quando o cadastro parte da ficha de um cliente. */
  defaultCustomerId,
}: {
  open: boolean;
  vehicle?: VehicleFormValues;
  customers: CustomerOption[];
  closeHref: string;
  defaultCustomerId?: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(vehicle);

  // useActionForm em vez de `action={formAction}`: o reset de formulario do
  // React 19 zerava <select> e checkbox controlados a cada erro de validacao.
  const { state, onSubmit } = useActionForm<VehicleState>(
    isEdit ? updateVehicleAction : createVehicleAction,
    undefined,
  );

  // Campos controlados de proposito: o React 19 reseta o formulario depois que
  // uma Server Action retorna. Com inputs nao controlados, um erro de validacao
  // apagaria tudo que o usuario digitou.
  const [values, setValues] = useState({
    customerId: vehicle?.customerId ?? defaultCustomerId ?? "",
    brand: vehicle?.brand ?? "",
    model: vehicle?.model ?? "",
    year: vehicle?.year != null ? String(vehicle.year) : "",
    plate: vehicle?.plate ?? "",
    color: vehicle?.color ?? "",
    size: vehicle?.size ?? "medio",
    mileage: vehicle?.mileage != null ? String(vehicle.mileage) : "",
    notes: vehicle?.notes ?? "",
  });

  const set = (field: keyof typeof values) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setValues((current) => ({ ...current, [field]: event.target.value }));

  useEffect(() => {
    if (!state?.ok) return;
    router.replace(state.id ? `/veiculos/${state.id}` : closeHref);
    router.refresh();
  }, [state, router, closeHref]);

  function close() {
    router.replace(closeHref);
  }

  const noCustomers = customers.length === 0;

  return (
    <Modal
      open={open}
      onClose={close}
      title={isEdit ? "Editar veículo" : "Novo veículo"}
      description={
        isEdit
          ? "As alterações aparecem na listagem e na ficha do cliente."
          : "Todo veículo pertence a um cliente. Marca e modelo são obrigatórios."
      }
      size="lg"
    >
      {noCustomers ? (
        <div className="space-y-4 p-5">
          <p className="text-sm text-soft">
            Nenhum cliente cadastrado ainda. Um veículo precisa estar vinculado a um cliente.
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
              Cadastrar um cliente
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4 p-5" id="vehicle-form">
          {isEdit && <input type="hidden" name="id" value={vehicle!.id} />}

          {state?.error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-2.5 text-xs text-rose-200"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {state.error}
            </p>
          )}

          <Field label="Cliente" hint="Dono do veículo.">
            <Select
              name="customerId"
              required
              value={values.customerId}
              onChange={set("customerId")}
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

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Marca">
              <Input
                name="brand"
                required
                maxLength={60}
                value={values.brand}
                onChange={set("brand")}
                placeholder="Ex.: Honda"
              />
            </Field>
            <Field label="Modelo">
              <Input
                name="model"
                required
                maxLength={60}
                value={values.model}
                onChange={set("model")}
                placeholder="Ex.: Civic"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Ano">
              <Input
                name="year"
                inputMode="numeric"
                maxLength={4}
                value={values.year}
                onChange={set("year")}
                placeholder="2022"
              />
            </Field>
            <Field label="Placa">
              <Input
                name="plate"
                maxLength={10}
                value={values.plate}
                onChange={set("plate")}
                placeholder="ABC1D23"
                className="uppercase placeholder:normal-case"
              />
            </Field>
            <Field label="Cor">
              <Input
                name="color"
                maxLength={30}
                value={values.color}
                onChange={set("color")}
                placeholder="Prata"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Porte" hint="Influencia o preço de alguns serviços.">
              <Select name="size" value={values.size} onChange={set("size")}>
                {Object.entries(VEHICLE_SIZE).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Quilometragem" hint="Km registrada no último atendimento.">
              <Input
                name="mileage"
                inputMode="numeric"
                maxLength={9}
                value={values.mileage}
                onChange={set("mileage")}
                placeholder="45000"
              />
            </Field>
          </div>

          <Field label="Observações" hint="Detalhes de pintura, avarias, preferências.">
            <Textarea
              name="notes"
              maxLength={2000}
              value={values.notes}
              onChange={set("notes")}
              placeholder="Ex.: risco no para-choque traseiro."
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={close}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Submit label={isEdit ? "Salvar alterações" : "Cadastrar veículo"} />
          </div>
        </form>
      )}
    </Modal>
  );
}
