import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Building2, ShieldCheck } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { Badge } from "@/components/ui";
import { readInvitation } from "@/app/actions/team";
import { dateFull } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/labels";
import { ROLE_SUMMARY, type Role } from "@/lib/permissions";
import { getCurrentContext } from "@/lib/tenant";

import { AcceptInvitation } from "./AcceptInvitation";

export const metadata: Metadata = { title: "Convite" };

/**
 * Pagina publica do convite.
 *
 * Ela apenas DESCREVE o convite; quem decide se ele vale e a Server Action
 * `acceptInvitationAction`, que revalida tudo do zero. O token aqui identifica
 * o convite, nao autoriza nada por si só.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await readInvitation(token);
  const context = await getCurrentContext();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8 flex justify-center">
        <Link href="/" className="focus-ring rounded-lg">
          <Logo size={38} />
        </Link>
      </div>

      <div className="rounded-2xl border border-line bg-ink-900 shadow-lift">
        {!invitation ? (
          <div className="space-y-3 p-6 text-center">
            <span className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-rose-400/10 text-rose-300">
              <AlertTriangle size={20} />
            </span>
            <h1 className="font-display text-lg font-bold text-white">Convite inválido</h1>
            <p className="text-sm leading-relaxed text-muted">
              Este link não corresponde a nenhum convite. Peça um novo para quem administra a
              empresa.
            </p>
            <Link
              href="/login"
              className="focus-ring inline-block rounded text-sm font-medium text-volt-400 hover:text-volt-300"
            >
              Ir para o login
            </Link>
          </div>
        ) : (
          <>
            <div className="border-b border-line p-6">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-volt-400/10 text-volt-300">
                <Building2 size={20} />
              </span>
              <h1 className="mt-4 font-display text-lg font-bold text-white">
                Convite para {invitation.companyName}
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {invitation.invitedByName
                  ? `${invitation.invitedByName} convidou `
                  : "Você foi convidado como "}
                <strong className="text-soft">{invitation.email}</strong>
                {invitation.invitedByName ? " para usar o AUTOVOLT nesta empresa." : "."}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Badge tone="volt" dot>
                  {ROLE_LABEL[invitation.role] ?? invitation.role}
                </Badge>
                {invitation.usable ? (
                  <span className="text-xs text-muted">
                    válido até {dateFull(invitation.expiresAt)}
                  </span>
                ) : (
                  <Badge tone="muted">
                    {invitation.status === "aceito"
                      ? "Já utilizado"
                      : invitation.expired
                        ? "Expirado"
                        : "Cancelado"}
                  </Badge>
                )}
              </div>

              <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted">
                <ShieldCheck size={13} className="mt-0.5 shrink-0 text-volt-400" />
                {ROLE_SUMMARY[invitation.role as Role] ?? "Acesso definido pelo administrador."}
              </p>
            </div>

            {invitation.usable ? (
              <AcceptInvitation
                token={token}
                email={invitation.email}
                companyName={invitation.companyName}
                signedInAs={context ? { email: context.user.email } : null}
              />
            ) : (
              <div className="space-y-3 p-6 text-sm leading-relaxed text-muted">
                <p>
                  {invitation.status === "aceito"
                    ? "Este convite já foi aceito. Se a conta é sua, basta entrar normalmente."
                    : invitation.expired
                      ? "Este convite expirou. Peça um novo para quem administra a empresa."
                      : "Este convite foi cancelado."}
                </p>
                <Link
                  href="/login"
                  className="focus-ring inline-block rounded font-medium text-volt-400 hover:text-volt-300"
                >
                  Ir para o login
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
