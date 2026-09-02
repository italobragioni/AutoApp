"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  CalendarClock,
  Check,
  FileText,
  Pencil,
  Send,
  Trash2,
  Wrench,
  X,
} from "lucide-react";

import { Button, Field, Input } from "@/components/ui";
import { useActionForm } from "@/components/ui/action-form";
import { Modal } from "@/components/ui/modal";
import {
  changeQuoteStatusAction,
  convertQuoteToWorkOrderAction,
  deleteQuoteAction,
  renewQuoteAction,
  type QuoteState,
} from "@/app/actions/quotes";
import { cn } from "@/lib/format";

/** Acoes de status — todas usam os status que ja existem no schema. */
const ACTIONS: Record<
  string,
  { label: string; icon: typeof Check; tone: "volt" | "info" | "muted" | "danger" }
> = {
  rascunho: { label: "Reabrir como rascunho", icon: Pencil, tone: "info" },
  enviado: { label: "Marcar como enviado", icon: Send, tone: "info" },
  aprovado: { label: "Aprovar", icon: Check, tone: "volt" },
  recusado: { label: "Recusar", icon: X, tone: "danger" },
  cancelado: { label: "Cancelar", icon: Ban, tone: "muted" },
};

/** Proximos status coerentes com o funil comercial. */
export function nextQuoteStatuses(current: string): string[] {
  switch (current) {
    case "rascunho":
      return ["enviado", "aprovado", "cancelado"];
    case "enviado":
      return ["aprovado", "recusado", "cancelado"];
    case "expirado":
      // Vencido nao aprova direto: primeiro revalida (acao propria).
      return ["cancelado"];
    case "aprovado":
      return ["rascunho"]; // reabrir para editar valores
    case "recusado":
    case "cancelado":
      return ["rascunho"];
    default:
      return [];
  }
}

function StatusButton({ status }: { status: string }) {
  const { pending } = useFormStatus();
  const meta = ACTIONS[status] ?? { label: status, icon: Check, tone: "muted" as const };
  const Icon = meta.icon;
  const tone = {
    volt: "text-volt-300 hover:bg-volt-400/10",
    info: "text-sky-300 hover:bg-sky-400/10",
    muted: "text-muted hover:bg-ink-800 hover:text-soft",
    danger: "text-rose-300 hover:bg-rose-400/10",
  }[meta.tone];

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "focus-ring inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-60",
        tone,
      )}
    >
      <Icon size={13} />
      {pending ? "..." : meta.label}
    </button>
  );
}

function OneStatus({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const { state, onSubmit } = useActionForm<QuoteState>(changeQuoteStatusAction, undefined);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form onSubmit={onSubmit} className="contents">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <StatusButton status={status} />
      {state?.error && (
        <span role="alert" className="text-[0.68rem] text-rose-300">
          {state.error}
        </span>
      )}
    </form>
  );
}

export function QuoteStatusActions({ quote }: { quote: { id: string; status: string } }) {
  const options = nextQuoteStatuses(quote.status);
  if (options.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {options.map((status) => (
        <OneStatus key={status} id={quote.id} status={status} />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Revalidar um orcamento vencido                                              */
/* -------------------------------------------------------------------------- */

function RenewButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Salvando..." : "Atualizar validade"}
    </Button>
  );
}

/**
 * Um orcamento vencido nao pode ser aprovado nem convertido direto. Esta e a
 * acao explicita que o usuario precisa tomar antes.
 */
export function RenewQuote({ quote }: { quote: { id: string; validUntil: string | null } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { state, onSubmit } = useActionForm<QuoteState>(renewQuoteAction, undefined);

  const defaultDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  };
  const [validUntil, setValidUntil] = useState(defaultDate());

  useEffect(() => {
    if (!state?.ok) return;
    setOpen(false);
    router.refresh();
  }, [state, router]);

  return (
    <>
      <Button type="button" variant="secondary" size="md" onClick={() => setOpen(true)}>
        <CalendarClock size={16} />
        Revalidar
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Atualizar validade"
        description="Um orçamento vencido só volta a circular depois desta ação."
      >
        <form onSubmit={onSubmit} className="space-y-4 p-5" id="renew-form">
          <input type="hidden" name="id" value={quote.id} />

          {state?.error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-2.5 text-xs text-rose-200"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {state.error}
            </p>
          )}

          <Field label="Nova validade" hint="O orçamento volta para 'enviado'.">
            <Input
              type="date"
              name="validUntil"
              required
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <RenewButton />
          </div>
        </form>
      </Modal>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Conversao em Ordem de Servico                                               */
/* -------------------------------------------------------------------------- */

function ConvertButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="md">
      <Wrench size={16} />
      {pending ? "Convertendo..." : "Converter em OS"}
    </Button>
  );
}

/**
 * Converte o orcamento aprovado em OS, ou abre a OS que ja existe.
 *
 * `quoteId` e @unique na WorkOrder: a duplicacao e impossivel no banco. Quando
 * ja ha OS, a interface mostra "Abrir OS" no lugar de converter.
 */
export function ConvertQuote({
  quote,
  workOrderId,
}: {
  quote: { id: string; status: string; expired: boolean };
  workOrderId: string | null;
}) {
  const { state, onSubmit } = useActionForm<QuoteState>(
    convertQuoteToWorkOrderAction,
    undefined,
  );

  const existing = workOrderId ?? state?.workOrderId;
  if (existing) {
    return (
      <Link
        href={`/ordens/${existing}`}
        className="focus-ring inline-flex h-10 items-center gap-2 rounded-xl bg-ink-800 px-4 text-sm text-white ring-1 ring-inset ring-ink-600 transition-colors hover:bg-ink-700"
      >
        <FileText size={16} />
        Abrir OS
      </Link>
    );
  }

  if (quote.status !== "aprovado") return null;

  if (quote.expired) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
        <AlertTriangle size={13} />
        Vencido — revalide para converter
      </span>
    );
  }

  return (
    <form onSubmit={onSubmit} className="contents">
      <input type="hidden" name="id" value={quote.id} />
      <ConvertButton />
      {state?.error && (
        <span role="alert" className="text-[0.68rem] text-rose-300">
          {state.error}
        </span>
      )}
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Exclusao                                                                    */
/* -------------------------------------------------------------------------- */

function DeleteButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Excluindo..." : "Excluir orçamento"}
    </Button>
  );
}

export function DeleteQuote({ quote }: { quote: { id: string; number: number } }) {
  const [open, setOpen] = useState(false);
  const { state, onSubmit } = useActionForm<QuoteState>(deleteQuoteAction, undefined);

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="md"
        onClick={() => setOpen(true)}
        className="text-rose-300 hover:text-rose-200"
      >
        <Trash2 size={16} />
        Excluir
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Excluir orçamento"
        description="Esta ação não pode ser desfeita."
      >
        <form onSubmit={onSubmit} className="space-y-4 p-5" id="delete-quote-form">
          <input type="hidden" name="id" value={quote.id} />

          {state?.error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-2.5 text-xs text-rose-200"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {state.error}
            </p>
          )}

          <p className="text-sm text-soft">
            Excluir o orçamento{" "}
            <strong className="text-white">#{String(quote.number).padStart(4, "0")}</strong>?
          </p>
          <p className="text-xs leading-relaxed text-muted">
            Se ele já virou ordem de serviço, a exclusão é recusada — nesse caso, cancele em vez
            de excluir.
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
            <DeleteButton />
          </div>
        </form>
      </Modal>
    </>
  );
}
