// Itens do menu principal da area logada. Fonte unica para a sidebar.
// Os icones sao nomes do lucide-react, resolvidos no componente.

export type NavItem = {
  href: string;
  label: string;
  icon: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/clientes", label: "Clientes", icon: "Users" },
  { href: "/catalogo", label: "Catalogo", icon: "Package" },
  { href: "/precos", label: "Precos", icon: "Tags" },
  { href: "/orcamentos", label: "Orcamentos", icon: "FileText" },
  { href: "/configuracoes", label: "Configuracoes", icon: "Settings" },
];
