"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";

import { Button, Field, Input } from "@/components/ui";
import { registerAction, type FormState } from "@/app/actions/auth";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Criando conta..." : "Criar conta"}
    </Button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState<FormState, FormData>(registerAction, undefined);

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

      <Field label="Seu nome">
        <Input name="name" autoComplete="name" required placeholder="Como podemos te chamar" />
      </Field>

      <Field label="Nome da empresa">
        <Input
          name="companyName"
          autoComplete="organization"
          required
          placeholder="Ex.: Garage 77 Estética Automotiva"
        />
      </Field>

      <Field label="E-mail">
        <Input type="email" name="email" autoComplete="email" required placeholder="voce@suaempresa.com.br" />
      </Field>

      <Field label="Senha" hint="Mínimo de 8 caracteres.">
        <Input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="••••••••"
        />
      </Field>

      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line bg-ink-900 px-3.5 py-3">
        <input
          type="checkbox"
          name="demo"
          defaultChecked
          className="mt-0.5 size-4 shrink-0 accent-volt-400"
        />
        <span className="text-xs leading-relaxed text-muted">
          <span className="font-medium text-soft">Popular com dados de demonstração.</span> Cria
          clientes, veículos, agenda e histórico fictícios para você conhecer a plataforma. Pode
          apagar depois em Configurações.
        </span>
      </label>

      <Submit />
    </form>
  );
}
