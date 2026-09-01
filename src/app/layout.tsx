import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import "./globals.css";

// Fontes auto-hospedadas: o build nao depende de rede.
const inter = localFont({
  src: "../../public/fonts/inter-variable.woff2",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
});

const sora = localFont({
  src: "../../public/fonts/sora-variable.woff2",
  variable: "--font-sora",
  display: "swap",
  weight: "100 800",
});

export const metadata: Metadata = {
  title: {
    default: "AUTOVOLT — Organize sua estética e faça seus clientes voltarem",
    template: "%s · AUTOVOLT",
  },
  description:
    "Plataforma de gestão e crescimento para estética automotiva, detalhamento e lava-rápidos premium. Organize clientes, agenda e orçamentos — e recupere clientes inativos automaticamente.",
  applicationName: "AUTOVOLT",
  keywords: [
    "estética automotiva",
    "detalhamento automotivo",
    "lava-rápido",
    "gestão",
    "retenção de clientes",
  ],
};

export const viewport: Viewport = {
  themeColor: "#070A0F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${sora.variable}`}>
      <body className="min-h-dvh bg-ink-950 font-sans">{children}</body>
    </html>
  );
}
