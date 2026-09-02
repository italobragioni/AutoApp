"use client";

import { startTransition, useActionState, type FormEvent } from "react";

/**
 * Liga um formulario a uma Server Action SEM o reset automatico do React 19.
 *
 * O problema que isto resolve:
 *
 *   Passando `action={formAction}` direto para o <form>, o React 19 reseta os
 *   campos do DOM assim que a action retorna. Em campos controlados isso
 *   costuma passar despercebido em <input type="text">, mas quebra <select> e
 *   checkbox: o DOM volta ao valor inicial e, como o estado do React nao mudou,
 *   ele nao repinta — o campo fica visualmente vazio e o proximo envio vai sem
 *   os dados.
 *
 *   Foi o que acontecia no formulario da Agenda: depois do aviso de conflito,
 *   cliente e veiculo apareciam em branco e "salvar mesmo assim" nao salvava.
 *
 * A saida e submeter a action manualmente dentro de uma transicao. O caminho de
 * reset do React nao e acionado e os campos controlados mantem o que o usuario
 * preencheu. `useFormStatus` continua funcionando nos filhos, porque a
 * submissao segue passando pelo <form>.
 */
export function useActionForm<State>(
  action: (state: State, formData: FormData) => Promise<State>,
  initial: State,
) {
  // A assinatura do useActionState usa `Awaited<State>`. Para um generico ainda
  // nao resolvido o TypeScript nao consegue provar que `State` e `Awaited<State>`
  // sao o mesmo tipo, mesmo quando sao — os estados deste projeto sao objetos
  // simples, nunca Promises. O cast fica confinado a estas duas linhas; do lado
  // de fora a tipagem continua exata.
  const [state, formAction, isPending] = useActionState(
    action as unknown as (state: Awaited<State>, formData: FormData) => Promise<Awaited<State>>,
    initial as Awaited<State>,
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return { state: state as State, onSubmit, isPending };
}
