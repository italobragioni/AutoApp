"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, MailWarning } from "lucide-react";

import { useActionForm } from "@/components/ui/action-form";
import { resendVerificationAction, type AccountState } from "@/app/actions/account";

/**
 * Aviso de e-mail nao verificado.
 *
 * Uma faixa fina no topo da area logada. Informa, oferece o reenvio e nao
 * bloqueia nada: o MVP continua utilizavel com o e-mail pendente.
 */

function ResendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="focus-ring shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-amber-200 underline underline-offset-2 transition-colors hover:text-white disabled:opacity-60"
    >
      {pending ? "Enviando..." : "Reenviar verificação"}
    </button>
  );
}

export function VerifyEmailNotice({ email }: { email: string }) {
  const { state, onSubmit } = useActionForm<AccountState>(resendVerificationAction, undefined);
  const [dismissed, setDismissed] = useState(false);

  // Some sozinho depois de confirmar o envio, para nao virar ruído permanente.
  useEffect(() => {
    if (!state?.ok) return;
    const timer = setTimeout(() => setDismissed(true), 12000);
    return () => clearTimeout(timer);
  }, [state]);

  if (dismissed) return null;

  return (
    <div
      className="border-b border-amber-400/20 bg-amber-400/10"
      data-email-notice
      role="status"
    >
      <div className="mx-auto flex w-full max-w-[92rem] flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 text-xs sm:px-6 lg:px-8">
        {state?.ok ? (
          <>
            <CheckCircle2 size={14} className="shrink-0 text-volt-300" />
            <span className="text-volt-100">{state.message}</span>
            {/* Fora de produção o link aparece aqui, já que não há e-mail saindo. */}
            {state.link && (
              <a
                href={state.link}
                data-verify-link
                className="focus-ring min-w-0 truncate rounded font-medium text-volt-300 underline underline-offset-2"
              >
                {state.link}
              </a>
            )}
          </>
        ) : (
          <>
            <MailWarning size={14} className="shrink-0 text-amber-300" />
            <span className="text-amber-100">
              Seu e-mail ainda não foi verificado{" "}
              <span className="text-amber-200/70">({email})</span>.
            </span>
            {state?.error ? (
              <span role="alert" className="text-amber-200">
                {state.error}
              </span>
            ) : (
              <form onSubmit={onSubmit} className="contents">
                <ResendButton />
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
