import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Car,
  CheckCircle2,
  FileText,
  Megaphone,
  Repeat2,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";

import { Logo, LogoMark } from "@/components/brand/Logo";
import { Badge, ButtonLink } from "@/components/ui";

const PILLARS = [
  {
    icon: Users,
    title: "Organize seus clientes",
    text: "Cadastro completo, histórico de atendimentos, veículos e preferências de cada cliente em um lugar só.",
  },
  {
    icon: CalendarDays,
    title: "Controle sua agenda",
    text: "Veja o dia inteiro em uma tela: quem chega, qual serviço, quanto tempo leva e quanto vale.",
  },
  {
    icon: Repeat2,
    title: "Faça o cliente voltar",
    text: "O AUTOVOLT calcula o ciclo de retorno de cada cliente e avisa quem está prestes a sumir.",
  },
];

const FEATURES = [
  { icon: Car, title: "Veículos", text: "Marca, modelo, placa e porte — o serviço certo para cada carro." },
  { icon: Sparkles, title: "Catálogo de serviços", text: "Preço, duração e ciclo de recorrência de cada serviço." },
  { icon: FileText, title: "Orçamentos", text: "Monte, envie e acompanhe a aprovação sem perder o follow-up." },
  { icon: Wrench, title: "Ordens de serviço", text: "Da entrada do carro à entrega, com valor fechado e forma de pagamento." },
  { icon: Megaphone, title: "Campanhas", text: "Mensagens de reativação para os públicos que o sistema separa sozinho." },
  { icon: BarChart3, title: "Relatórios", text: "Faturamento, ticket médio, serviços que mais vendem e origem dos clientes." },
];

const STEPS = [
  {
    step: "01",
    title: "Registre o atendimento",
    text: "Cada serviço concluído alimenta o histórico do cliente automaticamente.",
  },
  {
    step: "02",
    title: "O sistema calcula o retorno",
    text: "Com base no ciclo de cada serviço, o AUTOVOLT sabe quando o carro deveria voltar.",
  },
  {
    step: "03",
    title: "Você recupera o faturamento",
    text: "Listas prontas de quem está em risco, com mensagem sugerida e link direto de WhatsApp.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh">
      {/* Topo */}
      <header className="sticky top-0 z-30 border-b border-line bg-ink-950/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Logo size={32} />
          <nav className="flex items-center gap-2">
            <ButtonLink href="/login" variant="ghost" size="sm">
              Entrar
            </ButtonLink>
            <ButtonLink href="/cadastro" size="sm">
              Criar conta
            </ButtonLink>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="glow-top relative overflow-hidden border-b border-line">
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-6xl px-5 py-20 text-center sm:px-8 sm:py-28">
          <Badge tone="volt" dot className="mb-6">
            Plataforma de crescimento para estética automotiva
          </Badge>

          <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold leading-[1.1] text-white sm:text-5xl lg:text-6xl">
            Organize sua estética e faça seus clientes{" "}
            <span className="text-volt-400">voltarem automaticamente</span>.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            Clientes, veículos, agenda, orçamentos e ordens de serviço em um sistema só — com um
            motor de retenção que mostra exatamente quem precisa de contato hoje.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <ButtonLink href="/cadastro" size="lg">
              Começar agora
              <ArrowRight size={16} />
            </ButtonLink>
            <ButtonLink href="/login" variant="secondary" size="lg">
              Ver demonstração
            </ButtonLink>
          </div>

          <p className="mt-5 text-xs text-muted">
            Acesso de demonstração já preenchido na tela de login.
          </p>
        </div>
      </section>

      {/* Pilares */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="grid gap-5 sm:grid-cols-3">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <article key={pillar.title} className="surface p-6">
                <span className="flex size-11 items-center justify-center rounded-xl bg-volt-400/12 text-volt-300">
                  <Icon size={20} />
                </span>
                <h3 className="mt-5 text-base font-semibold text-white">{pillar.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{pillar.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* Como funciona a retencao */}
      <section className="border-y border-line bg-ink-900/50">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-volt-400">
              O diferencial
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold text-white sm:text-4xl">
              Não é só registrar. É saber quem está prestes a sumir.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
              A maior perda de faturamento de uma estética automotiva não está no cliente novo — está
              no cliente antigo que parou de voltar sem ninguém perceber.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {STEPS.map((item) => (
              <article key={item.step} className="surface p-6">
                <span className="font-display text-sm font-bold tracking-widest text-volt-400">
                  {item.step}
                </span>
                <h3 className="mt-3 text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
          Tudo que a operação precisa
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-muted sm:text-base">
          Sem a complexidade de um ERP genérico. Feito para o dia a dia de quem cuida de carros.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="surface flex gap-4 p-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink-800 text-volt-300">
                  <Icon size={18} />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-white">{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{feature.text}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Preparado para escalar */}
      <section className="border-t border-line bg-ink-900/50">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
                Pronto para crescer com você
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
                Do dono que trabalha sozinho à rede com várias unidades — a estrutura é a mesma.
              </p>
              <ul className="mt-8 space-y-3.5">
                {[
                  "Múltiplos usuários com papéis diferentes",
                  "Múltiplas empresas na mesma conta",
                  "Separação total de dados entre empresas",
                  "Banco de dados relacional pronto para produção",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-soft">
                    <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-volt-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="surface relative overflow-hidden p-8 text-center">
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage:
                    "radial-gradient(20rem 12rem at 50% 0%, rgba(18,226,155,.14), transparent 70%)",
                }}
              />
              <div className="relative">
                <LogoMark size={56} className="mx-auto" />
                <p className="mt-6 font-display text-xl font-bold text-white">
                  Comece em poucos minutos
                </p>
                <p className="mt-2 text-sm text-muted">
                  Crie sua conta e explore com dados de demonstração já prontos.
                </p>
                <ButtonLink href="/cadastro" size="lg" className="mt-7 w-full">
                  Criar conta grátis
                  <ArrowRight size={16} />
                </ButtonLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 sm:px-8">
          <Logo size={28} compact />
          <p className="text-xs text-muted">
            AUTOVOLT · Plataforma de gestão e crescimento para estética automotiva
          </p>
          <Link
            href="/login"
            className="focus-ring rounded text-xs font-medium text-volt-400 hover:text-volt-300"
          >
            Entrar na plataforma
          </Link>
        </div>
      </footer>
    </div>
  );
}
