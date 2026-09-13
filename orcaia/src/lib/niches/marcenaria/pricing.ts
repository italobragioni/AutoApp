// Motor de calculo do orcamento de Marcenaria — puro, sem banco.
//
// A area de material e estimada a partir de largura/altura/profundidade (modo
// frontal ou caixa). Os precos vem sempre do catalogo/modelo cadastrado pela
// empresa — nada fixo aqui. Valores em CENTAVOS, medidas em MILIMETROS.

export type WoodHardwareLine = { name: string; quantity: number; unitPriceCents: number };

export type WoodItemInput = {
  areaMode: "frontal" | "caixa";
  widthMm: number;
  heightMm: number;
  depthMm: number;
  quantity: number;
  materialPricePerM2Cents: number;
  finishPricePerM2Cents: number;
  laborPerM2Cents: number;
  assemblyPerM2Cents: number;
  hardware: WoodHardwareLine[];
};

export type WoodItemBreakdown = {
  areaMode: string;
  areaM2PerPiece: number;
  areaM2Total: number;
  materialCents: number;
  finishCents: number;
  laborCents: number;
  assemblyCents: number;
  hardwareCents: number;
  materialsCents: number; // material + acabamento + mao de obra + montagem + ferragens
};

function round(n: number): number {
  return Math.round(n);
}

export function areaPerPieceM2(mode: string, widthMm: number, heightMm: number, depthMm: number): number {
  const w = Math.max(0, widthMm) / 1000;
  const h = Math.max(0, heightMm) / 1000;
  const d = Math.max(0, depthMm) / 1000;
  if (mode === "frontal") return w * h;
  // caixa: superficie das 6 faces
  return 2 * (w * h + w * d + h * d);
}

export function computeWoodItem(input: WoodItemInput): WoodItemBreakdown {
  const qty = Math.max(0, input.quantity);
  const areaM2PerPiece = areaPerPieceM2(input.areaMode, input.widthMm, input.heightMm, input.depthMm);
  const areaM2Total = areaM2PerPiece * qty;

  const materialCents = round(input.materialPricePerM2Cents * areaM2Total);
  const finishCents = round(input.finishPricePerM2Cents * areaM2Total);
  const laborCents = round(input.laborPerM2Cents * areaM2Total);
  const assemblyCents = round(input.assemblyPerM2Cents * areaM2Total);
  const hardwareCents = input.hardware.reduce(
    (sum, h) => sum + Math.max(0, h.quantity) * h.unitPriceCents,
    0,
  );

  const materialsCents = materialCents + finishCents + laborCents + assemblyCents + hardwareCents;

  return {
    areaMode: input.areaMode,
    areaM2PerPiece,
    areaM2Total,
    materialCents,
    finishCents,
    laborCents,
    assemblyCents,
    hardwareCents,
    materialsCents,
  };
}

export type WoodQuoteTotals = {
  materialsCents: number;
  installationCents: number;
  travelCents: number;
  otherCents: number;
  costsBaseCents: number;
  marginBps: number;
  marginCents: number;
  totalCents: number;
};

export function computeWoodQuoteTotals(params: {
  itemsMaterialsCents: number;
  installationCents: number;
  travelCents: number;
  otherCents: number;
  marginBps: number;
}): WoodQuoteTotals {
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

export function formatArea(m2: number): string {
  return `${m2.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
}
