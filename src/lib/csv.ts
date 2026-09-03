import "server-only";

import type { Report } from "@/lib/reports";

/**
 * Geracao do CSV de Relatorios.
 *
 * Decisoes de formato, todas por causa do Excel em portugues:
 *
 *   ponto e virgula  — no Brasil o Excel usa a virgula como separador decimal,
 *                      entao um CSV separado por virgula abre tudo em uma
 *                      coluna. `sep=;` na primeira linha remove a duvida.
 *   BOM UTF-8        — sem ele o Excel le o arquivo como Latin-1 e "Higienização"
 *                      chega como "HigienizaÃ§Ã£o".
 *   CRLF             — fim de linha que o Excel espera.
 *   virgula decimal  — valores em reais saem como 1480,50, prontos para somar.
 *
 * O conteudo vem do mesmo `Report` que a tela usa: o arquivo nao tem consulta
 * propria e por isso nao pode divergir do que esta na tela.
 */

const BOM = "﻿";
const SEP = ";";
const EOL = "\r\n";

/**
 * Escapa um campo.
 *
 * Aspas viram aspas dobradas e o campo inteiro e envolvido quando contem
 * separador, aspas ou quebra de linha — a regra do RFC 4180.
 */
function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (text.includes(SEP) || text.includes('"') || /[\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

/** Centavos -> "1480,50". Sem separador de milhar: o Excel cuida disso. */
function money(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** 0,4285 -> "42,9" (por cento, uma casa). */
function percent(rate: number) {
  return (rate * 100).toFixed(1).replace(".", ",");
}

function date(value: Date) {
  return value.toLocaleDateString("pt-BR");
}

function row(...cells: (string | number | null | undefined)[]) {
  return cells.map(cell).join(SEP);
}

/** Nome do arquivo: autovolt-relatorio-<inicio>_a_<fim>.csv */
export function csvFileName(report: Report) {
  const iso = (value: Date) => value.toISOString().slice(0, 10);
  return `autovolt-relatorio-${iso(report.period.from)}_a_${iso(report.period.to)}.csv`;
}

/**
 * O relatorio consolidado, com uma secao por bloco da tela.
 *
 * Uma planilha com secoes (em vez de varios arquivos) mantem o periodo, o
 * comparativo e os detalhamentos no mesmo lugar — e e o formato que quem
 * confere numeros espera receber.
 */
export function reportToCsv(report: Report, companyName: string) {
  const { period, previous, summary, previousSummary } = report;
  const lines: string[] = [];

  // O Excel le esta linha e ja abre o arquivo com as colunas separadas.
  lines.push(`sep=${SEP}`);

  lines.push(row("AUTOVOLT — Relatório"));
  lines.push(row("Empresa", companyName));
  lines.push(row("Período", period.label));
  lines.push(row("De", date(period.from), "Até", date(period.to)));
  lines.push(row("Dias no período", period.days));
  lines.push(row("Comparado com", date(previous.from), "até", date(previous.to)));
  lines.push(row("Gerado em", new Date().toLocaleString("pt-BR")));
  lines.push("");

  lines.push(row("RESUMO"));
  lines.push(row("Indicador", "Período atual", "Período anterior", "Diferença", "Variação %"));

  const linhaComparada = (
    label: string,
    atual: number,
    anterior: number,
    formato: (value: number) => string = String,
  ) => {
    const variacao =
      anterior > 0 ? percent((atual - anterior) / anterior) : atual > 0 ? "—" : "0,0";
    return row(label, formato(atual), formato(anterior), formato(atual - anterior), variacao);
  };

  lines.push(linhaComparada("Faturamento (R$)", summary.revenueCents, previousSummary.revenueCents, money));
  lines.push(linhaComparada("OS concluídas", summary.orders, previousSummary.orders));
  lines.push(
    linhaComparada(
      "Ticket médio (R$)",
      summary.averageTicketCents,
      previousSummary.averageTicketCents,
      money,
    ),
  );
  lines.push(
    linhaComparada("Clientes atendidos", summary.customersServed, previousSummary.customersServed),
  );
  lines.push(linhaComparada("Clientes novos", summary.newCustomers, previousSummary.newCustomers));
  lines.push(
    row(
      "Taxa de recompra (%)",
      percent(summary.repurchaseRate),
      percent(previousSummary.repurchaseRate),
      percent(summary.repurchaseRate - previousSummary.repurchaseRate),
      "",
    ),
  );
  lines.push(
    row(
      "Fórmula da recompra",
      "clientes com mais de uma OS concluída ÷ clientes com ao menos uma OS concluída no período",
    ),
  );
  lines.push("");

  lines.push(row("FATURAMENTO NO PERÍODO"));
  lines.push(row("Intervalo", "Faturamento (R$)"));
  if (report.revenue.length === 0) {
    lines.push(row("Sem ordens concluídas no período", money(0)));
  } else {
    for (const point of report.revenue) lines.push(row(point.label, money(point.value)));
  }
  lines.push("");

  lines.push(row("RANKING DE CLIENTES"));
  lines.push(row("Cliente", "OS concluídas", "Ticket médio (R$)", "Total gerado (R$)"));
  if (report.ranking.length === 0) {
    lines.push(row("Sem clientes atendidos no período"));
  } else {
    for (const customer of report.ranking) {
      lines.push(
        row(
          customer.name,
          customer.orders,
          money(customer.averageTicketCents),
          money(customer.revenueCents),
        ),
      );
    }
  }
  lines.push("");

  lines.push(row("SERVIÇOS"));
  lines.push(row("Serviço", "Quantidade", "Receita (R$)"));
  if (report.services.length === 0) {
    lines.push(row("Sem serviços concluídos no período"));
  } else {
    for (const service of report.services) {
      lines.push(row(service.name, service.count, money(service.revenueCents)));
    }
  }
  lines.push("");

  lines.push(row("FORMAS DE PAGAMENTO"));
  lines.push(row("Forma", "OS", "Valor (R$)", "Participação %"));
  if (report.payments.length === 0) {
    lines.push(row("Sem pagamentos registrados no período"));
  } else {
    const total = report.payments.reduce((sum, item) => sum + item.revenueCents, 0);
    for (const payment of report.payments) {
      lines.push(
        row(
          payment.label,
          payment.orders,
          money(payment.revenueCents),
          total > 0 ? percent(payment.revenueCents / total) : "0,0",
        ),
      );
    }
  }
  lines.push("");

  lines.push(row("ORIGEM DOS CLIENTES NOVOS"));
  lines.push(row("Origem", "Clientes"));
  if (report.origins.length === 0) {
    lines.push(row("Sem clientes cadastrados no período"));
  } else {
    for (const origin of report.origins) lines.push(row(origin.label, origin.value));
  }

  return BOM + lines.join(EOL) + EOL;
}
