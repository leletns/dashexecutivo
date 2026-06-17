"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Cloud, CheckCircle2, AlertCircle, RefreshCw, Link2, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface OneDriveStatus {
  configured: boolean;
  connected: boolean;
  account_label: string | null;
  share_url: string | null;
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
 * Painel para conectar e sincronizar uma planilha financeira hospedada no
 * OneDrive (ex.: link "https://1drv.ms/...") com os lançamentos do painel.
 */
export function OneDriveSyncPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = React.useState<OneDriveStatus | null>(null);
  const [shareUrl, setShareUrlInput] = React.useState("");
  const [syncing, setSyncing] = React.useState(false);

  const fetchStatus = React.useCallback(async () => {
    try {
      const res = await fetch("/api/sync/onedrive", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as OneDriveStatus;
      setStatus(json);
      setShareUrlInput((prev) => prev || json.share_url || "");
    } catch {
      // silencioso — painel é opcional
    }
  }, []);

  React.useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Trata o retorno do fluxo OAuth (?onedrive=connected|error)
  React.useEffect(() => {
    const result = searchParams.get("onedrive");
    if (!result) return;
    if (result === "connected") {
      toast.success("Conta Microsoft conectada com sucesso.");
      fetchStatus();
    } else if (result === "error") {
      toast.error(searchParams.get("onedrive_msg") || "Falha ao conectar com a Microsoft.");
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("onedrive");
    url.searchParams.delete("onedrive_msg");
    router.replace(url.pathname + (url.search ? `?${url.searchParams.toString()}` : ""));
  }, [searchParams, router, fetchStatus]);

  const runSync = React.useCallback(
    async (url: string, opts?: { silent?: boolean }) => {
      setSyncing(true);
      try {
        const res = await fetch("/api/sync/onedrive", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ share_url: url }),
        });
        const json = await res.json();
        if (!res.ok) {
          toast.error(json?.error ?? "Falha ao sincronizar.");
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

  const handleSync = () => {
    if (!shareUrl.trim()) {
      toast.error("Cole o link da pasta ou arquivo do OneDrive.");
      return;
    }
    runSync(shareUrl.trim());
  };

  // Sincronização automática em segundo plano enquanto a conta estiver
  // conectada e houver um link salvo — evita depender de clique manual.
  React.useEffect(() => {
    if (!status?.connected || !status.share_url) return;
    const interval = setInterval(() => {
      if (!syncing) runSync(status.share_url!, { silent: true });
    }, AUTO_SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [status?.connected, status?.share_url, syncing, runSync]);

  const handleDisconnect = async () => {
    setSyncing(true);
    try {
      await fetch("/api/sync/onedrive", { method: "DELETE" });
      toast.success("Conta Microsoft desconectada.");
      await fetchStatus();
    } finally {
      setSyncing(false);
    }
  };

  if (!status?.configured) return null;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Cloud className="h-4 w-4 text-muted-foreground" />
        <div className="text-sm font-semibold tracking-tight">Planilha no OneDrive</div>
      </div>

      {!status.connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[12px] text-muted-foreground max-w-md">
            Conecte a conta Microsoft que tem acesso à planilha do OneDrive para sincronizar
            automaticamente os lançamentos com o painel.
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => { window.location.href = "/api/integrations/onedrive/connect"; }}>
            <Link2 className="h-3.5 w-3.5" /> Conectar conta Microsoft
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
            <span className="text-muted-foreground">
              Conectado como <span className="font-medium text-foreground">{status.account_label ?? "conta Microsoft"}</span>
            </span>
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={handleDisconnect} disabled={syncing}>
              <Unplug className="h-3 w-3" /> Desconectar
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={shareUrl}
              onChange={(e) => setShareUrlInput(e.target.value)}
              placeholder="Link da pasta ou arquivo do OneDrive (1drv.ms/...)"
              className="flex-1 min-w-[240px]"
            />
            <Button size="sm" className="gap-1.5" onClick={handleSync} disabled={syncing}>
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
        </div>
      )}
    </Card>
  );
}
