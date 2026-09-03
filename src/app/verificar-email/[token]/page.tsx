import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, MailCheck } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { checkToken } from "@/lib/auth-tokens";

import { VerifyEmailForm } from "./VerifyEmailForm";

export const metadata: Metadata = { title: "Verificar e-mail" };

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const check = await checkToken(token, "verificacao");

  const motivo = check.ok
    ? null
    : check.reason === "expirado"
      ? "Este link de verificação expirou."
      : check.reason === "usado"
        ? "Este link já foi utilizado."
        : "Este link de verificação não é válido.";

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8 flex justify-center">
        <Link href="/" className="focus-ring rounded-lg">
          <Logo size={38} />
        </Link>
      </div>

      <div className="rounded-2xl border border-line bg-ink-900 shadow-lift">
        {check.ok ? (
          <>
            <div className="border-b border-line p-6">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-volt-400/10 text-volt-300">
                <MailCheck size={20} />
              </span>
              <h1 className="mt-4 font-display text-lg font-bold text-white">
                Confirmar seu e-mail
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                Falta um clique. A confirmação é feita por você, e não ao abrir o link — serviços
                de e-mail costumam visitar links sozinhos, e isso queimaria a verificação antes de
                você chegar aqui.
              </p>
            </div>
            <VerifyEmailForm token={token} />
          </>
        ) : (
          <div className="space-y-3 p-6 text-center">
            <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-rose-400/10 text-rose-300">
              <AlertTriangle size={20} />
            </span>
            <h1 className="font-display text-lg font-bold text-white">{motivo}</h1>
            <p className="text-sm leading-relaxed text-muted">
              Entre na plataforma e use &quot;Reenviar verificação&quot; no aviso do topo para
              receber um link novo.
            </p>
            <Link
              href="/dashboard"
              className="focus-ring inline-block rounded text-sm font-medium text-volt-400 hover:text-volt-300"
            >
              Ir para a plataforma
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
