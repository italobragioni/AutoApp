import { requireContext } from "@/lib/core/tenant";
import { getNiche } from "@/lib/niches";
import { navForNiche } from "@/lib/navigation";
import { Sidebar } from "@/components/nav/sidebar";

// Layout da area logada. Resolve o contexto multiempresa uma vez e o entrega a
// sidebar. `requireContext()` ja redireciona para /login se a sessao for
// invalida — nenhuma pagina filha precisa repetir essa checagem para existir,
// mas TODA query de dados nelas deve continuar escopada por ctx.company.id.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireContext();
  const niche = getNiche(ctx.company.niche);

  return (
    <div className="min-h-screen md:flex">
      <Sidebar
        companyName={ctx.company.name}
        nicheLabel={niche?.label ?? ctx.company.niche}
        memberships={ctx.memberships}
        activeCompanyId={ctx.company.id}
        items={navForNiche(ctx.company.niche)}
      />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
