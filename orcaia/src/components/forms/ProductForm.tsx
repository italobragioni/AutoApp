"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { FormState } from "@/lib/core/actions";
import { UNIT_LABELS, type Unit } from "@/lib/niches";
import { centsToInput } from "@/lib/core/money";
import { Button } from "@/components/ui/button";
import {
  SubmitButton,
  FormError,
  TextField,
  SelectField,
  TextAreaField,
  CheckboxField,
} from "@/components/ui/form";

type ProductValues = {
  id?: string;
  name?: string | null;
  description?: string | null;
  category?: string | null;
  unit?: string | null;
  basePriceCents?: number | null;
  active?: boolean;
};

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function ProductForm({
  action,
  initial,
  units,
}: {
  action: Action;
  initial?: ProductValues;
  units: Unit[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const err = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <FormError message={state?.ok === false && !state.fieldErrors ? state.error : undefined} />

      <TextField label="Nome" name="name" defaultValue={initial?.name ?? ""} error={err.name} required />
      <TextAreaField label="Descricao" name="description" rows={2} defaultValue={initial?.description ?? ""} error={err.description} />

      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Categoria" name="category" defaultValue={initial?.category ?? ""} error={err.category} />
        <SelectField label="Unidade" name="unit" defaultValue={initial?.unit ?? units[0]} error={err.unit}>
          {units.map((u) => (
            <option key={u} value={u}>
              {UNIT_LABELS[u]}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Preco base (R$)"
          name="basePriceCents"
          inputMode="decimal"
          placeholder="0,00"
          defaultValue={initial?.basePriceCents != null ? centsToInput(initial.basePriceCents) : ""}
          error={err.basePriceCents}
        />
      </div>

      <CheckboxField label="Ativo" name="active" defaultChecked={initial?.active ?? true} />

      <div className="flex gap-3">
        <SubmitButton>Salvar</SubmitButton>
        <Link href="/produtos">
          <Button variant="secondary" type="button">
            Cancelar
          </Button>
        </Link>
      </div>
    </form>
  );
}
