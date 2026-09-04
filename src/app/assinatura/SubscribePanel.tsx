"use client";

import { useEffect } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui";
import { startCheckoutAction, type BillingState } from "@/app/actions/billing";

function SubmitCheckout({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Abrindo checkout..." : label}
      {!pending && <ArrowRight size={16} />}
    </Button>
  );
}

/**
 * Botao que leva ao checkout da Cakto. O redirecionamento e feito pelo servidor
 * (a action monta a URL com a referencia segura). Aqui so tratamos erro.
 */
export function SubscribeButton({ planId, label }: { planId: string; label: string }) {
  const [state, formAction] = useActionState<BillingState, FormData>(startCheckoutAction, undefined);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="plan" value={planId} />
      {state?.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-3 text-sm text-rose-200"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {state.error}
        </p>
      )}
      <SubmitCheckout label={label} />
    </form>
  );
}

/**
 * Estado de "voltando do checkout": o usuario pode chegar antes do webhook. Em
 * vez de prometer que deu certo (a verdade vem do backend), avisamos que estamos
 * confirmando e atualizamos a pagina sozinhos ate o status mudar.
 */
export function ConfirmingPayment() {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(id);
  }, [router]);

  return (
    <div className="flex items-start gap-3 rounded-xl border border-volt-400/25 bg-volt-400/10 px-4 py-3.5 text-sm text-volt-100">
      <Loader2 size={18} className="mt-0.5 shrink-0 animate-spin text-volt-300" />
      <div>
        <p className="font-medium text-white">Estamos confirmando seu pagamento.</p>
        <p className="mt-1 text-volt-100/80">
          Assim que a operadora confirmar, seu acesso é liberado automaticamente. Esta página se
          atualiza sozinha — pode deixá-la aberta.
        </p>
      </div>
    </div>
  );
}
