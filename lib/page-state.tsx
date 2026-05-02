"use client";

import * as React from "react";

export type PageState = {
  module: string;
  summary: Array<{ label: string; value: string | number }>;
  raw?: Record<string, unknown>;
};

const DEFAULT: PageState = { module: "Painel executivo", summary: [] };

type Ctx = {
  current: PageState;
  setCurrent: (next: PageState) => void;
};

const PageStateContext = React.createContext<Ctx | null>(null);

export function PageStateProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = React.useState<PageState>(DEFAULT);
  const value = React.useMemo(() => ({ current, setCurrent }), [current]);
  return <PageStateContext.Provider value={value}>{children}</PageStateContext.Provider>;
}

export function usePageState() {
  const ctx = React.useContext(PageStateContext);
  return ctx?.current ?? DEFAULT;
}

/**
 * Registra o estado da página atual para que o chat e o suporte
 * humano consigam ler o módulo e o resumo numérico em foco.
 *
 * Implementação:
 *  - Capturamos um snapshot serializável de `state` em uma ref e o
 *    re-empurramos para o contexto sempre que o snapshot mudar.
 *  - As deps do efeito declaram explicitamente `setCurrent` (estável,
 *    pois vem do React) e o snapshot serializado, sem `eslint-disable`.
 */
export function useRegisterPageState(state: PageState) {
  const ctx = React.useContext(PageStateContext);
  const setCurrent = ctx?.setCurrent;
  const snapshot = JSON.stringify(state);
  const stateRef = React.useRef(state);
  stateRef.current = state;

  React.useEffect(() => {
    if (!setCurrent) return;
    setCurrent(stateRef.current);
    return () => setCurrent(DEFAULT);
  }, [snapshot, setCurrent]);
}
