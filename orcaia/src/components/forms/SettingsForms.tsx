"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/core/actions";
import { NICHES } from "@/lib/niches";
import {
  SubmitButton,
  FormError,
  FormSuccess,
  TextField,
  SelectField,
} from "@/components/ui/form";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

function useForm(action: Action) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const err = state?.fieldErrors ?? {};
  const topError = state?.ok === false && !state.fieldErrors ? state.error : undefined;
  const success = state?.ok === true;
  return { formAction, err, topError, success };
}

type CompanyValues = {
  name?: string | null;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
};

export function CompanyProfileForm({
  action,
  initial,
}: {
  action: Action;
  initial: CompanyValues;
}) {
  const { formAction, err, topError, success } = useForm(action);
  return (
    <form action={formAction} className="space-y-4">
      <FormError message={topError} />
      <FormSuccess message={success ? "Dados salvos." : undefined} />
      <TextField label="Nome da empresa" name="name" defaultValue={initial.name ?? ""} error={err.name} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="CNPJ" name="document" defaultValue={initial.document ?? ""} error={err.document} />
        <TextField label="E-mail" name="email" defaultValue={initial.email ?? ""} error={err.email} />
        <TextField label="Telefone" name="phone" defaultValue={initial.phone ?? ""} error={err.phone} />
        <TextField label="Cidade" name="city" defaultValue={initial.city ?? ""} error={err.city} />
        <TextField label="Estado (UF)" name="state" defaultValue={initial.state ?? ""} error={err.state} />
        <TextField label="Endereco" name="address" defaultValue={initial.address ?? ""} error={err.address} />
      </div>
      <SubmitButton>Salvar dados</SubmitButton>
    </form>
  );
}

export function PricingForm({
  action,
  marginValue,
  laborValue,
}: {
  action: Action;
  marginValue: string;
  laborValue: string;
}) {
  const { formAction, err, topError, success } = useForm(action);
  return (
    <form action={formAction} className="space-y-4">
      <FormError message={topError} />
      <FormSuccess message={success ? "Politicas salvas." : undefined} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Margem de lucro padrao (%)"
          name="defaultMarginBps"
          inputMode="decimal"
          defaultValue={marginValue}
          error={err.defaultMarginBps}
          required
        />
        <TextField
          label="Mao de obra padrao (R$/hora)"
          name="defaultLaborRateCents"
          inputMode="decimal"
          placeholder="0,00"
          defaultValue={laborValue}
          error={err.defaultLaborRateCents}
        />
      </div>
      <SubmitButton>Salvar politicas</SubmitButton>
    </form>
  );
}

export function AccountProfileForm({
  action,
  name,
}: {
  action: Action;
  name: string;
}) {
  const { formAction, err, topError, success } = useForm(action);
  return (
    <form action={formAction} className="space-y-4">
      <FormError message={topError} />
      <FormSuccess message={success ? "Perfil atualizado." : undefined} />
      <TextField label="Seu nome" name="name" defaultValue={name} error={err.name} required />
      <SubmitButton>Salvar perfil</SubmitButton>
    </form>
  );
}

export function PasswordForm({ action }: { action: Action }) {
  const { formAction, err, topError, success } = useForm(action);
  return (
    <form action={formAction} className="space-y-4">
      <FormError message={topError} />
      <FormSuccess message={success ? "Senha alterada." : undefined} />
      <TextField label="Senha atual" name="currentPassword" type="password" error={err.currentPassword} required />
      <TextField label="Nova senha" name="newPassword" type="password" error={err.newPassword} required />
      <SubmitButton>Alterar senha</SubmitButton>
    </form>
  );
}

export function NewCompanyForm({ action }: { action: Action }) {
  const { formAction, err, topError } = useForm(action);
  return (
    <form action={formAction} className="space-y-4">
      <FormError message={topError} />
      <TextField label="Nome da nova empresa" name="name" error={err.name} required />
      <SelectField label="Nicho" name="niche" defaultValue="" error={err.niche} required>
        <option value="" disabled>
          Selecione...
        </option>
        {NICHES.map((n) => (
          <option key={n.id} value={n.id}>
            {n.label}
          </option>
        ))}
      </SelectField>
      <SubmitButton>Criar empresa</SubmitButton>
    </form>
  );
}
