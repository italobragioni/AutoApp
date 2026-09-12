// Motor de precificacao — puro, sem dependencia de banco ou nicho.
//
// Recebe os componentes de custo de uma linha (materiais + mao de obra +
// custos adicionais), a quantidade e a margem, e devolve o preco com o
// detalhamento (breakdown) que sera guardado em QuoteItem.breakdown.
//
// Todos os valores monetarios em CENTAVOS (inteiros). Margem em pontos-base
// (2000 = 20%). O motor e o mesmo para os tres nichos: o que muda entre eles
// sao apenas os INPUTS (ver src/lib/niches).

export type MaterialCost = {
  materialId?: string;
  label: string;
  // Custo unitario do material, em centavos.
  unitCostCents: number;
  // Quantidade consumida por unidade do produto.
  quantityPerUnit: number;
};

export type LaborCost = {
  label: string;
  rateCents: number;
  // Quantidade de mao de obra por unidade do produto (horas, m2 etc.).
  quantityPerUnit: number;
};

export type AdditionalCostInput =
  | { kind: "fixo"; label: string; amountCents: number }
  | { kind: "percentual"; label: string; percentBps: number };

export type PriceItemInput = {
  // Quantidade de unidades vendidas (ex.: 2,5 m2).
  quantity: number;
  materials: MaterialCost[];
  labor: LaborCost[];
  additionalCosts: AdditionalCostInput[];
  // Margem aplicada sobre o custo total (pontos-base).
  marginBps: number;
};

export type PriceBreakdown = {
  quantity: number;
  materialsCents: number;
  laborCents: number;
  additionalCents: number;
  costCents: number; // materiais + mao de obra + custos adicionais
  marginBps: number;
  marginCents: number;
  totalCents: number; // custo + margem
  unitPriceCents: number; // total / quantidade
};

function round(n: number): number {
  return Math.round(n);
}

/**
 * Calcula o preco de uma linha de orcamento e devolve o detalhamento.
 *
 * Ordem: custo de materiais e mao de obra por unidade -> multiplica pela
 * quantidade -> aplica custos adicionais (fixos e percentuais) -> aplica a
 * margem sobre o custo total.
 */
export function computeItemPrice(input: PriceItemInput): PriceBreakdown {
  const quantity = input.quantity > 0 ? input.quantity : 0;

  const materialsPerUnit = input.materials.reduce(
    (sum, m) => sum + m.unitCostCents * m.quantityPerUnit,
    0,
  );
  const laborPerUnit = input.labor.reduce(
    (sum, l) => sum + l.rateCents * l.quantityPerUnit,
    0,
  );

  const materialsCents = round(materialsPerUnit * quantity);
  const laborCents = round(laborPerUnit * quantity);

  const baseCost = materialsCents + laborCents;

  // Custos adicionais: fixos somam direto; percentuais incidem sobre o custo
  // base (materiais + mao de obra).
  const additionalCents = input.additionalCosts.reduce((sum, c) => {
    if (c.kind === "fixo") return sum + c.amountCents;
    return sum + round((baseCost * c.percentBps) / 10000);
  }, 0);

  const costCents = baseCost + additionalCents;
  const marginCents = round((costCents * input.marginBps) / 10000);
  const totalCents = costCents + marginCents;
  const unitPriceCents = quantity > 0 ? round(totalCents / quantity) : totalCents;

  return {
    quantity,
    materialsCents,
    laborCents,
    additionalCents,
    costCents,
    marginBps: input.marginBps,
    marginCents,
    totalCents,
    unitPriceCents,
  };
}

/** Consolida os totais de um orcamento a partir das linhas ja calculadas. */
export function computeQuoteTotals(
  items: { totalCents: number }[],
  discountCents = 0,
): { subtotalCents: number; discountCents: number; totalCents: number } {
  const subtotalCents = items.reduce((sum, i) => sum + i.totalCents, 0);
  const totalCents = Math.max(0, subtotalCents - discountCents);
  return { subtotalCents, discountCents, totalCents };
}
