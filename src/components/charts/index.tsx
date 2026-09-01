import { cn } from "@/lib/format";

/**
 * Graficos em SVG puro — leves, sem dependencia externa e legiveis no tema
 * escuro. Foco em clareza, nao em efeito.
 */

export type Point = { label: string; value: number };

export function BarChart({
  data,
  format,
  className,
  height = 180,
}: {
  data: Point[];
  format?: (value: number) => string;
  className?: string;
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className={cn("w-full", className)}>
      {/* items-stretch (padrao) e h-full sao necessarios: com items-end a coluna
          se ajusta ao conteudo e a altura percentual da barra nao resolve. */}
      <div className="flex gap-2" style={{ height }}>
        {data.map((point) => {
          const percent = (point.value / max) * 100;
          return (
            <div
              key={point.label}
              className="group flex h-full flex-1 flex-col items-center justify-end gap-2"
            >
              <span className="text-[0.65rem] font-semibold text-soft opacity-0 transition-opacity group-hover:opacity-100">
                {format ? format(point.value) : point.value}
              </span>
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-volt-600/40 to-volt-400 transition-opacity hover:opacity-90"
                style={{ height: `${Math.max(percent, 2)}%` }}
                title={`${point.label}: ${format ? format(point.value) : point.value}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        {data.map((point) => (
          <span key={point.label} className="flex-1 text-center text-[0.65rem] text-muted">
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function LineChart({
  data,
  format,
  height = 200,
}: {
  data: Point[];
  format?: (value: number) => string;
  height?: number;
}) {
  if (data.length === 0) return null;

  const width = 600;
  const padY = 16;
  const max = Math.max(...data.map((d) => d.value), 1);
  const step = data.length > 1 ? width / (data.length - 1) : width;

  const coords = data.map((point, index) => {
    const x = index * step;
    const y = height - padY - (point.value / max) * (height - padY * 2);
    return { ...point, x, y };
  });

  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
        role="img"
        aria-label="Evolução do faturamento"
      >
        <defs>
          <linearGradient id="line-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#12E29B" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#12E29B" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <line
            key={ratio}
            x1="0"
            x2={width}
            y1={height - padY - ratio * (height - padY * 2)}
            y2={height - padY - ratio * (height - padY * 2)}
            stroke="#1E2836"
            strokeWidth="1"
          />
        ))}

        <path d={area} fill="url(#line-fill)" />
        <path d={line} fill="none" stroke="#12E29B" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />

        {coords.map((c) => (
          <circle key={c.label} cx={c.x} cy={c.y} r="3.5" fill="#070A0F" stroke="#12E29B" strokeWidth="2" vectorEffect="non-scaling-stroke">
            <title>{`${c.label}: ${format ? format(c.value) : c.value}`}</title>
          </circle>
        ))}
      </svg>

      <div className="mt-1 flex justify-between">
        {data.map((point) => (
          <span key={point.label} className="text-[0.65rem] text-muted">
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({
  data,
  size = 160,
  centerLabel,
  centerValue,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 140 140" className="size-full -rotate-90" role="img" aria-label="Distribuição">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="#131B26" strokeWidth="16" />
          {total > 0 &&
            data.map((slice) => {
              const length = (slice.value / total) * circumference;
              const dash = `${length} ${circumference - length}`;
              const element = (
                <circle
                  key={slice.label}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth="16"
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                >
                  <title>{`${slice.label}: ${slice.value}`}</title>
                </circle>
              );
              offset += length;
              return element;
            })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-xl font-bold text-white">{centerValue ?? total}</span>
          {centerLabel && <span className="text-[0.65rem] text-muted">{centerLabel}</span>}
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-2.5">
        {data.map((slice) => (
          <li key={slice.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
              <span className="truncate text-soft">{slice.label}</span>
            </span>
            <span className="shrink-0 font-medium text-white">{slice.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
