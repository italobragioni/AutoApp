/**
 * Esqueleto de carregamento das páginas.
 *
 * Importante: um `loading.tsx` cria um limite de Suspense e faz o Next enviar a
 * casca da página imediatamente — o que compromete o status HTTP da resposta.
 * Por isso ele NÃO é usado em segmentos que contêm rotas capazes de responder
 * 404 (como /clientes/[id], que precisa devolver 404 de verdade quando o
 * registro não pertence à empresa da sessão).
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
