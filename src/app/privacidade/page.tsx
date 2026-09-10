import type { Metadata } from "next";
import Link from "next/link";

import { LegalSection, LegalShell } from "@/components/marketing/LegalShell";
import { SITE, orPending, whatsappLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description:
    "Política de Privacidade do AUTOVOLT — como tratamos seus dados pessoais conforme a LGPD.",
};

/**
 * Política de Privacidade do AUTOVOLT (LGPD). Página pública (fora do app
 * logado). Os dados do controlador vêm de src/lib/site.ts; onde ainda não
 * foram preenchidos, aparecem como "[a preencher: …]" — nunca inventados.
 */
export default function PrivacidadePage() {
  const wa = whatsappLink();
  const legalName = orPending(SITE.legalName, "razão social");

  return (
    <LegalShell title="Política de Privacidade">
      <p className="text-sm leading-relaxed text-soft">
        Esta Política de Privacidade explica como o {SITE.brand} coleta, usa e protege dados
        pessoais, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 —
        “LGPD”). Ao usar o serviço, você concorda com as práticas descritas aqui.
      </p>

      <LegalSection title="1. Quem é o controlador">
        <p>
          O tratamento dos dados relacionados à sua conta é feito por {legalName}, inscrita no CNPJ{" "}
          {orPending(SITE.cnpj, "CNPJ")}. Para os dados dos seus clientes que você insere no
          sistema, você é o controlador e o {SITE.brand} atua como operador, tratando esses dados
          apenas para prestar o serviço a você.
        </p>
      </LegalSection>

      <LegalSection title="2. Dados que coletamos">
        <p>Coletamos os seguintes tipos de dados:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="text-soft">Dados de cadastro:</strong> nome, e-mail, senha (guardada
            de forma criptografada) e dados da sua empresa.
          </li>
          <li>
            <strong className="text-soft">Dados de pagamento:</strong> processados pelo nosso
            parceiro de pagamentos. Não armazenamos o número completo do seu cartão.
          </li>
          <li>
            <strong className="text-soft">Dados que você insere:</strong> informações de clientes,
            veículos, atendimentos, orçamentos e ordens de serviço.
          </li>
          <li>
            <strong className="text-soft">Dados de uso:</strong> registros técnicos de acesso, como
            data, hora e ações realizadas no sistema, para segurança e funcionamento.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Para que usamos os dados">
        <p>Usamos os dados para:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>criar e manter sua conta e permitir o uso das funcionalidades;</li>
          <li>processar a assinatura e as cobranças;</li>
          <li>prestar suporte e nos comunicarmos com você;</li>
          <li>garantir segurança, prevenir fraudes e cumprir obrigações legais;</li>
          <li>melhorar o serviço a partir do funcionamento agregado do sistema.</li>
        </ul>
        <p>
          As bases legais utilizadas são, principalmente, a execução do contrato, o cumprimento de
          obrigação legal e o legítimo interesse, conforme o caso.
        </p>
      </LegalSection>

      <LegalSection title="4. Mensagens aos seus clientes (WhatsApp)">
        <p>
          O serviço ajuda você a contatar seus próprios clientes, por exemplo por WhatsApp. Esse
          contato parte de você, com dados que você inseriu. Você é responsável por ter uma base
          legal adequada para falar com seus clientes e por respeitar as regras aplicáveis a esse
          tipo de comunicação.
        </p>
      </LegalSection>

      <LegalSection title="5. Compartilhamento de dados">
        <p>
          Não vendemos seus dados. Compartilhamos dados apenas com prestadores que viabilizam o
          serviço — por exemplo, infraestrutura de hospedagem, processamento de pagamentos (Cakto) e
          envio de mensagens — sempre no limite necessário e com deveres de segurança. Também podemos
          compartilhar dados para cumprir a lei ou ordem de autoridade competente.
        </p>
      </LegalSection>

      <LegalSection title="6. Por quanto tempo guardamos">
        <p>
          Mantemos os dados enquanto sua conta existir e pelo tempo necessário para cumprir
          obrigações legais. O cancelamento da assinatura não apaga seus dados imediatamente: eles
          continuam guardados e disponíveis caso você retome o uso. Você pode solicitar a exclusão
          conforme a seção seguinte.
        </p>
      </LegalSection>

      <LegalSection title="7. Seus direitos como titular">
        <p>
          Nos termos da LGPD, você pode solicitar a confirmação da existência de tratamento, o
          acesso, a correção, a portabilidade, a anonimização e a exclusão dos seus dados, além de
          revogar consentimentos. Para exercer esses direitos, fale com o nosso suporte
          {wa ? (
            <>
              {" "}
              pelo{" "}
              <a href={wa} className="focus-ring rounded text-volt-400 hover:text-volt-300">
                WhatsApp
              </a>
            </>
          ) : (
            <> pelo WhatsApp em {orPending(SITE.supportWhatsapp, "WhatsApp de suporte")}</>
          )}
          {SITE.supportEmail ? <> ou pelo e-mail {SITE.supportEmail}</> : null}.
        </p>
      </LegalSection>

      <LegalSection title="8. Segurança">
        <p>
          Adotamos medidas técnicas e organizacionais para proteger os dados, como criptografia de
          senhas, controle de acesso e isolamento dos dados de cada empresa. Nenhum sistema é 100%
          imune, mas trabalhamos continuamente para reduzir riscos.
        </p>
      </LegalSection>

      <LegalSection title="9. Cookies">
        <p>
          Usamos cookies e tecnologias semelhantes essenciais para manter você conectado e para o
          funcionamento do serviço, além de ferramentas de medição que nos ajudam a entender o
          desempenho das nossas páginas. Você pode gerenciar cookies nas configurações do seu
          navegador.
        </p>
      </LegalSection>

      <LegalSection title="10. Alterações desta política">
        <p>
          Podemos atualizar esta política periodicamente. Quando isso acontecer, alteramos a data de
          atualização no topo desta página. Recomendamos revisá-la de tempos em tempos.
        </p>
      </LegalSection>

      <LegalSection title="11. Contato">
        <p>
          Para dúvidas sobre privacidade e proteção de dados, ou para ler os nossos{" "}
          <Link href="/termos" className="focus-ring rounded text-volt-400 hover:text-volt-300">
            Termos de Uso
          </Link>
          , entre em contato com o nosso suporte pelos canais informados no rodapé do site.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
