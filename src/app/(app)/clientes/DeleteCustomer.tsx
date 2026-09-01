"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, AlertTriangle, Trash2 } from "lucide-react";

import { Button, Input } from "@/components/ui";
import { Modal } from "@/components/ui/modal";
import { deleteCustomerAction, type CustomerState } from "@/app/actions/customers";

function ConfirmButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="danger"
      disabled={disabled || pending}
      className="w-full sm:w-auto"
    >
      {pending ? "Excluindo..." : "Excluir definitivamente"}
    </Button>
  );
}

/**
 * Exclusao de cliente com confirmacao.
 *
 * O schema usa `onDelete: Cascade` a partir de Customer, entao apagar um
 * cliente leva junto veiculos, agendamentos, orcamentos e ordens de servico
 * dele. Como isso apaga historico de faturamento, a confirmacao mostra o que
 * sera perdido e exige digitar o nome — nao basta um clique.
 */
export function DeleteCustomer({
  customer,
  counts,
}: {
  customer: { id: string; name: string };
  counts: { vehicles: number; appointments: number; quotes: number; workOrders: number };
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, formAction] = useActionState<CustomerState, FormData>(
    deleteCustomerAction,
    undefined,
  );

  const confirmed = typed.trim().toLowerCase() === customer.name.trim().toLowerCase();

  const related = [
    { label: "veículo", plural: "veículos", value: counts.vehicles },
    { label: "agendamento", plural: "agendamentos", value: counts.appointments },
    { label: "orçamento", plural: "orçamentos", value: counts.quotes },
    { label: "ordem de serviço", plural: "ordens de serviço", value: counts.workOrders },
  ].filter((item) => item.value > 0);

  function close() {
    setOpen(false);
    setTyped("");
  }

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
        onClose={close}
        title="Excluir cliente"
        description="Esta ação não pode ser desfeita."
      >
        <form action={formAction} className="space-y-4 p-5">
          <input type="hidden" name="id" value={customer.id} />

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
            Você está prestes a excluir <strong className="text-white">{customer.name}</strong>.
          </p>

          {related.length > 0 && (
            <div className="rounded-xl border border-rose-400/25 bg-rose-400/10 p-3.5">
              <p className="flex items-center gap-2 text-xs font-semibold text-rose-200">
                <AlertTriangle size={14} className="shrink-0" />
                Estes registros também serão apagados
              </p>
              <ul className="mt-2 space-y-1 text-xs text-rose-100/90">
                {related.map((item) => (
                  <li key={item.label}>
                    {item.value} {item.value === 1 ? item.label : item.plural}
                  </li>
                ))}
              </ul>
              <p className="mt-2.5 text-[0.7rem] leading-relaxed text-rose-100/70">
                O histórico de faturamento deste cliente sai dos relatórios e do cálculo de
                retenção.
              </p>
            </div>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-soft">
              Para confirmar, digite <strong className="text-white">{customer.name}</strong>
            </span>
            {/* Usa o Input compartilhado para herdar o tamanho de fonte que
                evita o zoom automatico do iOS. */}
            <Input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              className="focus-visible:border-rose-400/50"
              placeholder={customer.name}
            />
          </label>

          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={close}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <ConfirmButton disabled={!confirmed} />
          </div>
        </form>
      </Modal>
    </>
  );
}
