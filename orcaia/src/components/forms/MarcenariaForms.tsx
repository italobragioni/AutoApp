"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { FormState } from "@/lib/core/actions";
import {
  WOOD_MATERIAL_SUGGESTIONS,
  THICKNESS_SUGGESTIONS_MM,
  FINISH_SUGGESTIONS,
  HARDWARE_SUGGESTIONS,
  TEMPLATE_SUGGESTIONS,
  AREA_MODES,
} from "@/lib/niches/marcenaria/options";
import { centsToInput } from "@/lib/core/money";
import { Button } from "@/components/ui/button";
import { SubmitButton, FormError, TextField, SelectField, CheckboxField } from "@/components/ui/form";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;
type Option = { id: string; label: string };

export function WoodMaterialForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const err = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-3">
      <FormError message={state?.ok === false && !state.fieldErrors ? state.error : undefined} />
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField label="Material" name="name" list="wood-materials" placeholder="Ex.: MDF" error={err.name} required />
        <TextField label="Espessura (mm)" name="thicknessMm" type="number" min={1} list="wood-thicknesses" placeholder="Ex.: 18" error={err.thicknessMm} required />
        <TextField label="Preço por m² (R$)" name="pricePerM2Cents" inputMode="decimal" placeholder="0,00" error={err.pricePerM2Cents} required />
      </div>
      <datalist id="wood-materials">{WOOD_MATERIAL_SUGGESTIONS.map((m) => <option key={m} value={m} />)}</datalist>
      <datalist id="wood-thicknesses">{THICKNESS_SUGGESTIONS_MM.map((t) => <option key={t} value={t} />)}</datalist>
      <input type="hidden" name="active" value="on" />
      <SubmitButton>Adicionar material</SubmitButton>
    </form>
  );
}

export function WoodFinishForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const err = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-3">
      <FormError message={state?.ok === false && !state.fieldErrors ? state.error : undefined} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Acabamento" name="name" list="wood-finishes" placeholder="Ex.: Melamínico" error={err.name} required />
        <TextField label="Preço por m² (R$)" name="pricePerM2Cents" inputMode="decimal" placeholder="0,00" error={err.pricePerM2Cents} required />
      </div>
      <datalist id="wood-finishes">{FINISH_SUGGESTIONS.map((f) => <option key={f} value={f} />)}</datalist>
      <input type="hidden" name="active" value="on" />
      <SubmitButton>Adicionar acabamento</SubmitButton>
    </form>
  );
}

export function WoodHardwareForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const err = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-3">
      <FormError message={state?.ok === false && !state.fieldErrors ? state.error : undefined} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Ferragem" name="name" list="wood-hardware" placeholder="Ex.: Dobradiças" error={err.name} required />
        <TextField label="Preço por unidade (R$)" name="priceCents" inputMode="decimal" placeholder="0,00" error={err.priceCents} required />
      </div>
      <datalist id="wood-hardware">{HARDWARE_SUGGESTIONS.map((h) => <option key={h} value={h} />)}</datalist>
      <input type="hidden" name="active" value="on" />
      <SubmitButton>Adicionar ferragem</SubmitButton>
    </form>
  );
}

type TemplateValues = {
  id?: string;
  name?: string | null;
  category?: string | null;
  areaMode?: string | null;
  materialId?: string | null;
  finishId?: string | null;
  laborPerM2Cents?: number | null;
  assemblyPerM2Cents?: number | null;
  marginBps?: number | null;
  defaultWidthMm?: number | null;
  defaultHeightMm?: number | null;
  defaultDepthMm?: number | null;
};

export function WoodTemplateForm({
  action,
  initial,
  materials,
  finishes,
  hardware,
  hardwareQty,
}: {
  action: Action;
  initial?: TemplateValues;
  materials: Option[];
  finishes: Option[];
  hardware: { id: string; name: string; priceLabel: string }[];
  hardwareQty?: Record<string, number>;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const err = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-3">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <FormError message={state?.ok === false && !state.fieldErrors ? state.error : undefined} />

      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Nome do modelo" name="name" list="wood-templates" defaultValue={initial?.name ?? ""} placeholder="Ex.: Guarda-roupa" error={err.name} required />
        <TextField label="Categoria (opcional)" name="category" defaultValue={initial?.category ?? ""} error={err.category} />
      </div>
      <datalist id="wood-templates">{TEMPLATE_SUGGESTIONS.map((t) => <option key={t} value={t} />)}</datalist>

      <SelectField label="Modo de área" name="areaMode" defaultValue={initial?.areaMode ?? "caixa"} error={err.areaMode}>
        {AREA_MODES.map((a) => (
          <option key={a.value} value={a.value}>
            {a.label}
          </option>
        ))}
      </SelectField>

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Material padrão" name="materialId" defaultValue={initial?.materialId ?? ""} error={err.materialId}>
          <option value="">— selecione —</option>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Acabamento padrão" name="finishId" defaultValue={initial?.finishId ?? ""} error={err.finishId}>
          <option value="">— sem acabamento —</option>
          {finishes.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <TextField label="Mão de obra (R$/m²)" name="laborPerM2Cents" inputMode="decimal" placeholder="0,00" defaultValue={initial?.laborPerM2Cents != null ? centsToInput(initial.laborPerM2Cents) : ""} error={err.laborPerM2Cents} />
        <TextField label="Montagem (R$/m²)" name="assemblyPerM2Cents" inputMode="decimal" placeholder="0,00" defaultValue={initial?.assemblyPerM2Cents != null ? centsToInput(initial.assemblyPerM2Cents) : ""} error={err.assemblyPerM2Cents} />
        <TextField label="Margem sugerida (%)" name="marginBps" inputMode="decimal" defaultValue={initial?.marginBps != null ? String(initial.marginBps / 100) : "20"} error={err.marginBps} required />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <TextField label="Largura padrão (mm)" name="defaultWidthMm" type="number" min={0} defaultValue={initial?.defaultWidthMm ?? ""} />
        <TextField label="Altura padrão (mm)" name="defaultHeightMm" type="number" min={0} defaultValue={initial?.defaultHeightMm ?? ""} />
        <TextField label="Profundidade padrão (mm)" name="defaultDepthMm" type="number" min={0} defaultValue={initial?.defaultDepthMm ?? ""} />
      </div>

      {hardware.length > 0 ? (
        <div>
          <p className="mb-1 text-sm font-medium text-ink-soft">Ferragens do modelo (quantidade)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {hardware.map((h) => (
              <label key={h.id} className="flex items-center justify-between gap-2 rounded-lg border border-surface-border px-3 py-2 text-sm">
                <span className="text-ink">
                  {h.name} <span className="text-ink-faint">({h.priceLabel})</span>
                </span>
                <input type="number" name={`hw_${h.id}`} min={0} defaultValue={hardwareQty?.[h.id] ?? 0} className="w-16 rounded border border-surface-border px-2 py-1 text-right text-sm" />
              </label>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-faint">Cadastre ferragens para incluí-las nos modelos.</p>
      )}

      <input type="hidden" name="active" value="on" />
      <div className="flex gap-3">
        <SubmitButton>Salvar modelo</SubmitButton>
        {initial?.id ? (
          <Link href="/marcenaria">
            <Button variant="secondary" type="button">
              Cancelar
            </Button>
          </Link>
        ) : null}
      </div>
    </form>
  );
}
