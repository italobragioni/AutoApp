// Opcoes sugeridas para os formularios do nicho Vidracaria.
//
// IMPORTANTE: aqui NAO ha precos. Sao apenas sugestoes de preenchimento
// (datalists) para tipos de vidro, espessuras, acabamentos e ferragens. Todos
// os precos sao cadastrados e ajustados pela empresa (ver os modelos
// GlassOption / FinishOption / HardwareOption).

export const GLASS_TYPE_SUGGESTIONS = [
  "Temperado",
  "Laminado",
  "Comum",
  "Espelho",
  "Outros",
];

export const THICKNESS_SUGGESTIONS_MM = [4, 6, 8, 10, 12];

export const FINISH_SUGGESTIONS = [
  "Polido",
  "Lapidado",
  "Bisotê",
  "Sem acabamento",
  "Outros",
];

export const HARDWARE_SUGGESTIONS = [
  "Dobradiça",
  "Puxador",
  "Perfil",
  "Roldana",
  "Fechadura",
  "Suporte",
  "Outros",
];

// Unidades de cobranca do acabamento.
export const FINISH_UNITS = [
  { value: "ml", label: "por metro linear (perímetro)" },
  { value: "m2", label: "por m²" },
  { value: "fixo", label: "valor fixo por peça" },
] as const;

export type FinishUnit = (typeof FINISH_UNITS)[number]["value"];

export function isFinishUnit(v: string): v is FinishUnit {
  return v === "ml" || v === "m2" || v === "fixo";
}

export function finishUnitLabel(unit: string): string {
  return FINISH_UNITS.find((u) => u.value === unit)?.label ?? unit;
}
