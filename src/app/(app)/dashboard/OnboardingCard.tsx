"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ArrowRight, Check, Lock, Rocket, X } from "lucide-react";

import { Card } from "@/components/ui";
import { dismissOnboardingAction } from "@/app/actions/onboarding";
import { cn } from "@/lib/format";

export type OnboardingStepView = {
  key: string;
  title: string;
  description: string;
  done: boolean;
  href: string;
  /** O papel atual pode executar a ação desta etapa? */
  allowed: boolean;
};

/**
 * Card de primeiros passos no Dashboard.
 *
 * Mostra progresso real (as etapas ja vem com `done` calculado no servidor a
 * partir do banco) e leva direto a cada acao. Nao bloqueia nada: e um guia ao
 * lado do painel, sempre dispensavel.
 *
 * Uma etapa que o papel do usuario nao pode executar aparece como informacao
 * (com cadeado), nunca como link — o progresso, porem, reflete o dado real
 * mesmo que outra pessoa da equipe tenha feito aquela parte.
 */
export function OnboardingCard({
  steps,
  doneCount,
  total,
  complete,
}: {
  steps: OnboardingStepView[];
  doneCount: number;
  total: number;
  complete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function dismiss() {
    startTransition(async () => {
      await dismissOnboardingAction();
      router.refresh();
    });
  }

  const percent = Math.round((doneCount / total) * 100);

  // Concluido: mensagem curta de "primeiro valor", com a opcao de dispensar.
  if (complete) {
    return (
      <Card className="relative overflow-hidden border-volt-400/25 bg-volt-400/[0.06] p-5">
        <DismissButton onClick={dismiss} pending={pending} />
        <div className="flex items-start gap-4 pr-8">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-volt-400/15 text-volt-300">
            <Rocket size={20} />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-white">
              Seu AUTOVOLT está pronto para começar 🚀
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-soft">
              Agora acompanhe sua operação, organize seus atendimentos e veja quais clientes estão
              na hora de voltar.
            </p>
            <Link
              href="/retencao"
              className="focus-ring mt-3 inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-volt-300 hover:text-volt-200"
            >
              Ver oportunidades de retorno
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="relative p-5">
      <DismissButton onClick={dismiss} pending={pending} />

      <div className="pr-8">
        <h2 className="font-display text-base font-bold text-white">
          Vamos preparar sua empresa 🚗
        </h2>
        <p className="mt-1 text-sm text-soft">
          Alguns passos rápidos para o AUTOVOLT trabalhar por você.
        </p>

        {/* Progresso real */}
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full rounded-full bg-volt-400 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-medium text-muted" data-progress>
            {doneCount} de {total} etapas
          </span>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {steps.map((step) => {
          const clickable = !step.done && step.allowed;
          const body = (
            <>
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border",
                  step.done
                    ? "border-volt-400/40 bg-volt-400/15 text-volt-300"
                    : "border-line bg-ink-900 text-muted",
                )}
              >
                {step.done ? <Check size={13} /> : !step.allowed ? <Lock size={12} /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-sm font-medium",
                    step.done ? "text-muted line-through" : "text-white",
                  )}
                >
                  {step.title}
                </span>
                <span className="block text-xs text-muted">
                  {!step.allowed && !step.done
                    ? "Alguém com permissão precisa fazer esta etapa."
                    : step.description}
                </span>
              </span>
              {clickable && <ArrowRight size={15} className="shrink-0 text-volt-400" />}
            </>
          );

          const shell = "flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors";

          if (clickable) {
            return (
              <li key={step.key}>
                <Link
                  href={step.href}
                  data-step={step.key}
                  data-done="false"
                  className={cn(
                    shell,
                    "focus-ring border-line bg-ink-850 hover:border-ink-600 hover:bg-ink-800",
                  )}
                >
                  {body}
                </Link>
              </li>
            );
          }

          return (
            <li
              key={step.key}
              data-step={step.key}
              data-done={step.done ? "true" : "false"}
              className={cn(shell, "border-line/60 bg-ink-850/40")}
            >
              {body}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function DismissButton({ onClick, pending }: { onClick: () => void; pending: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label="Dispensar guia de primeiros passos"
      data-dismiss-onboarding
      className="focus-ring absolute right-3 top-3 rounded-lg p-1.5 text-muted transition-colors hover:bg-ink-800 hover:text-white disabled:opacity-50"
    >
      <X size={16} />
    </button>
  );
}
