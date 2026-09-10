import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  FileText,
  Megaphone,
  MessageCircle,
  NotebookPen,
  Repeat2,
  Sparkles,
  Users,
  Wrench,
  X,
} from "lucide-react";

import { LeadOnCtaClick } from "@/components/analytics/LeadOnCtaClick";
import { Logo } from "@/components/brand/Logo";
import { CtaButton } from "@/components/marketing/CtaButton";
import { Faq } from "@/components/marketing/Faq";
import { LandingFooter } from "@/components/marketing/LandingFooter";
import { SocialProof } from "@/components/marketing/SocialProof";
import { WistiaVideo } from "@/components/marketing/WistiaVideo";
import { Badge, ButtonLink } from "@/components/ui";

// Dor: o que o dono vive hoje sem o AUTOVOLT.
const PAINS = [
  "Você não sabe quem sumiu da sua base — só percebe quando o movimento cai.",
  "O controle vive no caderno, na cabeça e num WhatsApp lotado de conversa.",
  "O carro que voltaria a cada 3 meses parou de voltar e ninguém reparou.",
  "Você gasta com anúncio pra atrair estranho enquanto o cliente antigo esfria.",
];

// Solução em 3 passos.
const STEPS = [
  {
    step: "1",
    title: "Registre o atendimento",
    text: "Cada serviço concluído entra no histórico do cliente e do carro — sem planilha, em segundos.",
  },
  {
    step: "2",
    title: "O sistema calcula o retorno",
    text: "Pelo ciclo de cada serviço, o AUTOVOLT sabe quando aquele carro deveria voltar.",
  },
  {
    step: "3",
    title: "Você recebe a lista de quem está sumindo",
    text: "Com a mensagem pronta e o link direto do WhatsApp. É só mandar e trazer o cliente de volta.",
  },
];

// Funcionalidades escritas como benefício (sem jargão técnico).
const FEATURES = [
  { icon: Users, title: "Clientes e veículos", text: "Cada cliente com seu carro, histórico e preferências num lugar só." },
  { icon: CalendarDays, title: "Agenda do dia", text: "Veja numa tela quem chega, qual serviço e quanto vale — sem confusão de horário." },
  { icon: Sparkles, title: "Catálogo de serviços", text: "Seus preços e o tempo de retorno de cada serviço, prontos pra usar." },
  { icon: FileText, title: "Orçamentos", text: "Monte, envie e acompanhe a aprovação sem perder o follow-up." },
  { icon: Wrench, title: "Ordens de serviço", text: "Da entrada do carro à entrega, com valor fechado e forma de pagamento." },
  { icon: Repeat2, title: "Retenção automática", text: "O sistema aponta quem está prestes a sumir antes de você perder o cliente." },
  { icon: Megaphone, title: "Campanhas de reativação", text: "Chame de volta grupos inteiros de clientes parados, de uma vez." },
  { icon: BarChart3, title: "Relatórios", text: "Faturamento, ticket médio, o que mais vende e de onde vêm seus clientes." },
];

const PRICE_POINTS = [
  "Plano único, sem pegadinha de “plano avançado”.",
  "Sem fidelidade e sem multa — cancele quando quiser.",
  "A assinatura começa quando você cria a conta. Não existe teste grátis.",
  "Funciona no celular e no computador, sem instalar nada.",
];

export default function LandingPage() {
  // Vídeo demo (Wistia, vertical). Trocável por env sem mexer no código.
  const vslMediaId = process.env.NEXT_PUBLIC_WISTIA_MEDIA_ID?.trim() || "yivd2pr2ga";

  return (
    <div className="min-h-dvh">
      {/* Meta Pixel: dispara Lead ao clicar em qualquer CTA que leva ao cadastro. */}
      <LeadOnCtaClick />

      {/* Topo — sem menu que leve pra fora; só marca + CTA. */}
      <header className="sticky top-0 z-30 border-b border-line bg-ink-950/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Logo size={30} />
          <div className="flex items-center gap-2">
            <ButtonLink href="/login" variant="ghost" size="sm">
              Entrar
            </ButtonLink>
            <CtaButton size="sm" className="hidden sm:inline-flex" />
          </div>
        </div>
      </header>

      {/* 1. HERO */}
      <section className="glow-top relative overflow-hidden border-b border-line">
        <div className="grid-lines pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative mx-auto max-w-3xl px-5 py-14 text-center sm:px-8 sm:py-20">
          <Badge tone="volt" dot className="mb-6">
            Sistema para estética automotiva
          </Badge>

          <h1 className="mx-auto max-w-3xl font-display text-3xl font-bold leading-[1.1] text-white sm:text-5xl">
            O cliente lavou o carro uma vez e{" "}
            <span className="text-volt-400">nunca mais voltou</span>. Quantos como ele você já
            perdeu?
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            O AUTOVOLT mostra exatamente quem sumiu da sua base e te entrega a lista de quem chamar
            hoje — com a mensagem pronta e o link do WhatsApp. Recuperar quem já te conhece custa
            muito menos do que achar cliente novo.
          </p>

          <div className="mt-9 flex flex-col items-center gap-3">
            <CtaButton />
            <p className="text-sm text-muted">
              Plano único de <strong className="text-soft">R$47/mês</strong> · sem fidelidade ·
              cancele quando quiser
            </p>
          </div>
        </div>
      </section>

      {/* 2. VÍDEO DEMO */}
      <section className="border-b border-line bg-ink-900/40">
        <div className="mx-auto max-w-6xl px-5 py-10 text-center sm:px-8 sm:py-14">
          <div className="relative mx-auto w-full max-w-[300px] overflow-hidden rounded-2xl border border-line bg-ink-900/60 shadow-[0_20px_60px_-20px_rgba(0,0,0,.7)] ring-1 ring-line sm:max-w-[340px]">
            <WistiaVideo mediaId={vslMediaId} aspect="0.5625" paddingTop="177.78%" />
          </div>
          <p className="mt-4 text-sm font-medium text-soft">Veja o sistema funcionando em 2 minutos</p>
        </div>
      </section>

      {/* 3. DOR */}
      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-2xl">
          <h2 className="font-display text-2xl font-bold text-white sm:text-4xl">
            Você não tem um problema de clientes novos. Tem um problema de clientes que somem.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
            A maior perda de faturamento de uma estética automotiva quase nunca é o cliente que
            faltou hoje — é o cliente antigo que parou de voltar sem ninguém perceber. Enquanto isso,
            o dia a dia é assim:
          </p>
          <ul className="mt-8 space-y-3.5">
            {PAINS.map((pain) => (
              <li key={pain} className="flex items-start gap-3 text-sm text-soft sm:text-base">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-rose-400/12 text-rose-300">
                  <X size={13} />
                </span>
                {pain}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-line bg-ink-900/60 p-5">
            <NotebookPen size={20} className="mt-0.5 shrink-0 text-volt-400" />
            <p className="text-sm leading-relaxed text-soft">
              O problema quase nunca é falta de cliente novo. É que as oportunidades de venda estão
              escondidas na sua própria base — e ninguém está olhando pra elas.
            </p>
          </div>
        </div>
      </section>

      {/* 4. SOLUÇÃO EM 3 PASSOS */}
      <section className="border-y border-line bg-ink-900/50">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-volt-400">
              Como funciona
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold text-white sm:text-4xl">
              Em 3 passos, o AUTOVOLT trabalha pra trazer seu cliente de volta.
            </h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {STEPS.map((item) => (
              <article key={item.step} className="surface p-6">
                <span className="flex size-9 items-center justify-center rounded-xl bg-volt-400/12 font-display text-sm font-bold text-volt-300">
                  {item.step}
                </span>
                <h3 className="mt-4 text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{item.text}</p>
              </article>
            ))}
          </div>
          <div className="mt-10">
            <CtaButton />
          </div>
        </div>
      </section>

      {/* 5. FUNCIONALIDADES */}
      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl font-bold text-white sm:text-4xl">
            Tudo que a sua operação precisa, num lugar só
          </h2>
          <p className="mt-3 text-sm text-muted sm:text-base">
            Sem complicação. Feito para o dia a dia de quem cuida de carro — não para quem entende
            de sistema.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="surface p-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-ink-800 text-volt-300">
                  <Icon size={18} />
                </span>
                <h3 className="mt-4 text-sm font-semibold text-white">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{feature.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* Prova social — vazio de propósito (sem depoimentos inventados). */}
      <SocialProof />

      {/* 6. PREÇO */}
      <section className="border-y border-line bg-ink-900/50">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-lg">
            <div className="surface relative overflow-hidden p-7 text-center sm:p-9">
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage:
                    "radial-gradient(22rem 12rem at 50% 0%, rgba(18,226,155,.14), transparent 70%)",
                }}
              />
              <div className="relative">
                <Badge tone="volt" className="mb-5">
                  AUTOVOLT Profissional
                </Badge>
                <div className="flex items-baseline justify-center gap-1.5">
                  <span className="font-display text-5xl font-bold text-white">R$47</span>
                  <span className="text-base text-muted">/mês</span>
                </div>
                <p className="mt-2 text-sm text-muted">Plano único. Tudo incluído.</p>

                <ul className="mt-7 space-y-3 text-left">
                  {PRICE_POINTS.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-sm text-soft">
                      <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-volt-400" />
                      {point}
                    </li>
                  ))}
                </ul>

                <CtaButton className="mt-8 w-full" />
                <p className="mt-3 text-xs text-muted">
                  Você cria a conta e já ativa a assinatura. Sem período de teste — e sem
                  fidelidade pra te prender.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FAQ */}
      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <h2 className="mb-8 text-center font-display text-2xl font-bold text-white sm:text-4xl">
          Perguntas frequentes
        </h2>
        <Faq />
      </section>

      {/* 8. CTA FINAL */}
      <section className="border-t border-line">
        <div className="glow-top relative overflow-hidden">
          <div className="grid-lines pointer-events-none absolute inset-0 opacity-40" />
          <div className="relative mx-auto max-w-3xl px-5 py-14 text-center sm:px-8 sm:py-20">
            <h2 className="mx-auto max-w-2xl font-display text-2xl font-bold text-white sm:text-4xl">
              Pare de perder o cliente que já é seu.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
              Comece hoje por R$47/mês. Sem fidelidade, cancele a qualquer momento. Em minutos você
              já sabe quem está na hora de voltar.
            </p>
            <div className="mt-9 flex items-center justify-center gap-2">
              <MessageCircle size={16} className="text-volt-400" />
              <span className="text-sm text-soft">Traga seu faturamento de volta pelo WhatsApp.</span>
            </div>
            <div className="mt-6">
              <CtaButton />
            </div>
          </div>
        </div>
      </section>

      {/* 9. RODAPÉ */}
      <LandingFooter />
    </div>
  );
}
