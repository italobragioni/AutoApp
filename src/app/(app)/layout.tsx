import { MobileNav } from "@/components/nav/MobileNav";
import { Sidebar } from "@/components/nav/Sidebar";
import { Topbar } from "@/components/nav/Topbar";
import { getRetention } from "@/lib/retention";
import { requireContext } from "@/lib/tenant";

/**
 * Shell da area logada.
 * Desktop: sidebar fixa a esquerda. Mobile: menu inferior.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const context = await requireContext();
  const retention = await getRetention(context.company.id);

  return (
    <div className="min-h-dvh">
      <Sidebar retentionBadge={retention.needsContactCount || undefined} />

      <div className="lg:pl-64">
        <Topbar context={context} />
        <main className="glow-top mx-auto w-full max-w-[92rem] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">
          {children}
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
