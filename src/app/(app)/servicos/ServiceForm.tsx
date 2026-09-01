"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";

import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import {
  createServiceAction,
  updateServiceAction,
  type ServiceState,
} from "@/app/actions/services";
import { SERVICE_CATEGORY } from "@/lib/labels";

export type ServiceFormValues = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  /** Em centavos, como no banco. */
  basePrice: number;
  durationMin: number;
  recurrenceDays: number | null;
  active: boolean;
};

/** Centavos -> "150,00" para edicao. */
function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Salvando..." : label}
    </Button>
  );
}

export function ServiceForm({
  open,
  service,
  closeHref,
}: {
  open: boolean;
  /** Ausente = criacao. Presente = edicao. */
  service?: ServiceFormValues;
  closeHref: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(service);

  const [state, formAction] = useActionState<ServiceState, FormData>(
    isEdit ? updateServiceAction : createServiceAction,
    undefined,
  );

  // Campos controlados: o React 19 reseta o formulario apos a Server Action, e
  // sem isso um erro de validacao apagaria tudo que foi digitado.
  const [values, setValues] = useState({
    name: service?.name ?? "",
    category: service?.category ?? "lavagem",
    description: service?.description ?? "",
    price: service ? centsToInput(service.basePrice) : "",
    durationMin: service ? String(service.durationMin) : "60",
    recurrenceDays: service?.recurrenceDays != null ? String(service.recurrenceDays) : "",
    active: service?.active ?? true,
  });

  const set = (field: keyof typeof values) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setValues((current) => ({ ...current, [field]: event.target.value }));

  useEffect(() => {
    if (!state?.ok) return;
    router.replace(closeHref);
    router.refresh();
  }, [state, router, closeHref]);

  function close() {
    router.replace(closeHref);
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={isEdit ? "Editar serviço" : "Novo serviço"}
      description={
        isEdit
          ? "Alterações valem para novos atendimentos. O histórico já registrado não muda."
          : "Preço, duração e de quanto em quanto tempo o serviço precisa ser refeito."
      }
      size="lg"
    >
      <form action={formAction} className="space-y-4 p-5" id="service-form">
        {isEdit && <input type="hidden" name="id" value={service!.id} />}

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
          <Field label="Nome">
            <Input
              name="name"
              required
              autoFocus
              maxLength={80}
              value={values.name}
              onChange={set("name")}
              placeholder="Ex.: Lavagem Premium + Cera"
            />
          </Field>

          <Field label="Categoria">
            <Select name="category" value={values.category} onChange={set("category")}>
              {Object.entries(SERVICE_CATEGORY).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Descrição" hint="O que está incluso. Aparece no catálogo.">
          <Textarea
            name="description"
            maxLength={500}
            value={values.description}
            onChange={set("description")}
            placeholder="Ex.: lavagem detalhada com aplicação de cera de carnaúba."
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Preço" hint="Valor cobrado, em reais.">
            <Input
              name="price"
              inputMode="decimal"
              required
              value={values.price}
              onChange={set("price")}
              placeholder="190,00"
            />
          </Field>

          <Field label="Duração" hint="Tempo de box, em minutos.">
            <Input
              name="durationMin"
              inputMode="numeric"
              required
              maxLength={4}
              value={values.durationMin}
              onChange={set("durationMin")}
              placeholder="120"
            />
          </Field>
        </div>

        <Field
          label="Ciclo de retorno"
          hint="Em quantos dias o serviço precisa ser refeito. É o que o motor de retenção usa para saber quando o cliente deveria voltar. Deixe em branco para usar o padrão da empresa."
        >
          <Input
            name="recurrenceDays"
            inputMode="numeric"
            maxLength={4}
            value={values.recurrenceDays}
            onChange={set("recurrenceDays")}
            placeholder="45"
          />
        </Field>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-ink-850 px-3.5 py-3">
          <input
            type="checkbox"
            name="active"
            checked={values.active}
            onChange={(event) =>
              setValues((current) => ({ ...current, active: event.target.checked }))
            }
            className="mt-0.5 size-4 shrink-0 accent-volt-400"
          />
          <span className="text-xs leading-relaxed text-muted">
            <span className="font-medium text-soft">Serviço ativo.</span> Serviços inativos saem
            do uso no dia a dia, mas continuam aparecendo no histórico de atendimentos já
            realizados.
          </span>
        </label>

        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={close} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Submit label={isEdit ? "Salvar alterações" : "Cadastrar serviço"} />
        </div>
      </form>
    </Modal>
  );
}
