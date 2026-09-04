"use client";

import { useState } from "react";

import { cn } from "@/lib/format";

/**
 * Marca AUTOVOLT.
 *
 * A logo real é servida de public/brand (arquivos de imagem). Enquanto esses
 * arquivos não existirem — ou se falharem ao carregar — cai automaticamente na
 * marca vetorial de reserva abaixo, então a interface nunca fica sem logo.
 *
 *   public/brand/autovolt-mark.png  → só o ícone (carro + raio), quadrado
 *   public/brand/autovolt-logo.png  → a logo completa (ícone + AUTOVOLT)
 *
 * Use imagens com FUNDO TRANSPARENTE: o app tem tema escuro.
 */

const MARK_SRC = "/brand/autovolt-mark.png";
const LOGO_SRC = "/brand/autovolt-logo.png";

/** Marca vetorial de reserva (usada só se a imagem não carregar). */
function MarkFallback({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="av-grad" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3FEDB2" />
          <stop offset="1" stopColor="#00A06C" />
        </linearGradient>
      </defs>
      <path
        d="M12 3h24a9 9 0 0 1 9 9v24a9 9 0 0 1-9 9H12a9 9 0 0 1-9-9V12a9 9 0 0 1 9-9Z"
        fill="#0B1017"
        stroke="url(#av-grad)"
        strokeWidth="2"
      />
      <path d="M9 30h7" stroke="#12E29B" strokeWidth="2" strokeLinecap="round" opacity=".45" />
      <path d="M9 35h11" stroke="#12E29B" strokeWidth="2" strokeLinecap="round" opacity=".25" />
      <path d="M26.5 9 15 26.4h7.6L20.4 39 33 21.2h-7.9L26.5 9Z" fill="url(#av-grad)" />
    </svg>
  );
}

/** Só o ícone da marca. */
export function LogoMark({ className, size = 36 }: { className?: string; size?: number }) {
  const [failed, setFailed] = useState(false);

  if (failed) return <MarkFallback className={className} size={size} />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={MARK_SRC}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={cn("shrink-0 object-contain", className)}
      style={{ height: size, width: size }}
    />
  );
}

/**
 * Logo completa (ícone + palavra). Em `compact`, mostra só o ícone.
 */
export function Logo({
  className,
  compact = false,
  size = 36,
}: {
  className?: string;
  compact?: boolean;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (compact) return <LogoMark size={size} className={className} />;

  if (!failed) {
    // A logo completa é mais larga que alta; a altura acompanha `size`.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={LOGO_SRC}
        alt="AUTOVOLT"
        onError={() => setFailed(true)}
        className={cn("w-auto object-contain", className)}
        style={{ height: Math.round(size * 1.5) }}
      />
    );
  }

  // Reserva: marca vetorial + palavra em texto (comportamento anterior).
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <MarkFallback size={size} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.05rem] font-bold tracking-[0.18em] text-white">
          AUTOVOLT
        </span>
        <span className="mt-1 text-[0.6rem] font-medium uppercase tracking-[0.22em] text-muted">
          Estética Automotiva
        </span>
      </span>
    </span>
  );
}
