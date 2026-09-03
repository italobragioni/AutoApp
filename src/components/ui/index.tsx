import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/format";

/* -------------------------------------------------------------------------- */
/* Card                                                                        */
/* -------------------------------------------------------------------------- */

export function Card({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  // min-w-0: quando o Card e item de um grid/flex, `min-width: auto` (o padrao)
  // o impediria de encolher abaixo do min-content do conteudo — uma tabela larga
  // ou um texto longo esticariam o card para alem da coluna e a pagina inteira
  // ganharia scroll horizontal no celular. Com min-w-0 o card respeita a track e
  // o conteudo encolhe, quebra ou rola dentro dele.
  return (
    <div className={cn("surface min-w-0", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      </div>
      {/* max-w-full: uma acao larga (ex.: faixa de filtros) fica presa a largura
          do cabecalho e pode rolar/quebrar dentro dela, em vez de esticar o card
          no celular. */}
      {action && <div className="min-w-0 max-w-full shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("p-5", className)} {...props}>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Badge                                                                       */
/* -------------------------------------------------------------------------- */

export type Tone = "neutral" | "success" | "warning" | "danger" | "muted" | "volt" | "info";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-ink-700/70 text-soft ring-ink-600",
  volt: "bg-volt-400/12 text-volt-300 ring-volt-400/25",
  success: "bg-emerald-400/12 text-emerald-300 ring-emerald-400/25",
  warning: "bg-amber-400/12 text-amber-300 ring-amber-400/25",
  danger: "bg-rose-400/12 text-rose-300 ring-rose-400/25",
  info: "bg-sky-400/12 text-sky-300 ring-sky-400/25",
  muted: "bg-ink-800 text-muted ring-ink-700",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  dot = false,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-medium ring-1 ring-inset",
        TONE_CLASS[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Button                                                                      */
/* -------------------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    "bg-volt-400 text-ink-950 hover:bg-volt-300 shadow-volt font-semibold disabled:bg-volt-700 disabled:text-ink-900",
  secondary:
    "bg-ink-800 text-white ring-1 ring-inset ring-ink-600 hover:bg-ink-700 hover:ring-ink-500",
  ghost: "text-soft hover:bg-ink-800 hover:text-white",
  danger: "bg-rose-500/90 text-white hover:bg-rose-500",
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-sm gap-2",
};

const BUTTON_BASE =
  "inline-flex items-center justify-center rounded-xl transition-colors focus-ring disabled:cursor-not-allowed disabled:opacity-70";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cn(BUTTON_BASE, VARIANT_CLASS[variant], SIZE_CLASS[size], className)}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <Link
      className={cn(BUTTON_BASE, VARIANT_CLASS[variant], SIZE_CLASS[size], className)}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Formulario                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Campos de formulario.
 *
 * `text-base sm:text-sm` nao e detalhe estetico: o Safari no iOS dá zoom
 * automatico ao focar qualquer campo com fonte menor que 16px. Mantendo 16px
 * (text-base) no celular o zoom nao acontece, e a partir de `sm` volta para
 * 14px, preservando a aparencia no desktop.
 */
const FIELD_CLASS =
  "w-full rounded-xl border border-ink-600 bg-ink-850 px-3.5 py-2.5 text-base sm:text-sm text-white placeholder:text-muted/70 transition-colors focus-ring focus-visible:border-volt-400/50";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-soft">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[0.7rem] text-muted">{hint}</span>}
    </label>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(FIELD_CLASS, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(FIELD_CLASS, "min-h-24 resize-y", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(FIELD_CLASS, "appearance-none pr-9", className)} {...props}>
      {children}
    </select>
  );
}

/* -------------------------------------------------------------------------- */
/* Tabela                                                                      */
/* -------------------------------------------------------------------------- */

export function Table({ className, children, ...props }: ComponentProps<"table">) {
  // min-w-0: o container rola a tabela internamente, mas como item de grid/flex
  // ele herdaria `min-width: auto` e se esticaria ate o min-w-[42rem] da tabela,
  // empurrando a pagina. Com min-w-0 ele respeita a largura disponivel e o
  // scroll acontece dentro dele, no celular.
  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <table className={cn("w-full min-w-[42rem] text-sm", className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function Th({ className, children, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "border-b border-line px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-wider text-muted",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Td({ className, children, ...props }: ComponentProps<"td">) {
  return (
    <td className={cn("border-b border-line/60 px-4 py-3.5 align-middle", className)} {...props}>
      {children}
    </td>
  );
}

export function Tr({ className, children, ...props }: ComponentProps<"tr">) {
  return (
    <tr className={cn("transition-colors hover:bg-ink-850/60", className)} {...props}>
      {children}
    </tr>
  );
}

/* -------------------------------------------------------------------------- */
/* Estados                                                                     */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon && (
        <span className="flex size-12 items-center justify-center rounded-2xl bg-ink-800 text-muted">
          {icon}
        </span>
      )}
      <div>
        <p className="font-display text-sm font-semibold text-white">{title}</p>
        {description && <p className="mt-1.5 max-w-sm text-xs text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Avatar({
  name,
  color,
  size = 36,
}: {
  name: string;
  color?: string;
  size?: number;
}) {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-display text-xs font-bold ring-1 ring-inset ring-white/10"
      style={{
        width: size,
        height: size,
        background: `${color ?? "#12E29B"}1f`,
        color: color ?? "#12E29B",
      }}
      aria-hidden="true"
    >
      {letters}
    </span>
  );
}

/** Barra de progresso simples usada em metas e distribuicoes. */
export function Meter({
  value,
  max = 100,
  tone = "volt",
  className,
}: {
  value: number;
  max?: number;
  tone?: "volt" | "warning" | "danger" | "info";
  className?: string;
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const bar = {
    volt: "bg-volt-400",
    warning: "bg-amber-400",
    danger: "bg-rose-400",
    info: "bg-sky-400",
  }[tone];

  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-ink-700", className)}>
      <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${percent}%` }} />
    </div>
  );
}
