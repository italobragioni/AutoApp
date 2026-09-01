import Link from "next/link";

import { LogoMark } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="glow-top flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <LogoMark size={52} />
      <p className="mt-8 font-display text-6xl font-bold text-white">404</p>
      <h1 className="mt-3 font-display text-xl font-bold text-white">Página não encontrada</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        O endereço que você tentou abrir não existe ou foi movido.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <ButtonLink href="/dashboard">Ir para o Dashboard</ButtonLink>
        <Link
          href="/"
          className="focus-ring rounded text-sm font-medium text-muted transition-colors hover:text-white"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
