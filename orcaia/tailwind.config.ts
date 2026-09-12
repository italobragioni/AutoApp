import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta base do ORCAIA. Ajustavel quando o design system evoluir.
        brand: {
          DEFAULT: "#2563EB",
          fg: "#FFFFFF",
          muted: "#EFF4FF",
        },
        ink: {
          DEFAULT: "#0F172A",
          soft: "#475569",
          faint: "#94A3B8",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          soft: "#F8FAFC",
          border: "#E2E8F0",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
