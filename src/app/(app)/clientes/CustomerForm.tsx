"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";

import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import {
  createCustomerAction,
  updateCustomerAction,
  type CustomerState,
} from "@/app/actions/customers";
import { ORIGIN_LABEL } from "@/lib/labels";

export type CustomerFormValues = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birthDate: string | null; // "YYYY-MM-DD"
  origin: string;
  notes: string | null;
};

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Salvando..." : label}
    </Button>
  );
}

/**
 * Formulario de cliente — serve para criar e para editar.
 *
 * A abertura e controlada pela URL (`?novo=1` na listagem, `?editar=1` na
 * ficha), mantendo o link que o botao "Novo cliente" ja usava. Fechar apenas
 * remove o parametro, entao o botao voltar do navegador funciona naturalmente.
 */
export function CustomerForm({
  open,
  customer,
  closeHref,
}: {
  open: boolean;
  /** Ausente = criacao. Presente = edicao. */
  customer?: CustomerFormValues;
  /** Para onde navegar ao fechar. */
  closeHref: string;
}) {
  const router = useRouter();
  const isEdit = Boolean(customer);

  const [state, formAction] = useActionState<CustomerState, FormData>(
    isEdit ? updateCustomerAction : createCustomerAction,
    undefined,
  );

  // Salvou: fecha e leva para a ficha do cliente, ja com os dados atualizados.
  useEffect(() => {
    if (!state?.ok) return;
    router.replace(state.id ? `/clientes/${state.id}` : closeHref);
    router.refresh();
  }, [state, router, closeHref]);

  function close() {
    router.replace(closeHref);
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={isEdit ? "Editar cliente" : "Novo cliente"}
      description={
        isEdit
          ? "As alterações aparecem na ficha e na listagem imediatamente."
          : "Apenas o nome é obrigatório — o resto pode ser completado depois."
      }
      size="lg"
    >
      <form action={formAction} className="space-y-4 p-5" id="customer-form">
        {isEdit && <input type="hidden" name="id" value={customer!.id} />}

        {state?.error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-2.5 text-xs text-rose-200"
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {state.error}
          </p>
        )}

        <Field label="Nome">
          <Input
            name="name"
            required
            autoFocus
            maxLength={120}
            defaultValue={customer?.name ?? ""}
            placeholder="Ex.: João Silva"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Telefone" hint="Com DDD. Usado no contato por WhatsApp.">
            <Input
              name="phone"
              type="tel"
              inputMode="tel"
              maxLength={20}
              defaultValue={customer?.phone ?? ""}
              placeholder="(11) 98765-4321"
            />
          </Field>

          <Field label="E-mail">
            <Input
              name="email"
              type="email"
              defaultValue={customer?.email ?? ""}
              placeholder="cliente@email.com"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data de nascimento" hint="Alimenta a campanha de aniversariantes.">
            <Input type="date" name="birthDate" defaultValue={customer?.birthDate ?? ""} />
          </Field>

          <Field label="Origem" hint="De onde este cliente veio.">
            <Select name="origin" defaultValue={customer?.origin ?? "indicacao"}>
              {Object.entries(ORIGIN_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Observações" hint="Preferências, histórico, o que for útil lembrar.">
          <Textarea
            name="notes"
            maxLength={2000}
            defaultValue={customer?.notes ?? ""}
            placeholder="Ex.: prefere agendar aos sábados de manhã."
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
          <Submit label={isEdit ? "Salvar alterações" : "Cadastrar cliente"} />
        </div>
      </form>
    </Modal>
  );
}
