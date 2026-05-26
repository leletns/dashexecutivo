"use client";

/**
 * SheetsSyncPanel — aba "e-Gestor" dentro do módulo Financeiro.
 *
 * Funcionalidades:
 *  - Status da última sincronização
 *  - Botão "Sincronizar agora"
 *  - KPIs calculados dos lançamentos sincronizados
 *  - Tabela paginada e filtrável dos 49 k registros
 */

import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Sheet,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrencyBRL } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SyncStatus {
  configured: boolean;
  last_sync: {
    id: string;
    started_at: string;
    finished_at: string | null;
    status: "running" | "success" | "error";
    rows_read: number;
    rows_upserted: number;
    error_message: string | null;
    triggered_by: string;
  } | null;
  total_lancamentos: number;
}

interface Lancamento {
  id: string;
  cod: string;
  data_competencia: string | null;
  data_pagamento: string | null;
  data_vencimento: string | null;
  nome_razao_social: string | null;
  evento: string | null;
  plano_primario_contas: string | null;
  classificacao: string | null;
  rec_desp: string | null;
  situacao: string | null;
  valor: number;
  conta_caixa: string | null;
}

interface LancamentosPage {
  data: Lancamento[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateBR(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y.slice(2)}`;
}

function formatRelative(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora mesmo";
  if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h atrás`;
  return `${Math.floor(diff / 86400)} dias atrás`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SheetsSyncPanel() {
  const [status, setStatus] = React.useState<SyncStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);

  // Filtros / paginação
  const [search, setSearch] = React.useState("");
  const [searchDebounced, setSearchDebounced] = React.useState("");
  const [situacaoFilter, setSituacaoFilter] = React.useState("");
  const [recDespFilter, setRecDespFilter] = React.useState("");
  const [page, setPage] = React.useState(1);

  const LIMIT = 50;

  // Dados paginados
  const [lancamentos, setLancamentos] = React.useState<LancamentosPage | null>(null);
  const [loadingRows, setLoadingRows] = React.useState(false);

  // ── Debounce search ────────────────────────────────────────────────────────
  React.useEffect(() => {
    const t = setTimeout(() => {
      setSearchDebounced(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // ── Fetch status ──────────────────────────────────────────────────────────
  const fetchStatus = React.useCallback(async () => {
    try {
      const res = await fetch("/api/sync/sheets", { cache: "no-store" });
      if (res.ok) setStatus(await res.json());
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  React.useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ── Fetch lancamentos ──────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!status?.total_lancamentos) return;

    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (searchDebounced) params.set("search", searchDebounced);
    if (situacaoFilter) params.set("situacao", situacaoFilter);
    if (recDespFilter) params.set("rec_desp", recDespFilter);

    setLoadingRows(true);
    fetch(`/api/lancamentos?${params}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setLancamentos(d))
      .finally(() => setLoadingRows(false));
  }, [status?.total_lancamentos, page, searchDebounced, situacaoFilter, recDespFilter]);

  // ── Sync ─────────────────────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync/sheets", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(`Sync falhou: ${json.error}`);
      } else {
        toast.success(
          `Sync concluído! ${json.rows_upserted.toLocaleString("pt-BR")} lançamentos atualizados.`
        );
        await fetchStatus();
        setPage(1);
      }
    } catch {
      toast.error("Erro ao conectar com o servidor.");
    } finally {
      setSyncing(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loadingStatus) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Carregando status…
      </div>
    );
  }

  if (!status) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Não foi possível carregar o status do sync.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Status card ─────────────────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 grid place-items-center shrink-0">
              <Sheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">
                Google Sheets — e-Gestor Sync
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Sincronização automática da planilha <code className="font-mono text-[10px] bg-foreground/[0.06] px-1 rounded">personalizadoFinanceiro (13)</code>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {status.configured ? (
              <Badge variant="success" className="gap-1 text-[11px]">
                <Wifi className="h-3 w-3" /> Configurado
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1 text-[11px]">
                <WifiOff className="h-3 w-3" /> Não configurado
              </Badge>
            )}
            <Button
              size="sm"
              onClick={handleSync}
              disabled={syncing || !status.configured}
              className="gap-1.5"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
              {syncing ? "Sincronizando…" : "Sincronizar agora"}
            </Button>
          </div>
        </div>

        {/* Status da última sync */}
        {status.last_sync && (
          <div className="mt-4 rounded-xl border border-border/60 bg-foreground/[0.02] dark:bg-white/[0.02] p-3">
            <div className="flex flex-wrap items-center gap-3 text-[12px]">
              {status.last_sync.status === "success" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : status.last_sync.status === "error" ? (
                <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              )}
              <span className="font-medium">
                {status.last_sync.status === "success"
                  ? "Último sync concluído"
                  : status.last_sync.status === "error"
                    ? "Último sync falhou"
                    : "Sync em andamento…"}
              </span>
              <span className="text-muted-foreground">
                {formatRelative(status.last_sync.started_at)}
              </span>
              {status.last_sync.status === "success" && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">
                    {status.last_sync.rows_upserted.toLocaleString("pt-BR")} linhas
                  </span>
                </>
              )}
              {status.last_sync.error_message && (
                <span className="text-rose-500">{status.last_sync.error_message}</span>
              )}
            </div>
          </div>
        )}

        {/* Config guide se não configurado */}
        {!status.configured && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-[12px] space-y-2">
            <div className="font-semibold text-amber-600 dark:text-amber-400">
              ⚙️ Como configurar (5 minutos)
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
              <li>Abra a planilha no Google Drive (ou converta via OneDrive → "Abrir com Google Planilhas")</li>
              <li>Acesse <strong>console.cloud.google.com</strong> → crie um projeto → ative "Google Sheets API"</li>
              <li>Crie uma <strong>Conta de Serviço</strong> → gere uma chave JSON → encode em Base64</li>
              <li>Compartilhe a planilha com o e-mail da conta de serviço (somente leitura)</li>
              <li>Adicione na Vercel: <code className="font-mono bg-foreground/[0.08] px-1 rounded">GOOGLE_SERVICE_ACCOUNT_KEY_B64</code> e <code className="font-mono bg-foreground/[0.08] px-1 rounded">GOOGLE_SHEETS_SPREADSHEET_ID</code></li>
            </ol>
          </div>
        )}

        {/* KPI rápida */}
        {status.total_lancamentos > 0 && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatMini
              label="Total de lançamentos"
              value={status.total_lancamentos.toLocaleString("pt-BR")}
            />
            <StatMini
              label="Última sincronização"
              value={
                status.last_sync?.finished_at
                  ? formatRelative(status.last_sync.finished_at)
                  : "—"
              }
            />
            <StatMini
              label="Por"
              value={status.last_sync?.triggered_by ?? "—"}
            />
          </div>
        )}
      </Card>

      {/* ── Tabela de lançamentos ─────────────────────────────────────────────── */}
      {status.total_lancamentos > 0 && (
        <Card className="p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, evento, classificação…"
                className="pl-8"
              />
            </div>

            <select
              className="h-9 rounded-xl border border-border bg-background px-3 text-sm text-foreground"
              value={recDespFilter}
              onChange={(e) => { setRecDespFilter(e.target.value); setPage(1); }}
            >
              <option value="">Receitas + Despesas</option>
              <option value="Receitas">Receitas</option>
              <option value="Despesas">Despesas</option>
            </select>

            <select
              className="h-9 rounded-xl border border-border bg-background px-3 text-sm text-foreground"
              value={situacaoFilter}
              onChange={(e) => { setSituacaoFilter(e.target.value); setPage(1); }}
            >
              <option value="">Todas as situações</option>
              <option value="Recebido">Recebido</option>
              <option value="Pago">Pago</option>
              <option value="A receber">A receber</option>
              <option value="A pagar">A pagar</option>
            </select>
          </div>

          {/* Tabela */}
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="bg-foreground/[0.02] dark:bg-white/[0.02]">
                  {[
                    "Cód.",
                    "Data competência",
                    "Nome / Razão Social",
                    "Evento",
                    "Classificação",
                    "Situação",
                    "Valor",
                    "Conta",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingRows && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-xs text-muted-foreground">
                      <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-1" />
                      Carregando…
                    </td>
                  </tr>
                )}
                {!loadingRows && lancamentos?.data.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-xs text-muted-foreground">
                      Nenhum lançamento encontrado para os filtros selecionados.
                    </td>
                  </tr>
                )}
                {!loadingRows &&
                  lancamentos?.data.map((l) => (
                    <tr key={l.id} className="border-t border-border/50 hover:bg-foreground/[0.015]">
                      <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{l.cod}</td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">
                        {formatDateBR(l.data_competencia)}
                      </td>
                      <td className="px-3 py-2 max-w-[220px]">
                        <div className="text-xs truncate" title={l.nome_razao_social ?? ""}>
                          {l.nome_razao_social ?? "—"}
                        </div>
                      </td>
                      <td className="px-3 py-2 max-w-[180px]">
                        <div className="text-xs truncate text-muted-foreground" title={l.evento ?? ""}>
                          {l.evento ?? <span className="opacity-40">—</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground max-w-[160px] truncate">
                        {l.classificacao ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <SituacaoBadge value={l.situacao} />
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-semibold tabular-nums text-sm",
                          l.rec_desp === "Receitas"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        )}
                      >
                        {l.rec_desp === "Receitas" ? "+" : "−"}
                        {formatCurrencyBRL(l.valor)}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {l.conta_caixa ?? "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {lancamentos && lancamentos.pages > 1 && (
            <div className="flex items-center justify-between text-[12px] text-muted-foreground">
              <span>
                {((lancamentos.page - 1) * lancamentos.limit + 1).toLocaleString("pt-BR")}–
                {Math.min(lancamentos.page * lancamentos.limit, lancamentos.total).toLocaleString("pt-BR")} de{" "}
                {lancamentos.total.toLocaleString("pt-BR")} lançamentos
              </span>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2">
                  Pág. {lancamentos.page} / {lancamentos.pages}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={page >= lancamentos.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Instrução quando não tem dados ainda */}
      {status.configured && status.total_lancamentos === 0 && !status.last_sync && (
        <Card className="p-10 text-center space-y-3">
          <Sheet className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <div className="text-sm font-semibold">Nenhum lançamento sincronizado ainda</div>
          <div className="text-xs text-muted-foreground">
            Clique em <strong>Sincronizar agora</strong> para importar os dados do e-Gestor.
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-foreground/[0.02] dark:bg-white/[0.02] px-3 py-2.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

function SituacaoBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-[11px] text-muted-foreground">—</span>;
  const v = value.toLowerCase();
  if (v === "recebido" || v === "pago") {
    return (
      <Badge variant="success" className="text-[10px] gap-0.5">
        <CheckCircle2 className="h-2.5 w-2.5" /> {value}
      </Badge>
    );
  }
  if (v.includes("receber") || v.includes("pagar")) {
    return (
      <Badge variant="warning" className="text-[10px]">
        {value}
      </Badge>
    );
  }
  return <Badge className="text-[10px]">{value}</Badge>;
}
