// Motor de calculo do orcamento de Serralheria — puro, sem banco.
//
// A "formula configurada pela empresa" e a escolha da UNIDADE BASE do produto
// (un | ml | m2 | kg) mais as taxas por unidade base (material, mao de obra,
// pintura). Nenhum preco fixo aqui — tudo vem do produto cadastrado.
//
// Valores em CENTAVOS. Medidas em MILIMETROS na entrada. Peso em kg.

export type SteelItemInput = {
  baseUnit: "un" | "ml" | "m2" | "kg";
  widthMm: number;
  heightMm: number;
  lengthMm: number;
  weightKg: number; // peso informado por peca (usado quando baseUnit = kg)
  quantity: number;
  materialCostPerBaseCents: number;
  laborCostPerBaseCents: number;
  paintCostPerBaseCents: number;
  weightPerBaseKg: number; // peso estimado por unidade base
};

export type SteelItemBreakdown = {
  baseUnit: string;
  baseQtyPerPiece: number;
  baseQtyTotal: number;
  weightKgTotal: number;
  materialCents: number;
  laborCents: number;
  paintCents: number;
  materialsCents: number; // material + mao de obra + pintura (custo do item)
};

function round(n: number): number {
  return Math.round(n);
}

/** Deriva a quantidade base (por peca) a partir da unidade base e das medidas. */
export function baseQtyPerPiece(input: {
  baseUnit: string;
  widthMm: number;
  heightMm: number;
  lengthMm: number;
  weightKg: number;
  weightPerBaseKg: number;
}): number {
  switch (input.baseUnit) {
    case "un":
      return 1;
    case "ml":
      return Math.max(0, input.lengthMm) / 1000;
    case "m2":
      return (Math.max(0, input.widthMm) / 1000) * (Math.max(0, input.heightMm) / 1000);
    case "kg":
      return input.weightKg > 0 ? input.weightKg : Math.max(0, input.weightPerBaseKg);
    default:
      return 0;
  }
}

export function computeSteelItem(input: SteelItemInput): SteelItemBreakdown {
  const qty = Math.max(0, input.quantity);
  const perPiece = baseQtyPerPiece(input);
  const baseQtyTotal = perPiece * qty;

  const materialCents = round(input.materialCostPerBaseCents * baseQtyTotal);
  const laborCents = round(input.laborCostPerBaseCents * baseQtyTotal);
  const paintCents = round(input.paintCostPerBaseCents * baseQtyTotal);
  const materialsCents = materialCents + laborCents + paintCents;

  const weightKgTotal =
    input.baseUnit === "kg" ? baseQtyTotal : input.weightPerBaseKg * baseQtyTotal;

  return {
    baseUnit: input.baseUnit,
    baseQtyPerPiece: perPiece,
    baseQtyTotal,
    weightKgTotal,
    materialCents,
    laborCents,
    paintCents,
    materialsCents,
  };
}

export type SteelQuoteTotals = {
  materialsCents: number;
  installationCents: number;
  travelCents: number;
  otherCents: number;
  costsBaseCents: number;
  marginBps: number;
  marginCents: number;
  totalCents: number;
};

/** Consolida os totais do orcamento (mesma logica: custos + margem). */
export function computeSteelQuoteTotals(params: {
  itemsMaterialsCents: number;
  installationCents: number;
  travelCents: number;
  otherCents: number;
  marginBps: number;
}): SteelQuoteTotals {
  const materialsCents = Math.max(0, params.itemsMaterialsCents);
  const installationCents = Math.max(0, params.installationCents);
  const travelCents = Math.max(0, params.travelCents);
  const otherCents = Math.max(0, params.otherCents);
  const costsBaseCents = materialsCents + installationCents + travelCents + otherCents;
  const marginCents = round((costsBaseCents * params.marginBps) / 10000);
  return {
    materialsCents,
    installationCents,
    travelCents,
    otherCents,
    costsBaseCents,
    marginBps: params.marginBps,
    marginCents,
    totalCents: costsBaseCents + marginCents,
  };
}

export function formatWeight(kg: number): string {
  return `${kg.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
}
