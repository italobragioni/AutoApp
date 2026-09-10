import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand/Logo";
import { LandingFooter } from "@/components/marketing/LandingFooter";
import { LEGAL_UPDATED_AT } from "@/lib/site";

/**
 * Moldura das páginas legais (Termos, Privacidade): topo com a marca, título,
 * data de atualização, conteúdo em coluna de leitura e o rodapé da landing.
 * Uso exclusivo das páginas públicas — não toca no app logado.
 */
export function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-ink-950/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="focus-ring rounded">
            <Logo size={30} />
          </Link>
          <Link
            href="/"
            className="focus-ring inline-flex items-center gap-1.5 rounded text-sm text-muted hover:text-white"
          >
            <ArrowLeft size={15} />
            Voltar ao site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
        <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-muted">Última atualização: {LEGAL_UPDATED_AT}</p>
        <div className="mt-10 space-y-8">{children}</div>
      </main>

      <LandingFooter />
    </div>
  );
}

/** Uma seção do documento legal (título + conteúdo). */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg font-semibold text-white sm:text-xl">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}
