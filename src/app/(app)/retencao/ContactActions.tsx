"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2, PhoneCall } from "lucide-react";

import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { useActionForm } from "@/components/ui/action-form";
import { Modal } from "@/components/ui/modal";
import { registerContactAction, type ContactState } from "@/app/actions/contacts";
import { CONTACT_CHANNEL, CONTACT_OUTCOME } from "@/lib/labels";

/** "YYYY-MM-DDTHH:MM" no fuso do usuario — o formato do input datetime-local. */
function localNow() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Registrando..." : "Registrar contato"}
    </Button>
  );
}

/**
 * Registra que o usuario falou com o cliente.
 *
 * Acao explicita de proposito: clicar no WhatsApp abre a conversa, mas nao
 * garante que a mensagem foi enviada. Quem confirma o contato e o usuario, de
 * volta no AUTOVOLT.
 */
export function RegisterContact({
  customer,
  cooldownDays,
  compact = false,
}: {
  customer: { id: string; name: string };
  cooldownDays: number;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({
    contactedAt: "",
    channel: "whatsapp",
    outcome: "realizado",
    notes: "",
  });

  const { state, onSubmit } = useActionForm<ContactState>(registerContactAction, undefined);

  const set = (field: keyof typeof values) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setValues((current) => ({ ...current, [field]: event.target.value }));

  // A data so e calculada na abertura: no servidor o fuso é outro, e um valor
  // preso no primeiro render envelheceria enquanto a pagina ficasse aberta.
  function openModal() {
    setValues({ contactedAt: localNow(), channel: "whatsapp", outcome: "realizado", notes: "" });
    setOpen(true);
  }

  useEffect(() => {
    if (!state?.ok) return;
    setOpen(false);
    router.refresh();
  }, [state, router]);

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="focus-ring inline-flex items-center gap-1.5 rounded-xl border border-line bg-ink-850 px-3 py-1.5 text-xs font-medium text-soft transition-colors hover:border-ink-600 hover:text-white"
      >
        <PhoneCall size={13} />
        {compact ? "Registrar" : "Registrar contato"}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Registrar contato"
        description={`Contato com ${customer.name}. O estágio de retenção dele não muda.`}
      >
        <form onSubmit={onSubmit} className="space-y-4 p-5" id="contact-form">
          <input type="hidden" name="customerId" value={customer.id} />

          {state?.error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-2.5 text-xs text-rose-200"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {state.error}
            </p>
          )}

          <Field label="Data e hora do contato">
            <Input
              type="datetime-local"
              name="contactedAt"
              required
              value={values.contactedAt}
              onChange={set("contactedAt")}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de contato">
              <Select name="channel" value={values.channel} onChange={set("channel")}>
                {Object.entries(CONTACT_CHANNEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Status do contato">
              <Select name="outcome" value={values.outcome} onChange={set("outcome")}>
                {Object.entries(CONTACT_OUTCOME).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Observação" hint="Opcional. O que ficou combinado, por exemplo.">
            <Textarea
              name="notes"
              maxLength={1000}
              value={values.notes}
              onChange={set("notes")}
              placeholder="Ex.: pediu para chamar de novo depois do dia 20."
            />
          </Field>

          <p className="flex items-start gap-2 rounded-xl border border-line bg-ink-850 px-3.5 py-2.5 text-xs leading-relaxed text-muted">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-volt-400" />
            {customer.name.split(" ")[0]} sai da fila de prioridade por {cooldownDays} dias. O
            estágio de retenção continua sendo calculado normalmente e ele volta à fila depois
            desse período, caso não retorne.
          </p>

          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Submit />
          </div>
        </form>
      </Modal>
    </>
  );
}
