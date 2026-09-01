"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/format";

/**
 * Modal do AUTOVOLT.
 *
 * Segue a linguagem visual ja usada na folha deslizante do menu mobile
 * (MobileNav): fundo escurecido, superficie `surface`, cantos arredondados.
 * No mobile sobe de baixo ocupando a largura toda; no desktop centraliza.
 *
 * Fechamento por Esc, clique fora e botao — e o foco vai para dentro do dialogo
 * ao abrir, para quem navega por teclado nao continuar preso na pagina atras.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);

    // Trava o scroll do fundo enquanto o modal estiver aberto.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    panel.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm"
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "animate-fade-up relative flex max-h-[92dvh] w-full flex-col overflow-hidden",
          "rounded-t-3xl border border-line bg-ink-900 shadow-lift outline-none",
          "sm:rounded-2xl",
          size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-white">{title}</h2>
            {description && <p className="mt-1 text-xs text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="focus-ring -mr-1 shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-ink-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

        {footer && (
          <div className="border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
