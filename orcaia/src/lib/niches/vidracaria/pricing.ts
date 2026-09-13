// Motor de calculo do orcamento de Vidracaria — puro, sem banco.
//
// Todos os valores monetarios em CENTAVOS. Medidas em MILIMETROS na entrada,
// convertidas para metros no calculo. Margem em PONTOS-BASE (2000 = 20%).

export type FinishInput = {
  unit: "m2" | "ml" | "fixo";
  priceCents: number;
} | null;

export type HardwareLine = {
  name: string;
  quantity: number;
  unitPriceCents: number;
};

export type GlassItemInput = {
  widthMm: number;
  heightMm: number;
  quantity: number; // numero de pecas
  glassPricePerM2Cents: number;
  finish: FinishInput;
  hardware: HardwareLine[];
};

export type GlassItemBreakdown = {
  areaM2PerUnit: number;
  areaM2Total: number;
  perimeterMPerUnit: number;
  perimeterMTotal: number;
  glassCents: number;
  finishCents: number;
  hardwareCents: number;
  materialsCents: number; // glass + finish + hardware
};

function round(n: number): number {
  return Math.round(n);
}

/** Calcula os custos de materiais de uma peca de vidro (com acabamento e ferragens). */
export function computeGlassItem(input: GlassItemInput): GlassItemBreakdown {
  const widthM = Math.max(0, input.widthMm) / 1000;
  const heightM = Math.max(0, input.heightMm) / 1000;
  const qty = Math.max(0, input.quantity);

  const areaM2PerUnit = widthM * heightM;
  const perimeterMPerUnit = 2 * (widthM + heightM);
  const areaM2Total = areaM2PerUnit * qty;
  const perimeterMTotal = perimeterMPerUnit * qty;

  const glassCents = round(areaM2Total * input.glassPricePerM2Cents);

  let finishCents = 0;
  if (input.finish) {
    if (input.finish.unit === "m2") {
      finishCents = round(areaM2Total * input.finish.priceCents);
    } else if (input.finish.unit === "ml") {
      finishCents = round(perimeterMTotal * input.finish.priceCents);
    } else {
      // fixo: valor por peca
      finishCents = round(input.finish.priceCents * qty);
    }
  }

  const hardwareCents = input.hardware.reduce(
    (sum, h) => sum + Math.max(0, h.quantity) * h.unitPriceCents,
    0,
  );

  const materialsCents = glassCents + finishCents + hardwareCents;

  return {
    areaM2PerUnit,
    areaM2Total,
    perimeterMPerUnit,
    perimeterMTotal,
    glassCents,
    finishCents,
    hardwareCents,
    materialsCents,
  };
}

export type QuoteTotals = {
  materialsCents: number; // soma dos materiais de todos os itens
  installationCents: number;
  travelCents: number;
  otherCents: number;
  costsBaseCents: number; // materiais + instalacao + deslocamento + outros
  marginBps: number;
  marginCents: number;
  totalCents: number; // custos + margem
};

/**
 * Consolida os totais do orcamento a partir dos materiais dos itens e dos custos
 * gerais (instalacao/deslocamento/outros), aplicando a margem sobre o total.
 */
export function computeQuoteTotals(params: {
  itemsMaterialsCents: number;
  installationCents: number;
  travelCents: number;
  otherCents: number;
  marginBps: number;
}): QuoteTotals {
  const materialsCents = Math.max(0, params.itemsMaterialsCents);
  const installationCents = Math.max(0, params.installationCents);
  const travelCents = Math.max(0, params.travelCents);
  const otherCents = Math.max(0, params.otherCents);

  const costsBaseCents = materialsCents + installationCents + travelCents + otherCents;
  const marginCents = round((costsBaseCents * params.marginBps) / 10000);
  const totalCents = costsBaseCents + marginCents;

  return {
    materialsCents,
    installationCents,
    travelCents,
    otherCents,
    costsBaseCents,
    marginBps: params.marginBps,
    marginCents,
    totalCents,
  };
}

/** Formata uma area em m2 para exibicao (2 casas). */
export function formatArea(m2: number): string {
  return `${m2.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
}
