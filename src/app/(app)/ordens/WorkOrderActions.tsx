"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Ban, CheckCheck, Package, Play, RotateCcw, Wallet } from "lucide-react";

import { Button, Field, Input, Select } from "@/components/ui";
import { useActionForm } from "@/components/ui/action-form";
import { Modal } from "@/components/ui/modal";
import {
  changeWorkOrderStatusAction,
  completeWorkOrderAction,
  type WorkOrderState,
} from "@/app/actions/work-orders";
import { cn, money } from "@/lib/format";
import { PAYMENT_LABEL } from "@/lib/labels";

/**
 * Acoes rapidas da OS. Usa os status que ja existem no schema — nao ha
 * estrutura paralela aqui.
 */
const ACTIONS: Record<
  string,
  { label: string; icon: typeof Play; tone: "volt" | "warning" | "muted" | "info" }
> = {
  aberta: { label: "Reabrir", icon: RotateCcw, tone: "info" },
  em_andamento: { label: "Iniciar serviço", icon: Play, tone: "volt" },
  aguardando_retirada: { label: "Aguardando retirada", icon: Package, tone: "warning" },
  cancelada: { label: "Cancelar", icon: Ban, tone: "muted" },
};

/** Proximos status a partir do atual. Concluir tem fluxo proprio, com pagamento. */
function nextStatuses(current: string): string[] {
  switch (current) {
    case "aberta":
      return ["em_andamento", "cancelada"];
    case "em_andamento":
      return ["aguardando_retirada", "cancelada"];
    case "aguardando_retirada":
      return ["em_andamento"];
    case "concluida":
      return ["aguardando_retirada"];
    case "cancelada":
      return ["aberta"];
    default:
      return [];
  }
}

function StatusButton({ status }: { status: string }) {
  const { pending } = useFormStatus();
  const meta = ACTIONS[status] ?? { label: status, icon: Play, tone: "muted" as const };
  const Icon = meta.icon;
  const tone = {
    volt: "text-volt-300 hover:bg-volt-400/10",
    warning: "text-amber-300 hover:bg-amber-400/10",
    info: "text-sky-300 hover:bg-sky-400/10",
    muted: "text-muted hover:bg-ink-800 hover:text-soft",
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
  const { state, onSubmit } = useActionForm<WorkOrderState>(
    changeWorkOrderStatusAction,
    undefined,
  );

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

export function WorkOrderStatusActions({
  order,
}: {
  order: { id: string; status: string };
}) {
  const options = nextStatuses(order.status);
  if (options.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {options.map((status) => (
        <OneStatus key={status} id={order.id} status={status} />
      ))}
    </div>
  );
}

function ConfirmPayment() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Registrando..." : "Concluir e registrar pagamento"}
    </Button>
  );
}

/**
 * Conclusao da OS com registro de pagamento.
 *
 * Grava nos campos que ja existem: `paymentMethod`, `totalCents` (valor
 * efetivamente cobrado) e `finishedAt`. E esse conjunto que o faturamento,
 * os relatorios e o motor de retencao consultam.
 */
export function CompleteWorkOrder({
  order,
}: {
  order: { id: string; totalCents: number; status: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { state, onSubmit } = useActionForm<WorkOrderState>(completeWorkOrderAction, undefined);

  const [values, setValues] = useState({
    paymentMethod: "pix",
    paidAmount: (order.totalCents / 100).toFixed(2).replace(".", ","),
    finishedAt: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    if (!state?.ok) return;
    setOpen(false);
    router.refresh();
  }, [state, router]);

  if (order.status === "concluida") return null;

  return (
    <>
      <Button type="button" size="md" onClick={() => setOpen(true)}>
        <CheckCheck size={16} />
        Concluir e receber
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Concluir ordem de serviço"
        description="Registre o pagamento. É isto que entra no faturamento."
      >
        <form onSubmit={onSubmit} className="space-y-4 p-5" id="complete-form">
          <input type="hidden" name="id" value={order.id} />

          {state?.error && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-2.5 text-xs text-rose-200"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {state.error}
            </p>
          )}

          <div className="flex items-center justify-between rounded-xl border border-line bg-ink-850 px-3.5 py-3">
            <span className="flex items-center gap-2 text-xs text-muted">
              <Wallet size={14} />
              Total da OS
            </span>
            <span className="font-display text-base font-bold text-white">
              {money(order.totalCents)}
            </span>
          </div>

          <Field label="Forma de pagamento">
            <Select
              name="paymentMethod"
              value={values.paymentMethod}
              onChange={(e) => setValues((v) => ({ ...v, paymentMethod: e.target.value }))}
            >
              {Object.entries(PAYMENT_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Valor recebido" hint="Ajuste se cobrou diferente do total.">
              <Input
                name="paidAmount"
                inputMode="decimal"
                required
                value={values.paidAmount}
                onChange={(e) => setValues((v) => ({ ...v, paidAmount: e.target.value }))}
              />
            </Field>
            <Field label="Data de conclusão">
              <Input
                type="date"
                name="finishedAt"
                required
                value={values.finishedAt}
                onChange={(e) => setValues((v) => ({ ...v, finishedAt: e.target.value }))}
              />
            </Field>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <ConfirmPayment />
          </div>
        </form>
      </Modal>
    </>
  );
}
