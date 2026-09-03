"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Link2, Mail } from "lucide-react";

import { Button, Field, Input } from "@/components/ui";
import { useActionForm } from "@/components/ui/action-form";
import { requestPasswordResetAction, type AccountState } from "@/app/actions/account";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Enviando..." : "Enviar link de recuperação"}
    </Button>
  );
}

/**
 * Pedido de recuperacao.
 *
 * A resposta e sempre a mesma, exista ou nao a conta — e por isso que nao ha
 * tratamento de erro "e-mail nao encontrado" aqui: ele nunca chega.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const { state, onSubmit } = useActionForm<AccountState>(
    requestPasswordResetAction,
    undefined,
  );

  if (state?.ok) {
    return (
      <div className="mt-8 space-y-4" data-recovery-sent>
        <p className="flex items-start gap-2 rounded-xl border border-volt-400/25 bg-volt-400/10 px-3.5 py-3 text-sm leading-relaxed text-volt-100">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-volt-300" />
          {state.message}
        </p>

        {/* Só aparece fora de produção, enquanto não há provedor de e-mail. */}
        {state.link && (
          <div className="space-y-2 rounded-xl border border-line bg-ink-900 p-3.5">
            <p className="flex items-center gap-2 text-xs font-semibold text-soft">
              <Link2 size={14} />
              Ambiente de desenvolvimento — link gerado:
            </p>
            <input
              readOnly
              value={state.link}
              data-recovery-link
              onFocus={(event) => event.currentTarget.select()}
              className="focus-ring w-full rounded-lg border border-ink-600 bg-ink-950 px-2.5 py-1.5 text-xs text-soft"
            />
            <p className="text-[0.68rem] leading-relaxed text-muted">
              Em produção este bloco não existe: o link só vai por e-mail.
            </p>
          </div>
        )}

        <p className="text-xs leading-relaxed text-muted">
          Não recebeu? Confira a caixa de spam. O link vale por 60 minutos e só pode ser usado uma
          vez.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4" id="forgot-form">
      <Field label="E-mail da conta">
        <Input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="voce@suaempresa.com.br"
        />
      </Field>

      <Submit />

      <p className="flex items-start gap-2 rounded-xl border border-line bg-ink-900 px-3.5 py-3 text-xs leading-relaxed text-muted">
        <Mail size={14} className="mt-0.5 shrink-0" />
        Por segurança, a resposta é a mesma existindo ou não uma conta com esse e-mail.
      </p>
    </form>
  );
}
