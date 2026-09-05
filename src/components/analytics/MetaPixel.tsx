"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Meta Pixel — instalação base, uma única vez para todo o app.
 *
 * Montado no layout raiz, então cobre a página de vendas, autenticação, área
 * logada e /assinatura. O ID é público (NEXT_PUBLIC_META_PIXEL_ID). Sem a env
 * configurada, o componente não renderiza nada.
 *
 * PageView sem duplicar:
 *   - o snippet base dispara UM PageView no carregamento da página;
 *   - a navegação client-side (App Router) dispara PageView a cada troca de
 *     rota, PULANDO a primeira execução (que o snippet já cobriu).
 */

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export function MetaPixel() {
  const pathname = usePathname();
  // O snippet base já dispara o PageView inicial; o efeito só cobre as trocas
  // de rota seguintes.
  const skipFirst = useRef(true);

  useEffect(() => {
    if (!PIXEL_ID) return;
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("track", "PageView");
    }
  }, [pathname]);

  if (!PIXEL_ID) return null;

  return (
    <>
      <Script
        id="meta-pixel-base"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL_ID}');fbq('track','PageView');`,
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
