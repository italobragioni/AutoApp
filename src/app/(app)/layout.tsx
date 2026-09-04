import { MobileNav } from "@/components/nav/MobileNav";
import { Sidebar } from "@/components/nav/Sidebar";
import { Topbar } from "@/components/nav/Topbar";
import { VerifyEmailNotice } from "@/components/nav/VerifyEmailNotice";
import { allowedHrefs } from "@/lib/navigation";
import { can } from "@/lib/permissions";
import { getRetention } from "@/lib/retention";
import { requireActiveSubscription } from "@/lib/subscription";
import { requireContext } from "@/lib/tenant";

/**
 * Shell da area logada.
 * Desktop: sidebar fixa a esquerda. Mobile: menu inferior.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const context = await requireContext();
  // O AUTOVOLT e pago: sem assinatura ativa da empresa da sessao, cai para
  // /assinatura antes de qualquer tela operacional carregar. Vale para todos os
  // papeis — o acesso segue a assinatura da empresa, nao a pessoa.
  await requireActiveSubscription(context.company.id);
  const retention = await getRetention(context.company.id);

  // O menu mostra só o que o papel alcança. Esconder aqui é conforto: cada
  // página exige a mesma permissão no servidor.
  const allowed = allowedHrefs((permission) => can(context.role, permission));

  return (
    <div className="min-h-dvh">
      <Sidebar retentionBadge={retention.needsContactCount || undefined} allowed={allowed} />

      <div className="lg:pl-64">
        <Topbar context={context} />
        {/* Informa, mas não bloqueia: o e-mail pendente não impede o uso. */}
        {!context.user.emailVerifiedAt && <VerifyEmailNotice email={context.user.email} />}
        <main className="glow-top mx-auto w-full max-w-[92rem] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">
          {children}
        </main>
      </div>

      <MobileNav allowed={allowed} />
    </div>
  );
}
