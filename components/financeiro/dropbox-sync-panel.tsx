"use client";

import * as React from "react";
import { Cloud, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DropboxStatus {
  configured: boolean;
  last_sync: {
    started_at: string;
    finished_at: string | null;
    status: "running" | "success" | "error";
    rows_upserted: number;
    error_message: string | null;
  } | null;
}

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

function formatRelative(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora mesmo";
  if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h atrás`;
  return `${Math.floor(diff / 86400)} dias atrás`;
}

/**
 * Painel para sincronizar a planilha financeira mais recente de uma pasta do
 * Dropbox com os lançamentos do painel. Alternativa ao OneDrive: usa um
 * access token fixo (variável de ambiente), sem fluxo OAuth por usuário.
 */
export function DropboxSyncPanel() {
  const [status, setStatus] = React.useState<DropboxStatus | null>(null);
  const [syncing, setSyncing] = React.useState(false);

  const fetchStatus = React.useCallback(async () => {
    try {
      const res = await fetch("/api/sync/dropbox", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as DropboxStatus;
      setStatus(json);
    } catch {
      // silencioso — painel é opcional
    }
  }, []);

  React.useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const runSync = React.useCallback(
    async (opts?: { silent?: boolean }) => {
      setSyncing(true);
      try {
        const res = await fetch("/api/sync/dropbox", { method: "POST" });
        const json = await res.json();
        if (!res.ok) {
          if (!opts?.silent) toast.error(json?.error ?? "Falha ao sincronizar.");
          await fetchStatus();
          return;
        }
        if (!opts?.silent) {
          toast.success(
            `Concluído! ${json.rows_upserted.toLocaleString("pt-BR")} movimentações atualizadas de "${json.file_name}".`
          );
        }
        window.dispatchEvent(new CustomEvent("portal:data-updated"));
        await fetchStatus();
      } catch (err: any) {
        if (!opts?.silent) toast.error(err?.message ?? "Falha ao sincronizar.");
      } finally {
        setSyncing(false);
      }
    },
    [fetchStatus]
  );

  // Sincronização automática em segundo plano enquanto a integração estiver
  // configurada — evita depender de clique manual para refletir mudanças na planilha.
  React.useEffect(() => {
    if (!status?.configured) return;
    const interval = setInterval(() => {
      if (!syncing) runSync({ silent: true });
    }, AUTO_SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [status?.configured, syncing, runSync]);

  if (!status?.configured) return null;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Cloud className="h-4 w-4 text-muted-foreground" />
        <div className="text-sm font-semibold tracking-tight">Planilha no Dropbox</div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12px] text-muted-foreground max-w-md">
          Sincroniza automaticamente a planilha mais recente da pasta configurada no Dropbox.
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => runSync()} disabled={syncing}>
          <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
          {syncing ? "Sincronizando…" : "Sincronizar agora"}
        </Button>
      </div>

      {status.last_sync && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {status.last_sync.status === "success" ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : status.last_sync.status === "error" ? (
            <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
          )}
          <span>
            {status.last_sync.status === "success"
              ? `Última sincronização: ${status.last_sync.rows_upserted.toLocaleString("pt-BR")} movimentações`
              : status.last_sync.status === "error"
                ? `Falha na última sincronização: ${status.last_sync.error_message ?? ""}`
                : "Sincronização em andamento…"}
          </span>
          <span>· {formatRelative(status.last_sync.started_at)}</span>
        </div>
      )}
    </Card>
  );
}
