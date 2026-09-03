import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, KeyRound } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { checkToken } from "@/lib/auth-tokens";

import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = { title: "Redefinir senha" };

/**
 * Redefinicao de senha.
 *
 * Fica fora do grupo (auth) de proposito: aquele layout manda quem esta logado
 * para o painel, e alguem com sessao aberta tambem precisa conseguir usar o
 * link que recebeu.
 *
 * A checagem daqui e so para a tela saber o que mostrar. Quem decide de
 * verdade e a Server Action, que revalida o token do zero e so entao o consome.
 */
export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const check = await checkToken(token, "recuperacao");

  const motivo = check.ok
    ? null
    : check.reason === "expirado"
      ? "Este link expirou."
      : check.reason === "usado"
        ? "Este link já foi utilizado."
        : "Este link não é válido.";

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
                <KeyRound size={20} />
              </span>
              <h1 className="mt-4 font-display text-lg font-bold text-white">
                Criar uma nova senha
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                Depois de salvar, as sessões abertas com a senha antiga deixam de valer.
              </p>
            </div>
            <ResetPasswordForm token={token} />
          </>
        ) : (
          <div className="space-y-3 p-6 text-center">
            <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-rose-400/10 text-rose-300">
              <AlertTriangle size={20} />
            </span>
            <h1 className="font-display text-lg font-bold text-white">{motivo}</h1>
            <p className="text-sm leading-relaxed text-muted">
              Links de recuperação valem por 60 minutos e servem uma única vez. Peça um novo para
              continuar.
            </p>
            <Link
              href="/esqueci-senha"
              className="focus-ring inline-block rounded text-sm font-medium text-volt-400 hover:text-volt-300"
            >
              Pedir um novo link
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
