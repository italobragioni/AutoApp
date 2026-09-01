import type { Config } from "tailwindcss";

/**
 * Design system AUTOVOLT.
 * Base escura e neutra + um unico acento "volt" (verde eletrico) que carrega
 * a ideia de energia, tecnologia e crescimento. Sem excesso de efeito.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#070A0F",
          900: "#0B1017",
          850: "#0F151E",
          800: "#131B26",
          700: "#1B2533",
          600: "#243141",
          500: "#33445A",
        },
        volt: {
          50: "#E6FFF6",
          100: "#B8FFE6",
          200: "#7BF7CD",
          300: "#3FEDB2",
          400: "#12E29B",
          500: "#00C685",
          600: "#00A06C",
          700: "#007A52",
        },
        line: "#1E2836",
        muted: "#8695A8",
        soft: "#B4C1D1",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-sora)", "var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,.4), 0 8px 24px -12px rgba(0,0,0,.6)",
        lift: "0 12px 40px -16px rgba(0,0,0,.75)",
        volt: "0 8px 30px -12px rgba(18,226,155,.45)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        "fade-up": "fade-up .35s ease-out both",
        fade: "fade-in .3s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
