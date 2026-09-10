"use client";

import Script from "next/script";
import type { CSSProperties, FC } from "react";

/**
 * Player de vídeo do Wistia (novo embed via web component `wistia-player`).
 *
 * `mediaId` é o hashed id do vídeo. `aspect` é a proporção largura/altura
 * ("0.5625" = 9:16 vertical, "1.7778" = 16:9 horizontal) e `paddingTop` é a
 * altura relativa usada só no placeholder enquanto o player carrega
 * ("177.78%" = 9:16, "56.25%" = 16:9). Sem id, não renderiza nada.
 *
 * Os scripts carregam do CDN do Wistia no navegador do visitante (produção).
 */

// Custom element tipado sem depender do namespace JSX (compatível com React 19).
const WistiaPlayer = "wistia-player" as unknown as FC<{
  "media-id": string;
  aspect?: string;
  style?: CSSProperties;
}>;

export function WistiaVideo({
  mediaId,
  aspect = "0.5625",
  paddingTop = "177.78%",
  className,
}: {
  mediaId?: string;
  aspect?: string;
  paddingTop?: string;
  className?: string;
}) {
  if (!mediaId) return null;

  return (
    <div className={className}>
      <Script src="https://fast.wistia.com/player.js" strategy="afterInteractive" />
      <Script
        src={`https://fast.wistia.com/embed/${mediaId}.js`}
        strategy="afterInteractive"
        type="module"
      />
      <style
        dangerouslySetInnerHTML={{
          __html: `wistia-player[media-id='${mediaId}']:not(:defined){background:center / contain no-repeat url('https://fast.wistia.com/embed/medias/${mediaId}/swatch');display:block;filter:blur(5px);padding-top:${paddingTop};}`,
        }}
      />
      <WistiaPlayer media-id={mediaId} aspect={aspect} style={{ display: "block", width: "100%" }} />
    </div>
  );
}
