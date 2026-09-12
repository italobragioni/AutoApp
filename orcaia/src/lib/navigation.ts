// Itens do menu principal da area logada. Fonte unica para a sidebar e para os
// prefixos protegidos do middleware.
// Os icones sao nomes do lucide-react, resolvidos no componente.

export type NavItem = {
  href: string;
  label: string;
  icon: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/clientes", label: "Clientes", icon: "Users" },
  { href: "/produtos", label: "Produtos e servicos", icon: "Package" },
  { href: "/materiais", label: "Materiais", icon: "Boxes" },
  { href: "/custos", label: "Custos", icon: "Wallet" },
  { href: "/configuracoes", label: "Configuracoes", icon: "Settings" },
];

// Prefixos que exigem sessao. Derivados dos itens de menu.
export const PROTECTED_PREFIXES = NAV_ITEMS.map((i) => i.href);
