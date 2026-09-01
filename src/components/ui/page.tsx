import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/format";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-volt-400">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-2xl font-bold text-white sm:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function StatCard({
  label,
  value,
  hint,
  delta,
  icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  /** Variacao percentual vs. periodo anterior. */
  delta?: number | null;
  icon?: ReactNode;
  tone?: "default" | "volt" | "warning" | "danger";
}) {
  const ring = {
    default: "",
    volt: "ring-1 ring-inset ring-volt-400/25",
    warning: "ring-1 ring-inset ring-amber-400/25",
    danger: "ring-1 ring-inset ring-rose-400/25",
  }[tone];

  const iconTone = {
    default: "bg-ink-800 text-soft",
    volt: "bg-volt-400/12 text-volt-300",
    warning: "bg-amber-400/12 text-amber-300",
    danger: "bg-rose-400/12 text-rose-300",
  }[tone];

  const positive = (delta ?? 0) >= 0;

  return (
    <div className={cn("surface p-5", ring)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted">{label}</p>
        {icon && (
          <span className={cn("flex size-9 items-center justify-center rounded-xl", iconTone)}>
            {icon}
          </span>
        )}
      </div>
      <p className="mt-3 font-display text-[1.7rem] font-bold leading-none text-white">{value}</p>
      <div className="mt-2.5 flex items-center gap-2">
        {typeof delta === "number" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-semibold",
              positive ? "text-volt-300" : "text-rose-300",
            )}
          >
            {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(delta).toFixed(0)}%
          </span>
        )}
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
    </div>
  );
}

/** Faixa de destaque usada para comunicar oportunidades de faturamento. */
export function OpportunityBanner({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-volt-400/25 bg-ink-900 p-5 sm:p-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(28rem 14rem at 88% 0%, rgba(18,226,155,.16), transparent 70%)",
        }}
      />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold text-white sm:text-lg">{title}</h2>
          <p className="mt-1.5 max-w-xl text-sm text-soft/90">{description}</p>
        </div>
        {action}
      </div>
    </div>
  );
}
