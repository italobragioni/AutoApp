"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarRange, Download } from "lucide-react";

import { Button } from "@/components/ui";
import { cn } from "@/lib/format";
import { PERIOD_PRESETS, type PeriodKey } from "@/lib/period";

/**
 * Filtro de periodo.
 *
 * Escreve o periodo na URL e deixa o servidor recalcular tudo. Nada e filtrado
 * no navegador: as consultas do relatorio recebem as datas resolvidas a partir
 * destes mesmos parametros (src/lib/reports.ts).
 *
 * A exportacao e um link para a rota que gera o CSV, carregando os mesmos
 * parametros — arquivo e tela olham exatamente o mesmo periodo.
 */
export function PeriodFilter({
  active,
  from,
  to,
}: {
  active: PeriodKey;
  /** "YYYY-MM-DD" do periodo em vigor, para preencher o modo personalizado. */
  from: string;
  to: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [custom, setCustom] = useState({ de: from, ate: to });
  const showCustom = active === "personalizado";

  function apply(key: PeriodKey, dates?: { de: string; ate: string }) {
    const params = new URLSearchParams({ periodo: key });
    if (key === "personalizado") {
      params.set("de", dates?.de ?? custom.de);
      params.set("ate", dates?.ate ?? custom.ate);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const exportHref = (() => {
    const params = new URLSearchParams({ periodo: active });
    if (active === "personalizado") {
      params.set("de", custom.de);
      params.set("ate", custom.ate);
    }
    return `/relatorios/export?${params.toString()}`;
  })();

  return (
    <div className="rounded-2xl border border-line bg-ink-900">
      <div className="flex flex-wrap items-center gap-2 p-4">
        <span className="mr-1 flex items-center gap-1.5 text-xs font-medium text-muted">
          <CalendarRange size={14} />
          Período
        </span>

        {PERIOD_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            data-periodo={preset.key}
            aria-pressed={preset.key === active}
            onClick={() => apply(preset.key)}
            className={cn(
              "focus-ring rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              preset.key === active
                ? "bg-volt-400 text-ink-950"
                : "border border-line bg-ink-850 text-soft hover:border-ink-600 hover:text-white",
            )}
          >
            {preset.label}
          </button>
        ))}

        <a
          href={exportHref}
          data-export-link
          className="focus-ring ml-auto inline-flex h-9 items-center gap-2 rounded-xl bg-ink-800 px-3.5 text-xs font-semibold text-soft ring-1 ring-inset ring-ink-600 transition-colors hover:text-white"
        >
          <Download size={14} />
          Exportar CSV
        </a>
      </div>

      {showCustom && (
        <div className="flex flex-wrap items-end gap-3 border-t border-line p-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-soft">De</span>
            <input
              type="date"
              name="de"
              value={custom.de}
              max={custom.ate}
              onChange={(event) => setCustom((c) => ({ ...c, de: event.target.value }))}
              className="focus-ring rounded-xl border border-ink-600 bg-ink-850 px-3 py-2 text-base text-white sm:text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-soft">Até</span>
            <input
              type="date"
              name="ate"
              value={custom.ate}
              min={custom.de}
              onChange={(event) => setCustom((c) => ({ ...c, ate: event.target.value }))}
              className="focus-ring rounded-xl border border-ink-600 bg-ink-850 px-3 py-2 text-base text-white sm:text-sm"
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            size="md"
            data-aplicar
            onClick={() => apply("personalizado")}
          >
            Aplicar
          </Button>
        </div>
      )}
    </div>
  );
}
