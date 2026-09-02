"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { FileText, Wrench } from "lucide-react";

import { useActionForm } from "@/components/ui/action-form";
import {
  createWorkOrderFromAppointmentAction,
  type WorkOrderState,
} from "@/app/actions/work-orders";

function CreateButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[0.7rem] font-medium text-volt-300 transition-colors hover:bg-volt-400/10 disabled:opacity-60"
    >
      <Wrench size={12} />
      {pending ? "Criando..." : "Criar OS"}
    </button>
  );
}

/**
 * Cria a OS a partir do agendamento, ou leva para a OS que ja existe.
 *
 * Quando `workOrderId` vem preenchido, o agendamento ja tem OS vinculada — a
 * interface oferece abrir a existente em vez de criar outra. O `appointmentId`
 * e `@unique` no schema, entao a duplicacao tambem e impossivel no banco.
 */
export function CreateWorkOrderFromAppointment({
  appointmentId,
  workOrderId,
}: {
  appointmentId: string;
  workOrderId: string | null;
}) {
  const { state, onSubmit } = useActionForm<WorkOrderState>(
    createWorkOrderFromAppointmentAction,
    undefined,
  );

  // Ja existe OS: abre a existente.
  const existing = workOrderId ?? state?.existingId;
  if (existing) {
    return (
      <Link
        href={`/ordens/${existing}`}
        className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[0.7rem] font-medium text-sky-300 transition-colors hover:bg-sky-400/10"
      >
        <FileText size={12} />
        Abrir OS
      </Link>
    );
  }

  return (
    <form onSubmit={onSubmit} className="contents">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <CreateButton />
      {state?.error && (
        <span role="alert" className="text-[0.68rem] text-rose-300">
          {state.error}
        </span>
      )}
    </form>
  );
}
