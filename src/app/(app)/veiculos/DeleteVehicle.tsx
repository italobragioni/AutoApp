"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import { deleteVehicleAction, type VehicleState } from "@/app/actions/vehicles";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Excluindo..." : "Excluir veículo"}
    </Button>
  );
}

/**
 * Exclusao de veiculo com confirmacao.
 *
 * Diferente de Clientes, aqui o historico NAO se perde: as relacoes de
 * Appointment, Quote e WorkOrder usam `onDelete: SetNull`, entao as ordens de
 * servico continuam existindo (e continuam contando no faturamento), apenas sem
 * veiculo vinculado. Por isso a confirmacao e um passo simples, sem exigir
 * digitacao — o risco e menor e a mensagem explica exatamente o que acontece.
 */
export function DeleteVehicle({
  vehicle,
  counts,
}: {
  vehicle: { id: string; label: string };
  counts: { appointments: number; quotes: number; workOrders: number };
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<VehicleState, FormData>(
    deleteVehicleAction,
    undefined,
  );

  const historico = counts.appointments + counts.quotes + counts.workOrders;

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
        title="Excluir veículo"
        description="Esta ação não pode ser desfeita."
      >
        <form action={formAction} className="space-y-4 p-5">
          <input type="hidden" name="id" value={vehicle.id} />

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
            Você está prestes a excluir <strong className="text-white">{vehicle.label}</strong>.
          </p>

          {historico > 0 && (
            <div className="rounded-xl border border-line bg-ink-850 p-3.5">
              <p className="text-xs font-medium text-soft">O histórico é preservado</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">
                Este veículo tem {counts.workOrders}{" "}
                {counts.workOrders === 1 ? "ordem de serviço" : "ordens de serviço"},{" "}
                {counts.appointments}{" "}
                {counts.appointments === 1 ? "agendamento" : "agendamentos"} e {counts.quotes}{" "}
                {counts.quotes === 1 ? "orçamento" : "orçamentos"}. Esses registros continuam
                existindo e seguem contando no faturamento — apenas deixam de ter um veículo
                vinculado.
              </p>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <ConfirmButton />
          </div>
        </form>
      </Modal>
    </>
  );
}
