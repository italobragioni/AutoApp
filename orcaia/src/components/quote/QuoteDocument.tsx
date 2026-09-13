import { formatCents, formatDate, formatBps } from "@/lib/core/format";
import { formatArea } from "@/lib/niches/vidracaria/pricing";

// Visualizacao profissional do orcamento. Server component puro (sem estado);
// usado tanto na tela de detalhe quanto na pagina de impressao/PDF.

type ItemSpec = {
  widthMm?: number;
  heightMm?: number;
  glass?: { glassType?: string; thicknessMm?: number };
  finish?: { name?: string } | null;
  hardware?: { name: string; quantity: number }[];
};

type ItemBreakdown = {
  areaM2Total?: number;
  glassCents?: number;
  finishCents?: number;
  hardwareCents?: number;
  materialsCents?: number;
};

export type QuoteDocData = {
  number: number;
  status: string;
  createdAt: Date;
  validUntil: Date | null;
  subtotalCents: number;
  installationCents: number;
  travelCents: number;
  otherCents: number;
  discountCents: number;
  marginBps: number;
  totalCents: number;
  notes: string | null;
  deliveryTime: string | null;
  paymentTerms: string | null;
  customer: {
    name: string;
    document: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
  };
  company: {
    name: string;
    document: string | null;
    phone: string | null;
    email: string | null;
    city: string | null;
    state: string | null;
  };
  items: {
    id: string;
    description: string;
    quantity: number;
    spec: unknown;
    breakdown: unknown;
  }[];
};

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  em_negociacao: "Em negociação",
  aprovado: "Aprovado",
  recusado: "Recusado",
  expirado: "Expirado",
  cancelado: "Cancelado",
};

export function QuoteDocument({ quote }: { quote: QuoteDocData }) {
  const costsBase =
    quote.subtotalCents + quote.installationCents + quote.travelCents + quote.otherCents;
  const marginCents = Math.round((costsBase * quote.marginBps) / 10000);

  return (
    <div className="rounded-xl border border-surface-border bg-white p-6 text-ink print:border-0 print:p-0">
      {/* Cabecalho */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-surface-border pb-4">
        <div>
          <h2 className="text-lg font-bold text-brand">{quote.company.name}</h2>
          <div className="mt-1 text-xs text-ink-soft">
            {quote.company.document ? <p>CNPJ: {quote.company.document}</p> : null}
            {quote.company.phone ? <p>Tel: {quote.company.phone}</p> : null}
            {quote.company.email ? <p>{quote.company.email}</p> : null}
            {quote.company.city ? (
              <p>
                {quote.company.city}
                {quote.company.state ? ` - ${quote.company.state}` : ""}
              </p>
            ) : null}
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-ink">ORÇAMENTO Nº {quote.number}</p>
          <p className="text-xs text-ink-soft">Emissão: {formatDate(quote.createdAt)}</p>
          {quote.validUntil ? (
            <p className="text-xs text-ink-soft">Válido até: {formatDate(quote.validUntil)}</p>
          ) : null}
          <span className="mt-1 inline-block rounded bg-brand-muted px-2 py-0.5 text-xs font-medium text-brand">
            {STATUS_LABELS[quote.status] ?? quote.status}
          </span>
        </div>
      </div>

      {/* Cliente */}
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Cliente</p>
        <p className="text-sm font-medium text-ink">{quote.customer.name}</p>
        <div className="text-xs text-ink-soft">
          {quote.customer.document ? <span>{quote.customer.document} · </span> : null}
          {quote.customer.phone ? <span>{quote.customer.phone} · </span> : null}
          {quote.customer.email ? <span>{quote.customer.email}</span> : null}
        </div>
        {quote.customer.address ? (
          <p className="text-xs text-ink-soft">{quote.customer.address}</p>
        ) : null}
      </div>

      {/* Itens */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs">
          <thead className="border-b border-surface-border text-left text-ink-faint">
            <tr>
              <th className="py-2 pr-2 font-medium">Descrição</th>
              <th className="py-2 pr-2 font-medium">Vidro</th>
              <th className="py-2 pr-2 font-medium">Medidas</th>
              <th className="py-2 pr-2 text-center font-medium">Qtd</th>
              <th className="py-2 pr-2 text-right font-medium">Área</th>
              <th className="py-2 pr-2 font-medium">Acabamento</th>
              <th className="py-2 pr-2 font-medium">Ferragens</th>
              <th className="py-2 pl-2 text-right font-medium">Materiais</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((it) => {
              const spec = (it.spec ?? {}) as ItemSpec;
              const b = (it.breakdown ?? {}) as ItemBreakdown;
              const glass = spec.glass
                ? `${spec.glass.glassType ?? ""} ${spec.glass.thicknessMm ?? ""}mm`.trim()
                : "-";
              const medidas =
                spec.widthMm && spec.heightMm ? `${spec.widthMm} x ${spec.heightMm} mm` : "-";
              const hardware =
                spec.hardware && spec.hardware.length > 0
                  ? spec.hardware.map((h) => `${h.quantity}x ${h.name}`).join(", ")
                  : "-";
              return (
                <tr key={it.id} className="border-b border-surface-border align-top">
                  <td className="py-2 pr-2 text-ink">{it.description}</td>
                  <td className="py-2 pr-2 text-ink-soft">{glass}</td>
                  <td className="py-2 pr-2 text-ink-soft">{medidas}</td>
                  <td className="py-2 pr-2 text-center text-ink-soft">{it.quantity}</td>
                  <td className="py-2 pr-2 text-right text-ink-soft">
                    {typeof b.areaM2Total === "number" ? formatArea(b.areaM2Total) : "-"}
                  </td>
                  <td className="py-2 pr-2 text-ink-soft">{spec.finish?.name ?? "-"}</td>
                  <td className="py-2 pr-2 text-ink-soft">{hardware}</td>
                  <td className="py-2 pl-2 text-right text-ink">
                    {formatCents(b.materialsCents ?? 0)}
                  </td>
                </tr>
              );
            })}
            {quote.items.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-6 text-center text-ink-faint">
                  Nenhum item adicionado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Totais */}
      <div className="mt-4 flex flex-wrap justify-between gap-4">
        <div className="text-xs text-ink-soft">
          {quote.deliveryTime ? <p><span className="font-semibold text-ink">Prazo estimado:</span> {quote.deliveryTime}</p> : null}
          {quote.paymentTerms ? <p><span className="font-semibold text-ink">Condições de pagamento:</span> {quote.paymentTerms}</p> : null}
        </div>
        <div className="w-full max-w-xs space-y-1 text-sm">
          <Row label="Materiais" value={formatCents(quote.subtotalCents)} />
          <Row label="Mão de obra" value={formatCents(quote.installationCents)} />
          <Row label="Deslocamento" value={formatCents(quote.travelCents)} />
          <Row label="Outros custos" value={formatCents(quote.otherCents)} />
          <div className="border-t border-surface-border pt-1">
            <Row label="Subtotal" value={formatCents(costsBase)} strong />
          </div>
          <Row label={`Margem (${formatBps(quote.marginBps)})`} value={formatCents(marginCents)} />
          {quote.discountCents > 0 ? (
            <Row label="Desconto" value={`- ${formatCents(quote.discountCents)}`} />
          ) : null}
          <div className="border-t-2 border-ink/20 pt-1">
            <Row label="Preço final" value={formatCents(quote.totalCents)} strong big />
          </div>
        </div>
      </div>

      {quote.notes ? (
        <div className="mt-4 border-t border-surface-border pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Observações</p>
          <p className="text-sm text-ink-soft">{quote.notes}</p>
        </div>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  big,
}: {
  label: string;
  value: string;
  strong?: boolean;
  big?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={strong ? "font-semibold text-ink" : "text-ink-soft"}>{label}</span>
      <span className={`${strong ? "font-semibold text-ink" : "text-ink"} ${big ? "text-lg text-brand" : ""}`}>
        {value}
      </span>
    </div>
  );
}
