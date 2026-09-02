"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Button, Field, Input } from "@/components/ui";
import {
  updateCompanyAction,
  updateRetentionAction,
  type SettingsState,
} from "@/app/actions/company";

function Feedback({ state }: { state: SettingsState }) {
  if (!state) return null;
  if (state.error) {
    return (
      <p
        role="alert"
        className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-2.5 text-xs text-rose-200"
      >
        <AlertCircle size={14} className="mt-0.5 shrink-0" />
        {state.error}
      </p>
    );
  }
  return (
    <p
      role="status"
      className="flex items-center gap-2 rounded-xl border border-volt-400/25 bg-volt-400/10 px-3.5 py-2.5 text-xs text-volt-200"
    >
      <CheckCircle2 size={14} className="shrink-0" />
      Alterações salvas.
    </p>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : label}
    </Button>
  );
}

export function CompanyForm({
  company,
}: {
  company: {
    name: string;
    document: string | null;
    phone: string | null;
    email: string | null;
    city: string | null;
    state: string | null;
    address: string | null;
  };
}) {
  const [state, formAction] = useActionState<SettingsState, FormData>(
    updateCompanyAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4 p-5">
      <Feedback state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome da empresa" className="sm:col-span-2">
          <Input name="name" defaultValue={company.name} required />
        </Field>
        <Field label="CNPJ">
          <Input name="document" defaultValue={company.document ?? ""} placeholder="00.000.000/0001-00" />
        </Field>
        <Field label="Telefone">
          <Input name="phone" defaultValue={company.phone ?? ""} placeholder="(11) 4002-8922" />
        </Field>
        <Field label="E-mail">
          <Input type="email" name="email" defaultValue={company.email ?? ""} placeholder="contato@suaempresa.com.br" />
        </Field>
        <Field label="Cidade">
          <Input name="city" defaultValue={company.city ?? ""} />
        </Field>
        <Field label="Estado">
          <Input name="state" defaultValue={company.state ?? ""} maxLength={2} placeholder="SP" />
        </Field>
        <Field label="Endereço">
          <Input name="address" defaultValue={company.address ?? ""} />
        </Field>
      </div>

      <Submit label="Salvar dados da empresa" />
    </form>
  );
}

export function RetentionForm({
  retentionWindowDays,
  inactiveAfterDays,
  contactCooldownDays,
}: {
  retentionWindowDays: number;
  inactiveAfterDays: number;
  contactCooldownDays: number;
}) {
  const [state, formAction] = useActionState<SettingsState, FormData>(
    updateRetentionAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4 p-5">
      <Feedback state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Ciclo ideal de retorno (dias)"
          hint="Usado quando o serviço não define uma recorrência própria."
        >
          <Input
            type="number"
            name="retentionWindowDays"
            defaultValue={retentionWindowDays}
            min={7}
            max={365}
            required
          />
        </Field>
        <Field
          label="Considerar inativo após (dias)"
          hint="A partir daqui o cliente entra nas campanhas de reativação."
        >
          <Input
            type="number"
            name="inactiveAfterDays"
            defaultValue={inactiveAfterDays}
            min={30}
            max={1095}
            required
          />
        </Field>
      </div>

      <Field
        label="Cooldown de contato (dias)"
        hint="Depois de um contato registrado, o cliente sai da fila de prioridade por este período. O estágio de retenção dele não muda."
      >
        <Input
          type="number"
          name="contactCooldownDays"
          defaultValue={contactCooldownDays}
          min={1}
          max={90}
          required
        />
      </Field>

      <Submit label="Salvar regras de retenção" />
    </form>
  );
}
