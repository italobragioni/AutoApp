"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Power, PowerOff } from "lucide-react";

import { toggleServiceActiveAction, type ServiceState } from "@/app/actions/services";
import { cn } from "@/lib/format";

function ToggleButton({ active }: { active: boolean }) {
  const { pending } = useFormStatus();
  const Icon = active ? PowerOff : Power;

  return (
    <button
      type="submit"
      disabled={pending}
      title={active ? "Desativar serviço" : "Ativar serviço"}
      className={cn(
        "focus-ring inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[0.7rem] font-medium transition-colors disabled:opacity-60",
        active
          ? "text-muted hover:bg-ink-800 hover:text-rose-300"
          : "text-volt-300 hover:bg-volt-400/10",
      )}
    >
      <Icon size={13} />
      {pending ? "..." : active ? "Desativar" : "Ativar"}
    </button>
  );
}

/**
 * Liga/desliga um servico do catalogo. Nao apaga nada — apenas troca o status,
 * entao o historico de atendimentos ja realizados permanece igual.
 */
export function ToggleServiceActive({
  service,
}: {
  service: { id: string; active: boolean };
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<ServiceState, FormData>(
    toggleServiceActiveAction,
    undefined,
  );

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={formAction} className="contents">
      <input type="hidden" name="id" value={service.id} />
      <ToggleButton active={service.active} />
      {state?.error && (
        <span role="alert" className="text-[0.68rem] text-rose-300">
          {state.error}
        </span>
      )}
    </form>
  );
}
