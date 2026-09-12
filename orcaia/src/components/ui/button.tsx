import { cn } from "@/lib/core/cn";

type Variant = "primary" | "secondary" | "ghost";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const STYLES: Record<Variant, string> = {
  primary: "bg-brand text-brand-fg hover:bg-brand/90",
  secondary:
    "bg-white text-ink border border-surface-border hover:bg-surface-soft",
  ghost: "text-ink-soft hover:bg-surface-soft",
};

export function Button({ variant = "primary", className, ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        STYLES[variant],
        className,
      )}
      {...props}
    />
  );
}
