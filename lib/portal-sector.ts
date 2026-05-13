export type PortalSector =
  | "executivo"
  | "juridico"
  | "financeiro"
  | "contabil"
  | "marketing"
  | "administrativo"
  | "eventos";

/** Ludymilla enxerga o conjunto completo; demais logins enxergam só o próprio setor. */
export function getPortalSectorFromEmail(
  email: string | null | undefined,
): PortalSector {
  if (!email) return "marketing";
  const e = email.trim().toLowerCase();
  // Diretoria Executiva — Ludymilla Paiva
  if (e === "ludymilla@portal.com") return "executivo";
  // Jurídico
  if (e === "juridico@portal.com" || e === "poliana@portal.com") return "juridico";
  // Financeiro — Miguel Nascimento + Andressa Radnuz
  if (
    e === "financeiro@portal.com" ||
    e === "miguel@portal.com" ||
    e === "andressa@portal.com"
  )
    return "financeiro";
  // Contábil — Delta Contabilidade
  if (e === "contabil@portal.com" || e === "delta@portal.com") return "contabil";
  // Marketing
  if (e === "marketing@portal.com") return "marketing";
  // Administrativo
  if (e === "administrativo@portal.com") return "administrativo";
  // Eventos — Andressa (financeiro), Cristina Ishio
  if (e === "eventos@portal.com" || e === "cristina@portal.com") return "eventos";
  return "marketing";
}

export function sectorShortLabel(sector: PortalSector): string {
  const m: Record<PortalSector, string> = {
    executivo: "Visão executiva",
    juridico: "Jurídico",
    financeiro: "Financeiro",
    contabil: "Contábil",
    marketing: "Marketing",
    administrativo: "Administrativo",
    eventos: "Eventos",
  };
  return m[sector];
}

/** Middleware: só Ludymilla acede a rotas fora do seu setor (além do próprio /dashboard). */
export function isRouteAllowedForSector(pathname: string, sector: PortalSector): boolean {
  if (pathname.startsWith("/api")) return true;

  if (pathname.startsWith("/admin")) {
    return sector === "executivo";
  }

  if (sector === "executivo") return true;

  if (pathname.startsWith("/entrada-dados")) return false;

  if (pathname.startsWith("/dashboard")) return true;

  const rules: [string, PortalSector[]][] = [
    ["/juridico", ["juridico"]],
    ["/financeiro", ["financeiro", "administrativo"]],
    ["/contabil", ["contabil"]],
    ["/marketing", ["marketing"]],
    ["/administrativo", ["administrativo"]],
    ["/eventos", ["eventos", "marketing"]],
  ];

  for (const [prefix, allowed] of rules) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return allowed.includes(sector);
    }
  }

  return true;
}

export function navHrefAllowedForSector(href: string, sector: PortalSector): boolean {
  return isRouteAllowedForSector(href, sector);
}

export type DashboardZone =
  | "macro_executivo"
  | "macro_juridico"
  | "macro_financeiro"
  | "macro_marketing"
  | "macro_admin"
  | "macro_eventos"
  | "bloco_risco_contratos"
  | "bloco_institucional"
  | "bloco_contratos"
  | "bloco_processos"
  | "bloco_certidoes"
  | "bloco_financeiro_narrativa"
  | "bloco_financeiro_eventos"
  | "bloco_congresso"
  | "bloco_nps"
  | "bloco_comercial"
  | "acao_entrada_dados";

const ALL_ZONES: DashboardZone[] = [
  "macro_executivo",
  "macro_juridico",
  "macro_financeiro",
  "macro_marketing",
  "macro_admin",
  "macro_eventos",
  "bloco_risco_contratos",
  "bloco_institucional",
  "bloco_contratos",
  "bloco_processos",
  "bloco_certidoes",
  "bloco_financeiro_narrativa",
  "bloco_financeiro_eventos",
  "bloco_congresso",
  "bloco_nps",
  "bloco_comercial",
  "acao_entrada_dados",
];

const BY_SECTOR: Record<PortalSector, DashboardZone[]> = {
  executivo: ["macro_executivo", "bloco_nps"],
  juridico: [
    "macro_juridico",
    "bloco_risco_contratos",
    "bloco_institucional",
    "bloco_contratos",
    "bloco_processos",
    "bloco_certidoes",
  ],
  financeiro: [
    "macro_financeiro",
    "bloco_financeiro_narrativa",
    "bloco_financeiro_eventos",
    "bloco_institucional",
  ],
  contabil: [
    "macro_financeiro",
    "bloco_financeiro_narrativa",
    "bloco_financeiro_eventos",
    "bloco_institucional",
  ],
  marketing: [
    "macro_marketing",
    "bloco_comercial",
    "bloco_nps",
    "bloco_congresso",
  ],
  administrativo: [
    "macro_admin",
    "bloco_institucional",
    "bloco_certidoes",
    "bloco_financeiro_narrativa",
    "bloco_risco_contratos",
  ],
  eventos: ["macro_eventos", "bloco_congresso", "bloco_financeiro_eventos"],
};

export function dashboardZonesForSector(sector: PortalSector): Set<DashboardZone> {
  return new Set(BY_SECTOR[sector]);
}

export function showZone(sector: PortalSector, zone: DashboardZone): boolean {
  return dashboardZonesForSector(sector).has(zone);
}
