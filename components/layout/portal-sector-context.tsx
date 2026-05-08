"use client";

import * as React from "react";
import type { PortalSector } from "@/lib/portal-sector";

export type PortalSessionBrief = {
  sector: PortalSector;
  email: string;
};

const PortalSectorContext = React.createContext<PortalSessionBrief | null>(null);

export function PortalSectorProvider({
  value,
  children,
}: {
  value: PortalSessionBrief;
  children: React.ReactNode;
}) {
  return (
    <PortalSectorContext.Provider value={value}>{children}</PortalSectorContext.Provider>
  );
}

export function usePortalSession(): PortalSessionBrief {
  const ctx = React.useContext(PortalSectorContext);
  if (!ctx) {
    return { sector: "executivo", email: "" };
  }
  return ctx;
}
