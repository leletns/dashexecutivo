"use client";

import * as React from "react";

interface DropboxStatus {
  configured: boolean;
}

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Sincroniza silenciosamente a planilha financeira mais recente de uma pasta
 * compartilhada do Dropbox com os lançamentos do painel. Não renderiza nada —
 * roda em segundo plano enquanto a página /financeiro estiver aberta, igual
 * ao OneDrive, mas sem nenhum card/botão visível.
 */
export function DropboxSyncPanel() {
  const [configured, setConfigured] = React.useState(false);
  const syncingRef = React.useRef(false);

  const runSync = React.useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      const res = await fetch("/api/sync/dropbox", { method: "POST" });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent("portal:data-updated"));
      }
    } catch {
      // silencioso — tenta novamente no próximo ciclo
    } finally {
      syncingRef.current = false;
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/sync/dropbox", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as DropboxStatus;
        if (!cancelled && json.configured) {
          setConfigured(true);
          runSync();
        }
      } catch {
        // silencioso
      }
    })();
    return () => { cancelled = true; };
  }, [runSync]);

  React.useEffect(() => {
    if (!configured) return;
    const interval = setInterval(runSync, AUTO_SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [configured, runSync]);

  return null;
}
