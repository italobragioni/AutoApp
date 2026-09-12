// Configuracao declarativa dos nichos.
//
// A regra de ouro da arquitetura: UM nucleo unico + configuracao por nicho.
// Nada de tres codigos paralelos. Cada nicho e descrito por um objeto que diz:
//   - quais unidades de medida fazem sentido;
//   - quais campos (spec) o formulario de item deve pedir;
//   - como calcular a quantidade a partir desses campos;
//   - presets para semear o catalogo no onboarding (etapa futura).
//
// Adicionar um 4o nicho no futuro = adicionar um objeto aqui. O nucleo (schema,
// motor de precificacao, telas de orcamento) nao muda.

export type NicheId = "vidracaria" | "serralheria" | "marcenaria";

export type Unit = "m2" | "ml" | "un" | "kg" | "chapa" | "modulo" | "hora";

export type SpecFieldType = "number" | "text" | "select";

export type SpecField = {
  key: string;
  label: string;
  type: SpecFieldType;
  // Sufixo exibido (ex.: "mm", "m"). Opcional.
  suffix?: string;
  // Opcoes quando type = select.
  options?: { value: string; label: string }[];
  required?: boolean;
};

export type NicheConfig = {
  id: NicheId;
  label: string;
  description: string;
  // Unidades de venda tipicas do nicho (a primeira e o default).
  units: Unit[];
  // Campos especificos capturados por item do orcamento (vao em QuoteItem.spec).
  itemFields: SpecField[];
  /**
   * Deriva a quantidade da unidade de venda a partir dos campos do item.
   * Retorna null quando os campos ainda nao permitem calcular (ex.: sem
   * dimensoes) — nesse caso a quantidade e informada manualmente.
   *
   * Puro e sincrono de proposito: e usado tanto no servidor quanto poderia ser
   * usado no cliente para preview.
   */
  deriveQuantity: (spec: Record<string, unknown>) => number | null;
};

function num(spec: Record<string, unknown>, key: string): number | null {
  const v = spec[key];
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

const vidracaria: NicheConfig = {
  id: "vidracaria",
  label: "Vidracaria",
  description: "Vidros temperados, box, espelhos, guarda-corpos — cobranca por m2.",
  units: ["m2", "un", "ml"],
  itemFields: [
    { key: "largura_mm", label: "Largura", type: "number", suffix: "mm", required: true },
    { key: "altura_mm", label: "Altura", type: "number", suffix: "mm", required: true },
    {
      key: "espessura_mm",
      label: "Espessura",
      type: "select",
      options: [
        { value: "6", label: "6 mm" },
        { value: "8", label: "8 mm" },
        { value: "10", label: "10 mm" },
        { value: "12", label: "12 mm" },
      ],
    },
  ],
  // Area em m2 a partir de largura x altura (mm).
  deriveQuantity: (spec) => {
    const l = num(spec, "largura_mm");
    const a = num(spec, "altura_mm");
    if (l === null || a === null) return null;
    return (l / 1000) * (a / 1000);
  },
};

const serralheria: NicheConfig = {
  id: "serralheria",
  label: "Serralheria",
  description: "Portoes, grades, estruturas metalicas — metro linear, unidade ou peso.",
  units: ["ml", "un", "kg", "m2"],
  itemFields: [
    { key: "comprimento_m", label: "Comprimento", type: "number", suffix: "m" },
    { key: "altura_m", label: "Altura", type: "number", suffix: "m" },
    { key: "perfil", label: "Perfil / material", type: "text" },
  ],
  // Metro linear a partir do comprimento (fallback do nicho).
  deriveQuantity: (spec) => num(spec, "comprimento_m"),
};

const marcenaria: NicheConfig = {
  id: "marcenaria",
  label: "Marcenaria",
  description: "Moveis planejados, armarios, moveis sob medida — modulo, m2 ou unidade.",
  units: ["modulo", "m2", "un", "ml"],
  itemFields: [
    { key: "largura_mm", label: "Largura", type: "number", suffix: "mm" },
    { key: "altura_mm", label: "Altura", type: "number", suffix: "mm" },
    { key: "profundidade_mm", label: "Profundidade", type: "number", suffix: "mm" },
    { key: "material", label: "Material (MDF/MDP...)", type: "text" },
  ],
  // Marcenaria costuma orcar por modulo/unidade; a quantidade e informada.
  deriveQuantity: () => null,
};

const REGISTRY: Record<NicheId, NicheConfig> = {
  vidracaria,
  serralheria,
  marcenaria,
};

export const NICHES: NicheConfig[] = Object.values(REGISTRY);

export function isNiche(value: string): value is NicheId {
  return value === "vidracaria" || value === "serralheria" || value === "marcenaria";
}

export function getNiche(id: string): NicheConfig | null {
  return isNiche(id) ? REGISTRY[id] : null;
}
