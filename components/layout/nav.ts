import {
  LayoutDashboard,
  Building2,
  Wallet,
  Scale,
  Calculator as CalculatorIcon,
  Megaphone,
  CalendarRange,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { useAppState } from "@/lib/app-state";
import { usePortalSession } from "@/components/layout/portal-sector-context";
import { navHrefAllowedForSector } from "@/lib/portal-sector";

export type NavChild = { href: string; label: string };

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  children?: NavChild[];
};

export const STATIC_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dash executivo", icon: LayoutDashboard },
  {
    href: "/entrada-dados",
    label: "Entrada de dados",
    icon: ClipboardList,
  },
  { href: "/administrativo", label: "Administrativo", icon: Building2 },
  { href: "/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/juridico", label: "Jurídico", icon: Scale },
  { href: "/contabil", label: "Contábil", icon: CalculatorIcon },
  { href: "/marketing", label: "Marketing", icon: Megaphone },
];

export const EVENTOS_NAV: Omit<NavItem, "children"> = {
  href: "/eventos",
  label: "Produção de eventos",
  icon: CalendarRange,
};

export function useNav(): NavItem[] {
  const { state } = useAppState();
  const { sector } = usePortalSession();
  const eventosChildren: NavChild[] = state.edicoes
    .map((e) => ({ href: `/eventos/${e.slug}`, label: e.nome }))
    .filter((c) => navHrefAllowedForSector(c.href, sector));

  const core = STATIC_NAV.filter((item) => navHrefAllowedForSector(item.href, sector));

  if (!navHrefAllowedForSector(EVENTOS_NAV.href, sector)) {
    return core;
  }

  return [...core, { ...EVENTOS_NAV, children: eventosChildren }];
}
