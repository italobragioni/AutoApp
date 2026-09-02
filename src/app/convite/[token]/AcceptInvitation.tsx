"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle } from "lucide-react";

import { Button, Field, Input } from "@/components/ui";
import { useActionForm } from "@/components/ui/action-form";
import { acceptInvitationAction, type TeamState } from "@/app/actions/team";
import { cn } from "@/lib/format";

/**
 * Aceite do convite, nos tres caminhos possiveis.
 *
 * O formulario so informa QUAL caminho; a validacao inteira (convite valido,
 * nao expirado, ainda pendente, e-mail correspondente, senha conferida)
 * acontece na Server Action.
 */

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Validando..." : label}
    </Button>
  );
}

export function AcceptInvitation({
  token,
  email,
  companyName,
  signedInAs,
}: {
  token: string;
  email: string;
  companyName: string;
  signedInAs: { email: string } | null;
}) {
  const sameAccount = signedInAs?.email === email;
  const [mode, setMode] = useState<"entrar" | "criar">("criar");
  const [values, setValues] = useState({ name: "", password: "" });

  const { state, onSubmit } = useActionForm<TeamState>(acceptInvitationAction, undefined);

  const error = state?.error;

  // Ja logado com a conta certa: um botao resolve.
  if (sameAccount) {
    return (
      <form onSubmit={onSubmit} className="space-y-4 p-6" id="accept-form">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="mode" value="sessao" />
        <input type="hidden" name="name" value="" />
        <input type="hidden" name="password" value="" />

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-2.5 text-xs text-rose-200"
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        <p className="text-sm text-soft">
          Você está conectado como <strong className="text-white">{email}</strong>.
        </p>
        <Submit label={`Entrar em ${companyName}`} />
      </form>
    );
  }

  return (
    <div className="p-6">
      {signedInAs && (
        <p className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-2.5 text-xs leading-relaxed text-amber-100">
          Você está conectado como <strong>{signedInAs.email}</strong>, mas o convite é para{" "}
          <strong>{email}</strong>. Continue abaixo com a conta convidada.
        </p>
      )}

      <div className="mb-4 flex gap-1 rounded-xl border border-line bg-ink-850 p-1">
        {(
          [
            { key: "criar", label: "Criar conta" },
            { key: "entrar", label: "Já tenho conta" },
          ] as const
        ).map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setMode(option.key)}
            className={cn(
              "focus-ring flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              mode === option.key
                ? "bg-volt-400 text-ink-950"
                : "text-soft hover:text-white",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-4" id="accept-form">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="mode" value={mode} />

        {error && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-2.5 text-xs text-rose-200"
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        <Field label="E-mail" hint="Definido pelo convite.">
          <Input value={email} readOnly disabled />
        </Field>

        {/* O nome só existe no cadastro, mas o campo acompanha o formulário nos
            dois modos para o React não trocar a árvore ao alternar. */}
        <div className={mode === "criar" ? "" : "hidden"}>
          <Field label="Seu nome">
            <Input
              name="name"
              value={values.name}
              onChange={(event) => setValues((v) => ({ ...v, name: event.target.value }))}
              placeholder="Como você quer ser chamado"
            />
          </Field>
        </div>

        <Field
          label="Senha"
          hint={mode === "criar" ? "Ao menos 8 caracteres." : "A senha da sua conta."}
        >
          <Input
            type="password"
            name="password"
            required
            value={values.password}
            onChange={(event) => setValues((v) => ({ ...v, password: event.target.value }))}
          />
        </Field>

        <Submit label={mode === "criar" ? "Criar conta e entrar" : "Entrar e aceitar"} />
      </form>
    </div>
  );
}
