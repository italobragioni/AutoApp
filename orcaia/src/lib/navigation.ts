// Itens do menu principal da area logada. O menu e sensivel ao nicho: a
// vidracaria tem um modulo proprio (Orcamentos + Vidros); os demais nichos
// mantem o menu generico inalterado.
// Os icones sao nomes do lucide-react, resolvidos no componente.

export type NavItem = {
  href: string;
  label: string;
  icon: string;
};

const DASHBOARD: NavItem = { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" };
const CLIENTES: NavItem = { href: "/clientes", label: "Clientes", icon: "Users" };
const PRODUTOS: NavItem = { href: "/produtos", label: "Produtos e servicos", icon: "Package" };
const MATERIAIS: NavItem = { href: "/materiais", label: "Materiais", icon: "Boxes" };
const CUSTOS: NavItem = { href: "/custos", label: "Custos", icon: "Wallet" };
const ORCAMENTOS: NavItem = { href: "/orcamentos", label: "Orcamentos", icon: "FileText" };
const VIDROS: NavItem = { href: "/vidros", label: "Vidros", icon: "Layers" };
const SERRALHERIA: NavItem = { href: "/serralheria", label: "Materiais e produtos", icon: "Hammer" };
const CONFIG: NavItem = { href: "/configuracoes", label: "Configuracoes", icon: "Settings" };

// Menu generico (marcenaria e demais) — inalterado.
const GENERIC_NAV: NavItem[] = [DASHBOARD, CLIENTES, PRODUTOS, MATERIAIS, CUSTOS, CONFIG];

// Menus dos nichos com modulo proprio.
const VIDRACARIA_NAV: NavItem[] = [DASHBOARD, CLIENTES, ORCAMENTOS, VIDROS, CONFIG];
const SERRALHERIA_NAV: NavItem[] = [DASHBOARD, CLIENTES, ORCAMENTOS, SERRALHERIA, CONFIG];

export function navForNiche(niche: string): NavItem[] {
  if (niche === "vidracaria") return VIDRACARIA_NAV;
  if (niche === "serralheria") return SERRALHERIA_NAV;
  return GENERIC_NAV;
}
