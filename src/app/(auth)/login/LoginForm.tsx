"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";

import { Button, Field, Input } from "@/components/ui";
import { loginAction, type FormState } from "@/app/actions/auth";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Entrando..." : "Entrar"}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState<FormState, FormData>(loginAction, undefined);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      {state?.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-3 text-sm text-rose-200"
        >
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {state.error}
        </p>
      )}

      <Field label="E-mail">
        <Input
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="voce@suaempresa.com.br"
          defaultValue="demo@autovolt.com.br"
        />
      </Field>

      <Field label="Senha">
        <Input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          defaultValue="autovolt123"
        />
      </Field>

      <Submit />

      <p className="rounded-xl border border-line bg-ink-900 px-3.5 py-3 text-xs leading-relaxed text-muted">
        <span className="font-medium text-soft">Acesso de demonstração</span> já preenchido:
        <br />
        demo@autovolt.com.br · autovolt123
      </p>
    </form>
  );
}
