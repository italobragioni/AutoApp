import Link from "next/link";
import { redirect } from "next/navigation";
import { Repeat2, ShieldCheck, TrendingUp } from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { getCurrentContext } from "@/lib/tenant";

const HIGHLIGHTS = [
  {
    icon: Repeat2,
    title: "Clientes que voltam sozinhos",
    text: "O AUTOVOLT avisa quem está passando do ciclo de retorno antes de você perder o cliente.",
  },
  {
    icon: TrendingUp,
    title: "Faturamento previsível",
    text: "Agenda, orçamentos e ordens de serviço no mesmo lugar — com o resultado sempre à vista.",
  },
  {
    icon: ShieldCheck,
    title: "Cada empresa, seus dados",
    text: "Múltiplos usuários e múltiplas unidades com separação total de informações.",
  },
];

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Quem ja esta logado nao precisa ver login/cadastro.
  if (await getCurrentContext()) redirect("/dashboard");

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col justify-center px-5 py-10 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="focus-ring inline-block rounded-lg">
            <Logo />
          </Link>
          <div className="mt-10">{children}</div>
        </div>
      </div>

      {/* Painel de valor — some no mobile para nao competir com o formulario */}
      <aside className="glow-top relative hidden overflow-hidden border-l border-line bg-ink-900 lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-volt-400">
            Plataforma de crescimento
          </p>
          <h2 className="mt-4 font-display text-3xl font-bold leading-tight text-white">
            Organize sua estética e faça seus clientes voltarem automaticamente.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Feito para estética automotiva, detalhamento e lava-rápidos premium que querem
            crescer sem depender da memória de ninguém.
          </p>

          <ul className="mt-10 space-y-6">
            {HIGHLIGHTS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-volt-400/12 text-volt-300">
                    <Icon size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{item.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </div>
  );
}
