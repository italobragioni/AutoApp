"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
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
type Option = { id: string; label: string };

type HeaderValues = {
  id?: string;
  customerId?: string;
  validUntil?: string;
  marginValue: string;
  installationValue: string;
  travelValue: string;
  otherValue: string;
  discountValue: string;
  deliveryTime?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
};

export function WoodQuoteHeaderForm({
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
        <option value="" disabled>Selecione...</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </SelectField>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Validade" name="validUntil" type="date" defaultValue={initial.validUntil ?? ""} error={err.validUntil} />
        <TextField label="Margem de lucro (%)" name="marginBps" inputMode="decimal" defaultValue={initial.marginValue} error={err.marginBps} required />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <TextField label="Instalação (R$)" name="installationCents" inputMode="decimal" placeholder="0,00" defaultValue={initial.installationValue} error={err.installationCents} />
        <TextField label="Deslocamento (R$)" name="travelCents" inputMode="decimal" placeholder="0,00" defaultValue={initial.travelValue} error={err.travelCents} />
        <TextField label="Outros custos (R$)" name="otherCents" inputMode="decimal" placeholder="0,00" defaultValue={initial.otherValue} error={err.otherCents} />
      </div>

      <TextField label="Desconto (R$)" name="discountCents" inputMode="decimal" placeholder="0,00" defaultValue={initial.discountValue} error={err.discountCents} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Prazo estimado" name="deliveryTime" placeholder="Ex.: 30 dias" defaultValue={initial.deliveryTime ?? ""} error={err.deliveryTime} />
        <TextField label="Condições de pagamento" name="paymentTerms" placeholder="Ex.: 40% entrada, saldo na montagem" defaultValue={initial.paymentTerms ?? ""} error={err.paymentTerms} />
      </div>

      <TextAreaField label="Observações" name="notes" rows={2} defaultValue={initial.notes ?? ""} error={err.notes} />

      <div className="flex gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Link href="/orcamentos">
          <Button variant="secondary" type="button">Voltar</Button>
        </Link>
      </div>
    </form>
  );
}

export function WoodAddItemForm({
  action,
  quoteId,
  templates,
  materials,
  finishes,
}: {
  action: Action;
  quoteId: string;
  templates: Option[];
  materials: Option[];
  finishes: Option[];
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

      <TextField label="Descrição" name="description" placeholder="Ex.: Guarda-roupa 6 portas" error={err.description} required />

      <SelectField label="Modelo de produto" name="templateId" defaultValue="" error={err.templateId} required>
        <option value="" disabled>Selecione um modelo...</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </SelectField>

      <p className="text-xs text-ink-faint">
        O modelo já traz material, acabamento, ferragens, mão de obra e montagem. Você pode sobrescrever material/acabamento abaixo.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Material (opcional)" name="materialId" defaultValue="">
          <option value="">Usar do modelo</option>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </SelectField>
        <SelectField label="Acabamento (opcional)" name="finishId" defaultValue="">
          <option value="">Usar do modelo</option>
          {finishes.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </SelectField>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <TextField label="Largura (mm)" name="widthMm" type="number" min={0} inputMode="numeric" />
        <TextField label="Altura (mm)" name="heightMm" type="number" min={0} inputMode="numeric" />
        <TextField label="Profundidade (mm)" name="depthMm" type="number" min={0} inputMode="numeric" />
      </div>

      <TextField label="Quantidade" name="quantity" type="number" min={1} defaultValue={1} inputMode="numeric" error={err.quantity} required />

      <SubmitButton>Adicionar item</SubmitButton>
    </form>
  );
}
