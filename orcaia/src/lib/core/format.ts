// Formatadores compartilhados. Dinheiro e sempre guardado em centavos; a
// conversao para reais acontece so na exibicao.

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Converte pontos-base para texto percentual (2000 -> "20%"). */
export function formatBps(bps: number): string {
  const pct = bps / 100;
  return `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("pt-BR");
}
