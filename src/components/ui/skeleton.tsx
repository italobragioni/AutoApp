/**
 * Esqueleto de carregamento das páginas.
 *
 * Um `loading.tsx` cria um limite de Suspense no segmento, e isso tem DOIS
 * efeitos colaterais que já causaram bugs reais neste projeto. Por isso ele não
 * é usado em todos os segmentos:
 *
 * 1. Compromete o status HTTP. O Next envia a casca da página antes de a
 *    consulta terminar, então um `notFound()` posterior responde 200 em vez de
 *    404. Por isso segmentos com rotas dinâmicas — /clientes/[id],
 *    /veiculos/[id] — não têm loading.tsx.
 *
 * 2. Quebra a navegação client-side que muda apenas os search params da rota
 *    atual. É o padrão usado para abrir os formulários em modal
 *    (`/servicos?novo=1`, `?editar=<id>`): com loading.tsx no segmento, o
 *    clique no link não aplica o novo parâmetro e o modal nunca abre.
 *    Por isso /servicos também não tem.
 *
 * Ou seja: ao dar camada de escrita a um módulo que usa esse padrão de modal,
 * remova o loading.tsx do segmento.
 */
export function PageSkeleton({ cards = 4, blocks = 1 }: { cards?: number; blocks?: number }) {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="space-y-3">
        <div className="h-3 w-24 animate-pulse rounded bg-ink-800" />
        <div className="h-8 w-56 animate-pulse rounded-xl bg-ink-800" />
        <div className="h-3 w-80 animate-pulse rounded bg-ink-850" />
      </div>

      {cards > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: cards }).map((_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl bg-ink-900" />
          ))}
        </div>
      )}

      {Array.from({ length: blocks }).map((_, index) => (
        <div key={index} className="h-72 animate-pulse rounded-2xl bg-ink-900" />
      ))}
    </div>
  );
}
