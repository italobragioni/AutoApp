"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";

import { Button, Field, Input } from "@/components/ui";
import { useActionForm } from "@/components/ui/action-form";
import { resetPasswordAction, type AccountState } from "@/app/actions/account";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Salvando..." : "Salvar nova senha"}
    </Button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [values, setValues] = useState({ password: "", confirm: "" });
  const { state, onSubmit } = useActionForm<AccountState>(resetPasswordAction, undefined);

  const set = (field: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));

  return (
    <form onSubmit={onSubmit} className="space-y-4 p-6" id="reset-form">
      {/* O token vai junto, mas quem manda e o servidor: ele revalida tudo. */}
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

      <Field label="Nova senha" hint="Ao menos 8 caracteres.">
        <Input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={values.password}
          onChange={set("password")}
          placeholder="••••••••"
        />
      </Field>

      <Field label="Confirmar nova senha">
        <Input
          type="password"
          name="confirm"
          autoComplete="new-password"
          required
          value={values.confirm}
          onChange={set("confirm")}
          placeholder="••••••••"
        />
      </Field>

      <Submit />
    </form>
  );
}
