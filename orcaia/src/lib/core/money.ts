// Conversao entre a entrada do usuario (reais/percentual como texto) e o
// armazenamento interno (centavos e pontos-base, sempre inteiros).

/**
 * Converte um texto de valor monetario em centavos.
 * Aceita formatos pt-BR ("1.234,56"), simples ("1234,56" / "1234.56") e numeros.
 * Retorna null quando o texto nao representa um numero valido.
 */
export function parseMoneyToCents(input: unknown): number | null {
  if (typeof input === "number") {
    return Number.isFinite(input) ? Math.round(input * 100) : null;
  }
  if (typeof input !== "string") return null;

  let s = input.trim();
  if (s === "") return null;
  s = s.replace(/[R$\s]/g, "");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // Ex.: "1.234,56" -> ponto e separador de milhar, virgula e decimal.
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // Ex.: "1234,56" -> virgula e decimal.
    s = s.replace(",", ".");
  }
  // Se so tem ponto, ja esta no formato correto ("1234.56").

  const value = Number(s);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** Converte centavos em texto para preencher inputs ("15000" -> "150.00"). */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Converte um texto de percentual em pontos-base ("20" -> 2000; "20,5" -> 2050).
 * Retorna null quando invalido.
 */
export function parsePercentToBps(input: unknown): number | null {
  if (typeof input === "number") {
    return Number.isFinite(input) ? Math.round(input * 100) : null;
  }
  if (typeof input !== "string") return null;
  const s = input.trim().replace("%", "").replace(",", ".");
  if (s === "") return null;
  const value = Number(s);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** Converte pontos-base em texto de percentual para inputs (2000 -> "20"). */
export function bpsToInput(bps: number): string {
  return String(bps / 100);
}
