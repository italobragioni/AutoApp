/**
 * Prova social — INTENCIONALMENTE VAZIO.
 *
 * O produto é novo. Não inventamos depoimentos, nomes, número de usuários, notas
 * ou selos: qualquer um desses seria falso. Este componente fica pronto para
 * receber depoimentos REAIS quando você tiver.
 *
 * Como usar depois: preencha o array `DEPOIMENTOS` com falas verdadeiras (com
 * autorização) e remova o `return null`. O modelo abaixo já segue o tema visual.
 */

// type Depoimento = { nome: string; negocio: string; texto: string };
//
// const DEPOIMENTOS: Depoimento[] = [
//   // { nome: "Nome real", negocio: "Estética X — Cidade/UF", texto: "Depoimento real..." },
// ];

export function SocialProof() {
  // Sem depoimentos reais, não renderiza nada.
  return null;

  // Modelo para quando houver depoimentos reais (descomente e ajuste):
  //
  // if (DEPOIMENTOS.length === 0) return null;
  // return (
  //   <section className="border-y border-line bg-ink-900/50">
  //     <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
  //       <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
  //         Quem já usa
  //       </h2>
  //       <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
  //         {DEPOIMENTOS.map((d) => (
  //           <figure key={d.nome} className="surface p-6">
  //             <blockquote className="text-sm leading-relaxed text-soft">“{d.texto}”</blockquote>
  //             <figcaption className="mt-4 text-xs text-muted">
  //               <span className="font-medium text-white">{d.nome}</span> · {d.negocio}
  //             </figcaption>
  //           </figure>
  //         ))}
  //       </div>
  //     </div>
  //   </section>
  // );
}
