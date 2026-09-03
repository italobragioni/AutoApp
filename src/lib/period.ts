/**
 * Periodo dos relatorios: presets, resolucao e comparativo.
 *
 * Modulo puro de proposito (sem banco, sem sessao): o filtro roda no navegador
 * e precisa dos mesmos presets que o servidor usa para resolver as datas.
 */

export const PERIOD_PRESETS = [
  { key: "hoje", label: "Hoje" },
  { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "este-mes", label: "Este mês" },
  { key: "mes-anterior", label: "Mês anterior" },
  { key: "3m", label: "Últimos 3 meses" },
  { key: "6m", label: "Últimos 6 meses" },
  { key: "este-ano", label: "Este ano" },
  { key: "personalizado", label: "Personalizado" },
] as const;

export type PeriodKey = (typeof PERIOD_PRESETS)[number]["key"];

export const DEFAULT_PERIOD: PeriodKey = "30d";

export type Range = {
  /** Inicio do primeiro dia, 00:00:00.000. */
  from: Date;
  /** Fim do ultimo dia, 23:59:59.999 — o periodo inclui o dia final inteiro. */
  to: Date;
};

export type Period = Range & {
  key: PeriodKey;
  label: string;
  /** Dias corridos, contando o primeiro e o ultimo. */
  days: number;
};

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function isIsoDate(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function daysIn(range: Range) {
  return Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / 86_400_000));
}

/**
 * Traduz o filtro da URL em datas reais.
 *
 * Tudo o que vem de fora e conferido: chave desconhecida cai no padrao, datas
 * fora do formato sao ignoradas e um intervalo invertido e corrigido em vez de
 * gerar consulta vazia.
 */
export function resolvePeriod(
  input: { periodo?: string; de?: string; ate?: string },
  now = new Date(),
): Period {
  const requested = PERIOD_PRESETS.find((preset) => preset.key === input.periodo);
  const key: PeriodKey = requested?.key ?? DEFAULT_PERIOD;

  const today = startOfDay(now);
  const range = (() => {
    switch (key) {
      case "hoje":
        return { from: today, to: endOfDay(now) };
      case "7d":
        return { from: startOfDay(new Date(today.getTime() - 6 * 86_400_000)), to: endOfDay(now) };
      case "30d":
        return { from: startOfDay(new Date(today.getTime() - 29 * 86_400_000)), to: endOfDay(now) };
      case "este-mes":
        return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
      case "mes-anterior":
        return {
          from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          to: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)),
        };
      case "3m":
        return { from: new Date(now.getFullYear(), now.getMonth() - 2, 1), to: endOfDay(now) };
      case "6m":
        return { from: new Date(now.getFullYear(), now.getMonth() - 5, 1), to: endOfDay(now) };
      case "este-ano":
        return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) };
      case "personalizado": {
        // Sem datas validas, o personalizado nao inventa nada: cai no padrao.
        if (!isIsoDate(input.de) || !isIsoDate(input.ate)) {
          return {
            from: startOfDay(new Date(today.getTime() - 29 * 86_400_000)),
            to: endOfDay(now),
          };
        }
        const de = startOfDay(new Date(`${input.de}T12:00:00`));
        const ate = endOfDay(new Date(`${input.ate}T12:00:00`));
        // Intervalo invertido: troca em vez de devolver nada.
        return de <= ate ? { from: de, to: ate } : { from: startOfDay(ate), to: endOfDay(de) };
      }
    }
  })();

  const label = requested?.label ?? PERIOD_PRESETS.find((p) => p.key === DEFAULT_PERIOD)!.label;
  return { ...range, key, label, days: daysIn(range) };
}

/**
 * Periodo imediatamente anterior, de mesma duracao.
 *
 * Termina um milissegundo antes do inicio do periodo atual, entao 01/08–31/08
 * compara com 01/07–31/07 e "ultimos 30 dias" compara com os 30 dias antes
 * desses. Nao ha sobreposicao de um unico instante.
 */
export function previousPeriod(range: Range): Range {
  const span = range.to.getTime() - range.from.getTime();
  const to = new Date(range.from.getTime() - 1);
  return { from: new Date(to.getTime() - span), to };
}

