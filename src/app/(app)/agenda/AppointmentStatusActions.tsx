"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Ban, CalendarX, Check, CheckCheck, Play, RotateCcw } from "lucide-react";

import {
  changeAppointmentStatusAction,
  type AppointmentState,
} from "@/app/actions/appointments";
import { cn } from "@/lib/format";

/**
 * Acoes rapidas de status na propria agenda.
 *
 * Usa exatamente os status do schema (APPOINTMENT_STATUS) — nao ha estrutura
 * paralela aqui. Cada botao apenas envia o proximo status para a action.
 */
const ACTIONS: Record<
  string,
  { label: string; icon: typeof Check; tone: "volt" | "info" | "muted" | "danger" }
> = {
  // Volta um cancelamento ou nao comparecimento para a agenda.
  agendado: { label: "Reagendar", icon: RotateCcw, tone: "info" },
  confirmado: { label: "Confirmar", icon: Check, tone: "info" },
  em_andamento: { label: "Iniciar", icon: Play, tone: "volt" },
  concluido: { label: "Finalizar", icon: CheckCheck, tone: "volt" },
  cancelado: { label: "Cancelar", icon: Ban, tone: "muted" },
  nao_compareceu: { label: "Não compareceu", icon: CalendarX, tone: "danger" },
};

/** Próximos status que fazem sentido a partir do atual. */
function nextStatuses(current: string): string[] {
  switch (current) {
    case "agendado":
      return ["confirmado", "em_andamento", "cancelado", "nao_compareceu"];
    case "confirmado":
      return ["em_andamento", "cancelado", "nao_compareceu"];
    case "em_andamento":
      return ["concluido", "cancelado"];
    case "concluido":
      return [];
    // Cancelado e não compareceu podem voltar para a agenda.
    case "cancelado":
    case "nao_compareceu":
      return ["agendado", "confirmado"];
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
        "focus-ring inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[0.7rem] font-medium transition-colors disabled:opacity-60",
        tone,
      )}
    >
      <Icon size={12} />
      {pending ? "..." : meta.label}
    </button>
  );
}

function OneAction({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [state, formAction] = useActionState<AppointmentState, FormData>(
    changeAppointmentStatusAction,
    undefined,
  );

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="contents">
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

export function AppointmentStatusActions({
  appointment,
}: {
  appointment: { id: string; status: string };
}) {
  const options = nextStatuses(appointment.status);
  if (options.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {options.map((status) => (
        <OneAction key={status} id={appointment.id} status={status} />
      ))}
    </div>
  );
}
