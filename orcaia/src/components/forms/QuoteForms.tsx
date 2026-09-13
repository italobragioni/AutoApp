"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";
import type { FormState } from "@/lib/core/actions";
import { Button } from "@/components/ui/button";
import {
  SubmitButton,
  FormError,
  FormSuccess,
  TextField,
  SelectField,
  TextAreaField,
} from "@/components/ui/form";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

type Customer = { id: string; name: string };
type GlassOption = { id: string; label: string };
type FinishOption = { id: string; label: string };
type Hardware = { id: string; name: string; priceLabel: string };

type HeaderValues = {
  id?: string;
  customerId?: string;
  validUntil?: string;
  marginValue: string;
  installationValue: string;
  travelValue: string;
  otherValue: string;
  notes?: string | null;
};

// Cabecalho do orcamento (criar ou editar).
export function QuoteHeaderForm({
  action,
  customers,
  initial,
  submitLabel,
  isEdit,
}: {
  action: Action;
  customers: Customer[];
  initial: HeaderValues;
  submitLabel: string;
  isEdit?: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const err = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4">
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <FormError message={state?.ok === false && !state.fieldErrors ? state.error : undefined} />
      {isEdit ? <FormSuccess message={state?.ok ? "Alteracoes salvas." : undefined} /> : null}

      <SelectField label="Cliente" name="customerId" defaultValue={initial.customerId ?? ""} error={err.customerId} required>
        <option value="" disabled>
          Selecione...
        </option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </SelectField>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Validade" name="validUntil" type="date" defaultValue={initial.validUntil ?? ""} error={err.validUntil} />
        <TextField label="Margem de lucro (%)" name="marginBps" inputMode="decimal" defaultValue={initial.marginValue} error={err.marginBps} required />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Instalação / mão de obra (R$)" name="installationCents" inputMode="decimal" placeholder="0,00" defaultValue={initial.installationValue} error={err.installationCents} />
        <TextField label="Deslocamento (R$)" name="travelCents" inputMode="decimal" placeholder="0,00" defaultValue={initial.travelValue} error={err.travelCents} />
        <TextField label="Outros custos (R$)" name="otherCents" inputMode="decimal" placeholder="0,00" defaultValue={initial.otherValue} error={err.otherCents} />
      </div>

      <TextAreaField label="Observações" name="notes" rows={2} defaultValue={initial.notes ?? ""} error={err.notes} />

      <div className="flex gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link href="/orcamentos">
          <Button variant="secondary" type="button">
            Voltar
          </Button>
        </Link>
      </div>
    </form>
  );
}

// Adicionar item (peca de vidro) ao orcamento.
export function AddItemForm({
  action,
  quoteId,
  glassOptions,
  finishOptions,
  hardware,
}: {
  action: Action;
  quoteId: string;
  glassOptions: GlassOption[];
  finishOptions: FinishOption[];
  hardware: Hardware[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const err = state?.fieldErrors ?? {};
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="quoteId" value={quoteId} />
      <FormError message={state?.ok === false && !state.fieldErrors ? state.error : undefined} />

      <TextField label="Produto / descrição" name="description" placeholder="Ex.: Box de correr" error={err.description} required />

      <div className="grid gap-3 sm:grid-cols-3">
        <TextField label="Largura (mm)" name="widthMm" type="number" min={1} inputMode="numeric" error={err.widthMm} required />
        <TextField label="Altura (mm)" name="heightMm" type="number" min={1} inputMode="numeric" error={err.heightMm} required />
        <TextField label="Quantidade" name="quantity" type="number" min={1} defaultValue={1} inputMode="numeric" error={err.quantity} required />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Vidro (tipo + espessura)" name="glassOptionId" defaultValue="" error={err.glassOptionId} required>
          <option value="" disabled>
            Selecione...
          </option>
          {glassOptions.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Acabamento (opcional)" name="finishOptionId" defaultValue="">
          <option value="">Sem acabamento</option>
          {finishOptions.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </SelectField>
      </div>

      {hardware.length > 0 ? (
        <div>
          <p className="mb-1 text-sm font-medium text-ink-soft">Ferragens (quantidade)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {hardware.map((h) => (
              <label key={h.id} className="flex items-center justify-between gap-2 rounded-lg border border-surface-border px-3 py-2 text-sm">
                <span className="text-ink">
                  {h.name} <span className="text-ink-faint">({h.priceLabel})</span>
                </span>
                <input
                  type="number"
                  name={`hw_${h.id}`}
                  min={0}
                  defaultValue={0}
                  className="w-16 rounded border border-surface-border px-2 py-1 text-right text-sm"
                />
              </label>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-ink-faint">
          Nenhuma ferragem cadastrada ainda (cadastre em Vidros, se precisar).
        </p>
      )}

      <SubmitButton>Adicionar item</SubmitButton>
    </form>
  );
}

// Controle de status do orcamento (submete ao mudar).
export function StatusControl({
  action,
  id,
  status,
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: string;
  status: string;
}) {
  const options = [
    ["rascunho", "Rascunho"],
    ["enviado", "Enviado"],
    ["aprovado", "Aprovado"],
    ["recusado", "Recusado"],
    ["expirado", "Expirado"],
    ["cancelado", "Cancelado"],
  ];
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="text-sm text-ink-soft">Status:</label>
      <select
        name="status"
        defaultValue={status}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-lg border border-surface-border bg-white px-3 py-1.5 text-sm font-medium text-ink"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </form>
  );
}

export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()} className="print:hidden">
      <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
    </Button>
  );
}
