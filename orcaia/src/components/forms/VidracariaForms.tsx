"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/core/actions";
import {
  GLASS_TYPE_SUGGESTIONS,
  THICKNESS_SUGGESTIONS_MM,
  FINISH_SUGGESTIONS,
  HARDWARE_SUGGESTIONS,
  FINISH_UNITS,
} from "@/lib/niches/vidracaria/options";
import { SubmitButton, FormError, TextField, SelectField } from "@/components/ui/form";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function GlassOptionForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const err = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-3">
      <FormError message={state?.ok === false && !state.fieldErrors ? state.error : undefined} />
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField label="Tipo de vidro" name="glassType" list="glass-types" placeholder="Ex.: Temperado" error={err.glassType} required />
        <TextField label="Espessura (mm)" name="thicknessMm" type="number" min={1} list="glass-thicknesses" placeholder="Ex.: 8" error={err.thicknessMm} required />
        <TextField label="Preço por m² (R$)" name="pricePerM2Cents" inputMode="decimal" placeholder="0,00" error={err.pricePerM2Cents} required />
      </div>
      <datalist id="glass-types">
        {GLASS_TYPE_SUGGESTIONS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <datalist id="glass-thicknesses">
        {THICKNESS_SUGGESTIONS_MM.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <input type="hidden" name="active" value="on" />
      <SubmitButton>Adicionar vidro</SubmitButton>
    </form>
  );
}

export function FinishOptionForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const err = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-3">
      <FormError message={state?.ok === false && !state.fieldErrors ? state.error : undefined} />
      <TextField label="Acabamento" name="name" list="finish-names" placeholder="Ex.: Lapidado" error={err.name} required />
      <datalist id="finish-names">
        {FINISH_SUGGESTIONS.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Cobrança" name="unit" defaultValue="ml" error={err.unit}>
          {FINISH_UNITS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </SelectField>
        <TextField label="Preço (R$)" name="priceCents" inputMode="decimal" placeholder="0,00" error={err.priceCents} required />
      </div>
      <input type="hidden" name="active" value="on" />
      <SubmitButton>Adicionar acabamento</SubmitButton>
    </form>
  );
}

export function HardwareOptionForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const err = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-3">
      <FormError message={state?.ok === false && !state.fieldErrors ? state.error : undefined} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Ferragem" name="name" list="hardware-names" placeholder="Ex.: Dobradiça" error={err.name} required />
        <TextField label="Preço por unidade (R$)" name="priceCents" inputMode="decimal" placeholder="0,00" error={err.priceCents} required />
      </div>
      <datalist id="hardware-names">
        {HARDWARE_SUGGESTIONS.map((h) => (
          <option key={h} value={h} />
        ))}
      </datalist>
      <input type="hidden" name="active" value="on" />
      <SubmitButton>Adicionar ferragem</SubmitButton>
    </form>
  );
}
