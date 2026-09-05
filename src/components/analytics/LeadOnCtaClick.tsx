"use client";

import { useEffect } from "react";

import { trackLead } from "@/lib/meta-pixel";

/**
 * Dispara o evento Lead quando o visitante clica em QUALQUER CTA da página de
 * vendas que leva ao cadastro (`/cadastro`).
 *
 * Faz isso por delegação de clique — sem tocar nos botões, links, textos ou
 * layout existentes. Cada clique real gera um Lead; abrir a página não dispara
 * nada. Renderiza nada.
 */
export function LeadOnCtaClick() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const anchor = target ? (target.closest("a[href]") as HTMLAnchorElement | null) : null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      // Só os CTAs que levam a criar conta.
      if (href === "/cadastro" || href.startsWith("/cadastro?") || href.startsWith("/cadastro#")) {
        trackLead();
      }
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
