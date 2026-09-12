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
  CheckboxField,
} from "@/components/ui/form";

type MaterialValues = {
  id?: string;
  name?: string | null;
  unit?: string | null;
  costCents?: number | null;
  supplier?: string | null;
  active?: boolean;
};

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function MaterialForm({
  action,
  initial,
  units,
}: {
  action: Action;
  initial?: MaterialValues;
  units: Unit[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const err = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <FormError message={state?.ok === false && !state.fieldErrors ? state.error : undefined} />

      <TextField label="Nome" name="name" defaultValue={initial?.name ?? ""} error={err.name} required />

      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField label="Unidade" name="unit" defaultValue={initial?.unit ?? units[0]} error={err.unit}>
          {units.map((u) => (
            <option key={u} value={u}>
              {UNIT_LABELS[u]}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Custo por unidade (R$)"
          name="costCents"
          inputMode="decimal"
          placeholder="0,00"
          defaultValue={initial?.costCents != null ? centsToInput(initial.costCents) : ""}
          error={err.costCents}
          required
        />
        <TextField label="Fornecedor" name="supplier" defaultValue={initial?.supplier ?? ""} error={err.supplier} />
      </div>

      <CheckboxField label="Ativo" name="active" defaultChecked={initial?.active ?? true} />

      <div className="flex gap-3">
        <SubmitButton>Salvar</SubmitButton>
        <Link href="/materiais">
          <Button variant="secondary" type="button">
            Cancelar
          </Button>
        </Link>
      </div>
    </form>
  );
}
