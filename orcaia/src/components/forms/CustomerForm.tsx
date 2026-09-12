"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { FormState } from "@/lib/core/actions";
import { Button } from "@/components/ui/button";
import {
  SubmitButton,
  FormError,
  TextField,
  TextAreaField,
} from "@/components/ui/form";

type CustomerValues = {
  id?: string;
  name?: string | null;
  document?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
};

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function CustomerForm({
  action,
  initial,
}: {
  action: Action;
  initial?: CustomerValues;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const err = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <FormError message={state?.ok === false && !state.fieldErrors ? state.error : undefined} />

      <TextField label="Nome" name="name" defaultValue={initial?.name ?? ""} error={err.name} required />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="CPF / CNPJ" name="document" defaultValue={initial?.document ?? ""} error={err.document} />
        <TextField label="E-mail" name="email" type="email" defaultValue={initial?.email ?? ""} error={err.email} />
        <TextField label="Telefone" name="phone" defaultValue={initial?.phone ?? ""} error={err.phone} />
        <TextField label="WhatsApp" name="whatsapp" defaultValue={initial?.whatsapp ?? ""} error={err.whatsapp} />
      </div>

      <TextField label="Endereco" name="address" defaultValue={initial?.address ?? ""} error={err.address} />
      <TextAreaField label="Observacoes" name="notes" rows={3} defaultValue={initial?.notes ?? ""} error={err.notes} />

      <div className="flex gap-3">
        <SubmitButton>Salvar</SubmitButton>
        <Link href="/clientes">
          <Button variant="secondary" type="button">
            Cancelar
          </Button>
        </Link>
      </div>
    </form>
  );
}
