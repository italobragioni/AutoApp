"use client";

import { useActionState, useMemo, useState } from "react";
import { Zap } from "lucide-react";
import type { FormState } from "@/lib/core/actions";
import { createQuickQuote } from "@/app/actions/quick-quote";
import { formatCents } from "@/lib/core/format";
import { computeGlassItem, type HardwareLine } from "@/lib/niches/vidracaria/pricing";
import { computeSteelItem } from "@/lib/niches/serralheria/pricing";
import { computeWoodItem, type WoodHardwareLine } from "@/lib/niches/marcenaria/pricing";
import { Card, CardTitle } from "@/components/ui/card";
import { SubmitButton, FormError, TextField, SelectField } from "@/components/ui/form";
import { Label } from "@/components/ui/field";

type Customer = { id: string; name: string };
type Glass = { id: string; label: string; pricePerM2Cents: number };
type Finish = { id: string; label: string; unit: "m2" | "ml" | "fixo"; priceCents: number };
type Hw = { id: string; name: string; priceCents: number };
type SteelProduct = {
  id: string; label: string; baseUnit: "un" | "ml" | "m2" | "kg";
  materialCostPerBaseCents: number; laborCostPerBaseCents: number; paintCostPerBaseCents: number; weightPerBaseKg: number;
};
type WoodTemplate = {
  id: string; label: string; areaMode: "frontal" | "caixa";
  materialPriceCents: number; finishPriceCents: number; laborPerM2Cents: number; assemblyPerM2Cents: number;
  hardware: { quantity: number; unitPriceCents: number }[];
  defaultWidthMm: number; defaultHeightMm: number; defaultDepthMm: number;
};
type WoodMat = { id: string; label: string; pricePerM2Cents: number };
type WoodFin = { id: string; label: string; pricePerM2Cents: number };

type Props = {
  niche: string;
  customers: Customer[];
  marginDefault: string;
  glass?: Glass[];
  finishes?: Finish[];
  hardware?: Hw[];
  products?: SteelProduct[];
  templates?: WoodTemplate[];
  woodMaterials?: WoodMat[];
  woodFinishes?: WoodFin[];
};

function toBps(pct: string): number {
  const n = Number(pct.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : 0;
}

export function QuickQuote(props: Props) {
  const [state, formAction] = useActionState<FormState, FormData>(createQuickQuote, {});

  const [customerId, setCustomerId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [margin, setMargin] = useState(props.marginDefault);

  // vidracaria
  const [glassId, setGlassId] = useState("");
  const [finishId, setFinishId] = useState("");
  const [hwQty, setHwQty] = useState<Record<string, string>>({});
  // serralheria
  const [productId, setProductId] = useState("");
  // marcenaria
  const [templateId, setTemplateId] = useState("");
  const [woodMatId, setWoodMatId] = useState("");
  const [woodFinId, setWoodFinId] = useState("");
  // medidas
  const [w, setW] = useState("");
  const [h, setH] = useState("");
  const [d, setD] = useState("");
  const [len, setLen] = useState("");
  const [weight, setWeight] = useState("");

  const qty = Math.max(0, parseInt(quantity || "0", 10) || 0);
  const bps = toBps(margin);
  const numW = Number(w) || 0;
  const numH = Number(h) || 0;
  const numD = Number(d) || 0;
  const numLen = Number(len) || 0;
  const numWeight = Number(weight) || 0;

  // Calculo ao vivo (mesma logica pura do servidor).
  const preview = useMemo(() => {
    if (qty <= 0) return null;
    if (props.niche === "vidracaria") {
      const g = props.glass?.find((x) => x.id === glassId);
      if (!g || !numW || !numH) return null;
      const f = props.finishes?.find((x) => x.id === finishId);
      const hardware: HardwareLine[] = (props.hardware ?? [])
        .map((hw) => ({ name: hw.name, quantity: Number(hwQty[hw.id]) || 0, unitPriceCents: hw.priceCents }))
        .filter((x) => x.quantity > 0);
      const bd = computeGlassItem({
        widthMm: numW, heightMm: numH, quantity: qty, glassPricePerM2Cents: g.pricePerM2Cents,
        finish: f ? { unit: f.unit, priceCents: f.priceCents } : null, hardware,
      });
      return {
        rows: [
          ["Vidro", bd.glassCents],
          ["Acabamento", bd.finishCents],
          ["Ferragens", bd.hardwareCents],
        ] as [string, number][],
        materialsCents: bd.materialsCents,
      };
    }
    if (props.niche === "serralheria") {
      const p = props.products?.find((x) => x.id === productId);
      if (!p) return null;
      const bd = computeSteelItem({
        baseUnit: p.baseUnit, widthMm: numW, heightMm: numH, lengthMm: numLen, weightKg: numWeight, quantity: qty,
        materialCostPerBaseCents: p.materialCostPerBaseCents, laborCostPerBaseCents: p.laborCostPerBaseCents,
        paintCostPerBaseCents: p.paintCostPerBaseCents, weightPerBaseKg: p.weightPerBaseKg,
      });
      if (bd.baseQtyTotal <= 0) return null;
      return {
        rows: [
          ["Material", bd.materialCents],
          ["Mão de obra", bd.laborCents],
          ["Pintura", bd.paintCents],
        ] as [string, number][],
        materialsCents: bd.materialsCents,
      };
    }
    // marcenaria
    const t = props.templates?.find((x) => x.id === templateId);
    if (!t) return null;
    const mat = props.woodMaterials?.find((x) => x.id === woodMatId);
    const fin = props.woodFinishes?.find((x) => x.id === woodFinId);
    const hardware: WoodHardwareLine[] = t.hardware.map((hw) => ({ name: "", quantity: hw.quantity, unitPriceCents: hw.unitPriceCents }));
    const bd = computeWoodItem({
      areaMode: t.areaMode,
      widthMm: numW || t.defaultWidthMm, heightMm: numH || t.defaultHeightMm, depthMm: numD || t.defaultDepthMm,
      quantity: qty,
      materialPricePerM2Cents: mat ? mat.pricePerM2Cents : t.materialPriceCents,
      finishPricePerM2Cents: fin ? fin.pricePerM2Cents : t.finishPriceCents,
      laborPerM2Cents: t.laborPerM2Cents, assemblyPerM2Cents: t.assemblyPerM2Cents, hardware,
    });
    if (bd.areaM2Total <= 0) return null;
    return {
      rows: [
        ["Material", bd.materialCents],
        ["Acabamento", bd.finishCents],
        ["Ferragens", bd.hardwareCents],
        ["Mão de obra + montagem", bd.laborCents + bd.assemblyCents],
      ] as [string, number][],
      materialsCents: bd.materialsCents,
    };
  }, [props, glassId, finishId, hwQty, productId, templateId, woodMatId, woodFinId, numW, numH, numD, numLen, numWeight, qty]);

  const marginCents = preview ? Math.round((preview.materialsCents * bps) / 10000) : 0;
  const totalCents = preview ? preview.materialsCents + marginCents : 0;
  const canGenerate = Boolean(customerId) && preview !== null;

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-2">
      {/* Coluna esquerda: entradas */}
      <div className="space-y-4">
        <Card>
          <CardTitle>1. Cliente</CardTitle>
          <div className="mt-3">
            <SelectField label="Cliente" name="customerId" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
              <option value="" disabled>Selecione...</option>
              {props.customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </SelectField>
          </div>
        </Card>

        <Card>
          <CardTitle>2. Produto e medidas</CardTitle>
          <div className="mt-3 space-y-3">
            {props.niche === "vidracaria" ? (
              <>
                <SelectField label="Vidro" name="glassOptionId" value={glassId} onChange={(e) => setGlassId(e.target.value)} required>
                  <option value="" disabled>Selecione...</option>
                  {(props.glass ?? []).map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                </SelectField>
                <SelectField label="Acabamento (opcional)" name="finishOptionId" value={finishId} onChange={(e) => setFinishId(e.target.value)}>
                  <option value="">Sem acabamento</option>
                  {(props.finishes ?? []).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </SelectField>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField label="Largura (mm)" name="widthMm" type="number" min={1} value={w} onChange={(e) => setW(e.target.value)} required />
                  <TextField label="Altura (mm)" name="heightMm" type="number" min={1} value={h} onChange={(e) => setH(e.target.value)} required />
                </div>
                {(props.hardware ?? []).length > 0 ? (
                  <div>
                    <Label>Ferragens (quantidade)</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(props.hardware ?? []).map((hw) => (
                        <label key={hw.id} className="flex items-center justify-between gap-2 rounded-lg border border-surface-border px-3 py-2 text-sm">
                          <span className="text-ink">{hw.name}</span>
                          <input type="number" name={`hw_${hw.id}`} min={0} value={hwQty[hw.id] ?? ""} placeholder="0"
                            onChange={(e) => setHwQty((m) => ({ ...m, [hw.id]: e.target.value }))}
                            className="w-16 rounded border border-surface-border px-2 py-1 text-right text-sm" />
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {props.niche === "serralheria" ? (
              <>
                <SelectField label="Produto / serviço" name="productId" value={productId} onChange={(e) => setProductId(e.target.value)} required>
                  <option value="" disabled>Selecione...</option>
                  {(props.products ?? []).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </SelectField>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField label="Largura (mm)" name="widthMm" type="number" min={0} value={w} onChange={(e) => setW(e.target.value)} />
                  <TextField label="Altura (mm)" name="heightMm" type="number" min={0} value={h} onChange={(e) => setH(e.target.value)} />
                  <TextField label="Comprimento (mm)" name="lengthMm" type="number" min={0} value={len} onChange={(e) => setLen(e.target.value)} />
                  <TextField label="Peso (kg)" name="weightKg" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
                </div>
              </>
            ) : null}

            {props.niche === "marcenaria" ? (
              <>
                <SelectField label="Modelo" name="templateId" value={templateId} onChange={(e) => setTemplateId(e.target.value)} required>
                  <option value="" disabled>Selecione...</option>
                  {(props.templates ?? []).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </SelectField>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField label="Material (opcional)" name="materialId" value={woodMatId} onChange={(e) => setWoodMatId(e.target.value)}>
                    <option value="">Usar do modelo</option>
                    {(props.woodMaterials ?? []).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </SelectField>
                  <SelectField label="Acabamento (opcional)" name="finishId" value={woodFinId} onChange={(e) => setWoodFinId(e.target.value)}>
                    <option value="">Usar do modelo</option>
                    {(props.woodFinishes ?? []).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </SelectField>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <TextField label="Largura (mm)" name="widthMm" type="number" min={0} value={w} onChange={(e) => setW(e.target.value)} />
                  <TextField label="Altura (mm)" name="heightMm" type="number" min={0} value={h} onChange={(e) => setH(e.target.value)} />
                  <TextField label="Profundidade (mm)" name="depthMm" type="number" min={0} value={d} onChange={(e) => setD(e.target.value)} />
                </div>
              </>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Quantidade" name="quantity" type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
              <TextField label="Margem de lucro (%)" name="marginBps" inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value)} required />
            </div>
          </div>
        </Card>
      </div>

      {/* Coluna direita: composicao ao vivo */}
      <div className="space-y-4">
        <Card>
          <CardTitle>Composição</CardTitle>
          {preview ? (
            <div className="mt-3 space-y-1 text-sm">
              {preview.rows.map(([label, cents]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-ink-soft">{label}</span>
                  <span className="text-ink">{formatCents(cents)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-surface-border pt-1 font-medium">
                <span className="text-ink">Custos</span>
                <span className="text-ink">{formatCents(preview.materialsCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Margem ({margin || 0}%)</span>
                <span className="text-ink">{formatCents(marginCents)}</span>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink-faint">Preencha os campos para ver a composição.</p>
          )}
        </Card>

        <Card className="border-brand/30 bg-brand-muted">
          <CardTitle className="text-ink-faint">Preço final</CardTitle>
          <p className="mt-1 text-3xl font-bold text-brand">{formatCents(totalCents)}</p>
        </Card>

        <FormError message={state?.ok === false ? state.error : undefined} />

        <SubmitButton className="w-full" disabled={!canGenerate}>
          <Zap className="h-4 w-4" /> Gerar orçamento
        </SubmitButton>
        <p className="text-center text-xs text-ink-faint">
          Depois de gerar, você pode ajustar itens, desconto, validade e enviar.
        </p>
      </div>
    </form>
  );
}
