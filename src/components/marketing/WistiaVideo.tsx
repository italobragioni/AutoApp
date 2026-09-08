"use client";

import Script from "next/script";

/**
 * Player de vídeo do Wistia (embed inline responsivo 16:9).
 *
 * Usado como VSL na página de vendas. O `mediaId` é o hashed ID do vídeo no
 * Wistia (ex.: em https://<conta>.wistia.com/medias/XXXXXXXXXX, o XXXXXXXXXX).
 * Vem de NEXT_PUBLIC_WISTIA_MEDIA_ID — sem ID, o componente não renderiza nada
 * (a página fica exatamente como estava).
 *
 * Os scripts carregam do CDN do Wistia no navegador do visitante (em produção).
 */
export function WistiaVideo({ mediaId, className }: { mediaId?: string; className?: string }) {
  if (!mediaId) return null;

  return (
    <div className={className}>
      <Script src="https://fast.wistia.com/assets/external/E-v1.js" strategy="afterInteractive" />
      <Script
        src={`https://fast.wistia.com/embed/medias/${mediaId}.jsonp`}
        strategy="afterInteractive"
      />
      <div className="wistia_responsive_padding" style={{ padding: "56.25% 0 0 0", position: "relative" }}>
        <div
          className="wistia_responsive_wrapper"
          style={{ height: "100%", left: 0, position: "absolute", top: 0, width: "100%" }}
        >
          <div
            className={`wistia_embed wistia_async_${mediaId} videoFoam=true`}
            style={{ height: "100%", position: "relative", width: "100%" }}
          >
            &nbsp;
          </div>
        </div>
      </div>
    </div>
  );
}
