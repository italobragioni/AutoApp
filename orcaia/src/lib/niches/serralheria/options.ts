// Opcoes sugeridas para os formularios do nicho Serralheria.
// Sem precos aqui — apenas listas para os selects/datalists.

export const STEEL_MATERIAL_SUGGESTIONS = [
  "Ferro",
  "Aço carbono",
  "Alumínio",
  "Inox",
  "Outros",
];

export const SERVICE_TYPES = [
  { value: "portao", label: "Portão" },
  { value: "grade", label: "Grade" },
  { value: "corrimao", label: "Corrimão" },
  { value: "guarda_corpo", label: "Guarda-corpo" },
  { value: "estrutura", label: "Estrutura metálica" },
  { value: "escada", label: "Escada" },
  { value: "cobertura", label: "Cobertura" },
  { value: "porta", label: "Porta" },
  { value: "janela", label: "Janela" },
  { value: "outros", label: "Outros" },
] as const;

export function serviceTypeLabel(value: string): string {
  return SERVICE_TYPES.find((s) => s.value === value)?.label ?? value;
}

export function isServiceType(v: string): boolean {
  return SERVICE_TYPES.some((s) => s.value === v);
}

// Unidade base que dirige o calculo (a "formula" da empresa).
export const BASE_UNITS = [
  { value: "un", label: "unidade" },
  { value: "ml", label: "metro linear (comprimento)" },
  { value: "m2", label: "m² (largura × altura)" },
  { value: "kg", label: "peso (kg)" },
] as const;

export type BaseUnit = (typeof BASE_UNITS)[number]["value"];

export function isBaseUnit(v: string): v is BaseUnit {
  return v === "un" || v === "ml" || v === "m2" || v === "kg";
}

export function baseUnitLabel(v: string): string {
  return BASE_UNITS.find((u) => u.value === v)?.label ?? v;
}

// Unidades dos materiais de referencia.
export const MATERIAL_UNITS = [
  { value: "kg", label: "kg" },
  { value: "ml", label: "metro linear" },
  { value: "m2", label: "m²" },
  { value: "un", label: "unidade" },
] as const;

export function isMaterialUnit(v: string): boolean {
  return MATERIAL_UNITS.some((u) => u.value === v);
}

export function materialUnitLabel(v: string): string {
  return MATERIAL_UNITS.find((u) => u.value === v)?.label ?? v;
}
