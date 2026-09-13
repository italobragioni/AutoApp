"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { FormState } from "@/lib/core/actions";
import {
  STEEL_MATERIAL_SUGGESTIONS,
  SERVICE_TYPES,
  BASE_UNITS,
  MATERIAL_UNITS,
} from "@/lib/niches/serralheria/options";
import { centsToInput } from "@/lib/core/money";
import { Button } from "@/components/ui/button";
import {
  SubmitButton,
  FormError,
  TextField,
  SelectField,
  CheckboxField,
} from "@/components/ui/form";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function SteelMaterialForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const err = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-3">
      <FormError message={state?.ok === false && !state.fieldErrors ? state.error : undefined} />
      <TextField label="Material" name="name" list="steel-materials" placeholder="Ex.: Aço carbono" error={err.name} required />
      <datalist id="steel-materials">
        {STEEL_MATERIAL_SUGGESTIONS.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Unidade de referência" name="unit" defaultValue="kg" error={err.unit}>
          {MATERIAL_UNITS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </SelectField>
        <TextField label="Preço por unidade (R$)" name="pricePerUnitCents" inputMode="decimal" placeholder="0,00" error={err.pricePerUnitCents} required />
      </div>
      <input type="hidden" name="active" value="on" />
      <SubmitButton>Adicionar material</SubmitButton>
    </form>
  );
}

type ProductValues = {
  id?: string;
  name?: string | null;
  serviceType?: string | null;
  baseUnit?: string | null;
  materialName?: string | null;
  materialCostPerBaseCents?: number | null;
  laborCostPerBaseCents?: number | null;
  paintCostPerBaseCents?: number | null;
  weightPerBaseKg?: number | null;
  marginBps?: number | null;
  active?: boolean;
};

export function SteelProductForm({
  action,
  initial,
  materialNames,
}: {
  action: Action;
  initial?: ProductValues;
  materialNames: string[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const err = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-3">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <FormError message={state?.ok === false && !state.fieldErrors ? state.error : undefined} />

      <TextField label="Nome do produto/serviço" name="name" defaultValue={initial?.name ?? ""} placeholder="Ex.: Portão basculante" error={err.name} required />

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Tipo de serviço" name="serviceType" defaultValue={initial?.serviceType ?? "portao"} error={err.serviceType}>
          {SERVICE_TYPES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Unidade base (fórmula)" name="baseUnit" defaultValue={initial?.baseUnit ?? "m2"} error={err.baseUnit}>
          {BASE_UNITS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Material" name="materialName" list="steel-material-names" defaultValue={initial?.materialName ?? ""} placeholder="Ex.: Aço carbono" error={err.materialName} />
        <TextField label="Preço do material (R$ / unid. base)" name="materialCostPerBaseCents" inputMode="decimal" placeholder="0,00" defaultValue={initial?.materialCostPerBaseCents != null ? centsToInput(initial.materialCostPerBaseCents) : ""} error={err.materialCostPerBaseCents} />
      </div>
      <datalist id="steel-material-names">
        {materialNames.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>

      <div className="grid gap-3 sm:grid-cols-3">
        <TextField label="Mão de obra (R$ / unid. base)" name="laborCostPerBaseCents" inputMode="decimal" placeholder="0,00" defaultValue={initial?.laborCostPerBaseCents != null ? centsToInput(initial.laborCostPerBaseCents) : ""} error={err.laborCostPerBaseCents} />
        <TextField label="Pintura (R$ / unid. base)" name="paintCostPerBaseCents" inputMode="decimal" placeholder="0,00" defaultValue={initial?.paintCostPerBaseCents != null ? centsToInput(initial.paintCostPerBaseCents) : ""} error={err.paintCostPerBaseCents} />
        <TextField label="Peso estimado (kg / unid. base)" name="weightPerBaseKg" inputMode="decimal" placeholder="0" defaultValue={initial?.weightPerBaseKg != null ? String(initial.weightPerBaseKg) : ""} error={err.weightPerBaseKg} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Margem sugerida (%)" name="marginBps" inputMode="decimal" defaultValue={initial?.marginBps != null ? String(initial.marginBps / 100) : "20"} error={err.marginBps} required />
        <div className="flex items-end">
          <CheckboxField label="Ativo" name="active" defaultChecked={initial?.active ?? true} />
        </div>
      </div>

      <p className="text-xs text-ink-faint">
        Instalação, deslocamento e outros custos são definidos no orçamento. A margem aplicada é a do orçamento.
      </p>

      <div className="flex gap-3">
        <SubmitButton>Salvar produto</SubmitButton>
        {initial?.id ? (
          <Link href="/serralheria">
            <Button variant="secondary" type="button">
              Cancelar
            </Button>
          </Link>
        ) : null}
      </div>
    </form>
  );
}
