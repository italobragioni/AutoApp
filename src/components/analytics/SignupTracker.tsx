"use client";

import { useEffect, useRef } from "react";

import { trackCompleteRegistration } from "@/lib/meta-pixel";

/**
 * Dispara CompleteRegistration UMA vez, logo após um cadastro concluído com
 * sucesso.
 *
 * O sinal de sucesso é o marcador `?bemvindo=1` que o registerAction anexa ao
 * redirecionar para /assinatura (só acontece depois de a conta ser criada no
 * banco). Aqui:
 *   - dispara o evento uma única vez;
 *   - remove o marcador da URL (replaceState) para que um refresh não redispare.
 *
 * Renderiza nada.
 */
export function SignupTracker({ fire }: { fire: boolean }) {
  const done = useRef(false);

  useEffect(() => {
    if (!fire || done.current) return;
    done.current = true;
    trackCompleteRegistration();
    // Limpa o marcador para evitar novo disparo em recarregamentos.
    if (typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", "/assinatura");
    }
  }, [fire]);

  return null;
}
