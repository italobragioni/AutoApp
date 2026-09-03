"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";

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

export function LoginForm({ senhaRedefinida = false }: { senhaRedefinida?: boolean }) {
  const [state, formAction] = useActionState<FormState, FormData>(loginAction, undefined);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      {senhaRedefinida && !state?.error && (
        <p className="flex items-start gap-2 rounded-xl border border-volt-400/25 bg-volt-400/10 px-3.5 py-3 text-sm text-volt-100">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-volt-300" />
          Senha redefinida. Entre com a nova senha.
        </p>
      )}

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
        />
      </Field>

      <Field label="Senha">
        <Input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
        />
      </Field>

      <div className="flex justify-end">
        <Link
          href="/esqueci-senha"
          className="focus-ring rounded text-xs font-medium text-volt-400 hover:text-volt-300"
        >
          Esqueci minha senha
        </Link>
      </div>

      <Submit />
    </form>
  );
}
