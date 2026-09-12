import Link from "next/link";
import { NICHES } from "@/lib/niches";
import { Button } from "@/components/ui/button";

export default function MarketingPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-20">
      <p className="text-sm font-semibold text-brand">ORCAIA</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight text-ink">
        Orcamentos profissionais em minutos.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-soft">
        Plataforma de geracao de orcamentos para prestadores de servico. Cadastre
        materiais, mao de obra e margem uma vez — e monte propostas consistentes
        para cada cliente.
      </p>

      <div className="mt-8 flex gap-3">
        <Link href="/cadastro">
          <Button>Criar conta</Button>
        </Link>
        <Link href="/login">
          <Button variant="secondary">Entrar</Button>
        </Link>
      </div>

      <div className="mt-16 grid gap-4 sm:grid-cols-3">
        {NICHES.map((n) => (
          <div
            key={n.id}
            className="rounded-xl border border-surface-border bg-white p-5"
          >
            <h2 className="text-sm font-semibold text-ink">{n.label}</h2>
            <p className="mt-1 text-sm text-ink-faint">{n.description}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
