"use client";

import { useEffect } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui";
import { startCheckoutAction, type BillingState } from "@/app/actions/billing";
import { trackInitiateCheckout } from "@/lib/meta-pixel";

function SubmitCheckout({ label, onClick }: { label: string; onClick?: () => void }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending} onClick={onClick}>
      {pending ? "Abrindo checkout..." : label}
      {!pending && <ArrowRight size={16} />}
    </Button>
  );
}

/**
 * Botao que leva ao checkout da Cakto. O redirecionamento e feito pelo servidor
 * (a action monta a URL com a referencia segura). Aqui so tratamos erro.
 */
export function SubscribeButton({
  planId,
  label,
  canCheckout,
  value,
}: {
  planId: string;
  label: string;
  /** O checkout está configurado (URL da Cakto definida)? */
  canCheckout: boolean;
  /** Valor do plano para o evento InitiateCheckout (BRL). */
  value: number;
}) {
  const [state, formAction] = useActionState<BillingState, FormData>(startCheckoutAction, undefined);

  // InitiateCheckout só quando o checkout REALMENTE vai iniciar: o botão só
  // aparece sem acesso ativo, e aqui exigimos que a URL da Cakto exista. O
  // disparo acontece no clique do botão, imediatamente antes de o form acionar
  // o redirecionamento server-side para a Cakto — não ao abrir a página nem se
  // houver erro de configuração.
  function onInitiate() {
    if (canCheckout) trackInitiateCheckout(value);
  }

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
      <SubmitCheckout label={label} onClick={onInitiate} />
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
