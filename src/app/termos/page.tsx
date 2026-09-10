import type { Metadata } from "next";
import Link from "next/link";

import { LegalSection, LegalShell } from "@/components/marketing/LegalShell";
import { SITE, orPending, whatsappLink } from "@/lib/site";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Termos de Uso do AUTOVOLT — condições de uso, assinatura e cancelamento.",
};

/**
 * Termos de Uso do AUTOVOLT. Página pública (fora do app logado). Os dados da
 * empresa vêm de src/lib/site.ts; onde ainda não foram preenchidos, aparecem
 * como "[a preencher: …]" — nunca inventados.
 */
export default function TermosPage() {
  const wa = whatsappLink();
  const legalName = orPending(SITE.legalName, "razão social");

  return (
    <LegalShell title="Termos de Uso">
      <p className="text-sm leading-relaxed text-soft">
        Estes Termos de Uso regulam o acesso e a utilização do {SITE.brand}, um sistema de gestão
        para estética automotiva oferecido por {legalName}, inscrita no CNPJ{" "}
        {orPending(SITE.cnpj, "CNPJ")} (“nós” ou “{SITE.brand}”). Ao criar uma conta e usar o
        serviço, você (“usuário”) concorda com estes termos. Se não concordar, não utilize o
        serviço.
      </p>

      <LegalSection title="1. O que é o serviço">
        <p>
          O {SITE.brand} é um software disponibilizado pela internet (SaaS) para organizar clientes,
          veículos, agenda, orçamentos, ordens de serviço, campanhas de reativação e relatórios de
          uma estética automotiva. O serviço é acessado pelo navegador, no computador ou no celular,
          sem instalação.
        </p>
      </LegalSection>

      <LegalSection title="2. Cadastro e conta">
        <p>
          Para usar o serviço você cria uma conta com dados verdadeiros e atualizados. Você é
          responsável por manter a confidencialidade das suas credenciais e por toda atividade
          realizada na sua conta. Avise-nos imediatamente em caso de uso não autorizado.
        </p>
        <p>
          Você pode cadastrar usuários da sua equipe. Ao fazê-lo, você declara ter autorização para
          inserir os dados dessas pessoas e assume a responsabilidade pelo uso que elas fizerem do
          serviço.
        </p>
      </LegalSection>

      <LegalSection title="3. Assinatura, preço e cobrança">
        <p>
          O acesso ao serviço é por assinatura mensal no valor de {SITE.priceMonthly}, em plano
          único. A assinatura é ativada no momento em que você cria a conta e conclui o pagamento.
        </p>
        <p>
          <strong className="text-soft">Não há período de teste gratuito.</strong> Optamos por um
          preço baixo em vez de um teste grátis. A cobrança é recorrente e se renova
          automaticamente a cada mês, no mesmo meio de pagamento, até que você cancele.
        </p>
        <p>
          O pagamento é processado por parceiro de pagamentos (Cakto) e/ou pelas operadoras de
          cartão. Podemos reajustar o preço mediante aviso prévio; o novo valor passa a valer nas
          renovações seguintes ao aviso.
        </p>
      </LegalSection>

      <LegalSection title="4. Cancelamento">
        <p>
          Não há fidelidade nem multa. Você pode cancelar a assinatura quando quiser. Ao cancelar,
          você mantém o acesso até o fim do período já pago e não será cobrado nas renovações
          seguintes. Não há devolução proporcional de valores de um período já iniciado, salvo
          quando exigido por lei.
        </p>
      </LegalSection>

      <LegalSection title="5. Uso correto do serviço">
        <p>Ao usar o {SITE.brand}, você concorda em não:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>usar o serviço para fins ilícitos ou que violem direitos de terceiros;</li>
          <li>enviar mensagens não solicitadas (spam) ou em desacordo com a legislação aplicável;</li>
          <li>tentar acessar contas, dados ou áreas do sistema sem autorização;</li>
          <li>
            sobrecarregar, copiar, revender ou fazer engenharia reversa do serviço sem nossa
            autorização.
          </li>
        </ul>
        <p>
          Você é o único responsável pelo conteúdo e pelas mensagens que envia aos seus clientes por
          meio das funcionalidades do serviço, inclusive pela obtenção do consentimento necessário.
        </p>
      </LegalSection>

      <LegalSection title="6. Seus dados e os dados dos seus clientes">
        <p>
          Os dados que você insere continuam sendo seus. Nós os tratamos conforme a nossa{" "}
          <Link href="/privacidade" className="focus-ring rounded text-volt-400 hover:text-volt-300">
            Política de Privacidade
          </Link>
          . Em relação aos dados dos seus clientes, você atua como controlador e o {SITE.brand} como
          operador, nos termos da Lei Geral de Proteção de Dados (LGPD).
        </p>
      </LegalSection>

      <LegalSection title="7. Disponibilidade">
        <p>
          Trabalhamos para manter o serviço disponível, mas ele pode passar por manutenções e
          eventuais interrupções. O serviço é fornecido “no estado em que se encontra”, sem garantia
          de operação ininterrupta ou livre de erros.
        </p>
      </LegalSection>

      <LegalSection title="8. Limitação de responsabilidade">
        <p>
          Na máxima extensão permitida pela lei, não nos responsabilizamos por lucros cessantes ou
          danos indiretos decorrentes do uso ou da impossibilidade de uso do serviço. Nossa
          responsabilidade total fica limitada ao valor pago por você nos 12 meses anteriores ao
          evento que originou a reclamação.
        </p>
      </LegalSection>

      <LegalSection title="9. Encerramento">
        <p>
          Podemos suspender ou encerrar o acesso em caso de descumprimento destes termos ou de uso
          que coloque em risco o serviço ou terceiros. Você pode encerrar sua conta a qualquer
          momento cancelando a assinatura.
        </p>
      </LegalSection>

      <LegalSection title="10. Alterações destes termos">
        <p>
          Podemos atualizar estes termos periodicamente. Quando isso acontecer, alteramos a data de
          atualização no topo desta página. O uso continuado do serviço após a alteração significa
          concordância com a nova versão.
        </p>
      </LegalSection>

      <LegalSection title="11. Lei aplicável e contato">
        <p>
          Estes termos são regidos pelas leis do Brasil. Dúvidas sobre estes termos podem ser
          enviadas para o nosso suporte
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
    </LegalShell>
  );
}
