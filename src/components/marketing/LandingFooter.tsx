import Link from "next/link";
import { MessageCircle } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { SITE, orPending, whatsappLink } from "@/lib/site";

/**
 * Rodapé da landing: marca, links legais (Termos e Privacidade), CNPJ e contato
 * de suporte (WhatsApp). Onde ainda não há dado real, mostra "[a preencher: …]"
 * — nunca um dado inventado. Preencha em src/lib/site.ts.
 */
export function LandingFooter() {
  const wa = whatsappLink();
  return (
    <footer className="border-t border-line bg-ink-950">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Logo size={30} />
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Organize sua estética automotiva e faça seus clientes voltarem — sem depender do
              caderno nem da memória.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 text-sm sm:gap-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-soft">Produto</p>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link href="/cadastro" className="focus-ring rounded text-muted hover:text-white">
                    Começar agora
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="focus-ring rounded text-muted hover:text-white">
                    Entrar
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-soft">Legal</p>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link href="/termos" className="focus-ring rounded text-muted hover:text-white">
                    Termos de Uso
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacidade"
                    className="focus-ring rounded text-muted hover:text-white"
                  >
                    Política de Privacidade
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-line pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            {orPending(SITE.legalName, "razão social")} · CNPJ {orPending(SITE.cnpj, "CNPJ")}
          </p>
          <p className="flex flex-wrap items-center gap-1.5">
            <MessageCircle size={13} className="text-volt-400" />
            Suporte:{" "}
            {wa ? (
              <a href={wa} className="focus-ring rounded text-volt-400 hover:text-volt-300">
                WhatsApp
              </a>
            ) : (
              <span>{orPending(SITE.supportWhatsapp, "WhatsApp de suporte")}</span>
            )}
            {SITE.supportEmail ? <span>· {SITE.supportEmail}</span> : null}
          </p>
        </div>
      </div>
    </footer>
  );
}
