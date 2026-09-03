"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui";
import { useActionForm } from "@/components/ui/action-form";
import { verifyEmailAction, type AccountState } from "@/app/actions/account";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Confirmando..." : "Confirmar meu e-mail"}
    </Button>
  );
}

export function VerifyEmailForm({ token }: { token: string }) {
  const { state, onSubmit } = useActionForm<AccountState>(verifyEmailAction, undefined);

  if (state?.ok) {
    return (
      <div className="space-y-4 p-6 text-center" data-email-verified>
        <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-volt-400/10 text-volt-300">
          <CheckCircle2 size={20} />
        </span>
        <p className="text-sm text-soft">{state.message}</p>
        <Link
          href="/dashboard"
          className="focus-ring inline-block rounded text-sm font-medium text-volt-400 hover:text-volt-300"
        >
          Ir para a plataforma
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 p-6" id="verify-form">
      <input type="hidden" name="token" value={token} />

      {state?.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-3 text-sm text-rose-200"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {state.error}
        </p>
      )}

      <Submit />
    </form>
  );
}
