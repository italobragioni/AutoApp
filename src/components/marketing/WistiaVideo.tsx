"use client";

import Script from "next/script";

/**
 * Player de vídeo do Wistia (embed inline responsivo).
 *
 * Usado como VSL na página de vendas. O `mediaId` é o hashed id do vídeo no
 * Wistia. `paddingTop` define o formato: "56.25%" = 16:9 (horizontal),
 * "177.78%" = 9:16 (vertical/retrato). Sem id, não renderiza nada.
 *
 * Os scripts carregam do CDN do Wistia no navegador do visitante (em produção).
 */
export function WistiaVideo({
  mediaId,
  paddingTop = "56.25%",
  className,
}: {
  mediaId?: string;
  paddingTop?: string;
  className?: string;
}) {
  if (!mediaId) return null;

  return (
    <div className={className}>
      <Script src="https://fast.wistia.com/assets/external/E-v1.js" strategy="afterInteractive" />
      <Script
        src={`https://fast.wistia.com/embed/medias/${mediaId}.jsonp`}
        strategy="afterInteractive"
      />
      <div className="wistia_responsive_padding" style={{ padding: `${paddingTop} 0 0 0`, position: "relative" }}>
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
