import { cn } from "@/lib/format";

/**
 * Marca AUTOVOLT (temporaria).
 * O icone combina tres ideias: o perfil de um carro em movimento (as duas
 * faixas inclinadas), o raio/energia eletrica e uma seta ascendente de
 * crescimento — dentro de um contorno tecnologico.
 */
export function LogoMark({ className, size = 36 }: { className?: string; size?: number }) {
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

      {/* contorno tecnologico (chanfrado, remete a chassi) */}
      <path
        d="M12 3h24a9 9 0 0 1 9 9v24a9 9 0 0 1-9 9H12a9 9 0 0 1-9-9V12a9 9 0 0 1 9-9Z"
        fill="#0B1017"
        stroke="url(#av-grad)"
        strokeWidth="2"
      />

      {/* faixas de movimento / velocidade */}
      <path d="M9 30h7" stroke="#12E29B" strokeWidth="2" strokeLinecap="round" opacity=".45" />
      <path d="M9 35h11" stroke="#12E29B" strokeWidth="2" strokeLinecap="round" opacity=".25" />

      {/* raio = volt, desenhado tambem como seta de crescimento */}
      <path
        d="M26.5 9 15 26.4h7.6L20.4 39 33 21.2h-7.9L26.5 9Z"
        fill="url(#av-grad)"
      />
    </svg>
  );
}

export function Logo({
  className,
  compact = false,
  size = 36,
}: {
  className?: string;
  compact?: boolean;
  size?: number;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[1.05rem] font-bold tracking-[0.18em] text-white">
            AUTOVOLT
          </span>
          <span className="mt-1 text-[0.6rem] font-medium uppercase tracking-[0.22em] text-muted">
            Estética Automotiva
          </span>
        </span>
      )}
    </span>
  );
}
