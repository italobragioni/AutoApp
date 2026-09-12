"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/core/actions";
import { UNIT_LABELS, type Unit } from "@/lib/niches";
import {
  SubmitButton,
  FormError,
  TextField,
  SelectField,
} from "@/components/ui/form";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

// Mao de obra (criacao). Cobrada por hora, m2, metro linear ou unidade.
const LABOR_UNITS: Unit[] = ["hora", "m2", "ml", "un"];

export function LaborForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const err = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-3">
      <FormError message={state?.ok === false && !state.fieldErrors ? state.error : undefined} />
      <TextField label="Descricao" name="name" placeholder="Ex.: Instalacao" error={err.name} required />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Unidade" name="unit" defaultValue="hora" error={err.unit}>
          {LABOR_UNITS.map((u) => (
            <option key={u} value={u}>
              {UNIT_LABELS[u]}
            </option>
          ))}
        </SelectField>
        <TextField label="Valor (R$)" name="rateCents" inputMode="decimal" placeholder="0,00" error={err.rateCents} required />
      </div>
      <input type="hidden" name="active" value="on" />
      <SubmitButton>Adicionar</SubmitButton>
    </form>
  );
}

// Custo adicional (deslocamento, outros): fixo em R$ ou percentual sobre o custo.
export function AdditionalCostForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const err = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-3">
      <FormError message={state?.ok === false && !state.fieldErrors ? state.error : undefined} />
      <TextField label="Descricao" name="name" placeholder="Ex.: Deslocamento" error={err.name} required />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Tipo" name="kind" defaultValue="fixo" error={err.kind}>
          <option value="fixo">Fixo (R$)</option>
          <option value="percentual">Percentual (%)</option>
        </SelectField>
        <TextField label="Valor" name="value" inputMode="decimal" placeholder="Ex.: 50,00 ou 10" error={err.value} required />
      </div>
      <input type="hidden" name="active" value="on" />
      <SubmitButton>Adicionar</SubmitButton>
    </form>
  );
}
