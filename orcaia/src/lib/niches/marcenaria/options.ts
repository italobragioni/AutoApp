// Opcoes sugeridas para os formularios do nicho Marcenaria. Sem precos.

export const WOOD_MATERIAL_SUGGESTIONS = [
  "MDF",
  "MDP",
  "Compensado",
  "Madeira maciça",
  "Outros",
];

export const THICKNESS_SUGGESTIONS_MM = [6, 9, 12, 15, 18, 25];

export const FINISH_SUGGESTIONS = ["Cru", "BP", "Melamínico", "Laca", "Pintura", "Outros"];

export const HARDWARE_SUGGESTIONS = [
  "Dobradiças",
  "Corrediças",
  "Puxadores",
  "Pistões",
  "Trilhos",
  "Parafusos",
  "Outros",
];

// Modelos de produto sugeridos (o usuario cria os seus).
export const TEMPLATE_SUGGESTIONS = [
  "Armário planejado",
  "Painel de TV",
  "Guarda-roupa",
  "Gabinete",
  "Rack",
];

// Como a area de material e estimada.
export const AREA_MODES = [
  { value: "caixa", label: "Caixa (superfície: 2×(L×A + L×P + A×P))" },
  { value: "frontal", label: "Frontal (Largura × Altura)" },
] as const;

export type AreaMode = (typeof AREA_MODES)[number]["value"];

export function isAreaMode(v: string): v is AreaMode {
  return v === "caixa" || v === "frontal";
}

export function areaModeLabel(v: string): string {
  return AREA_MODES.find((a) => a.value === v)?.label ?? v;
}
