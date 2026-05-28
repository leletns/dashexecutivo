"use client";

import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Upload,
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
  descricao: string | null;
  conta_caixa: string | null;
  nome_razao_social: string | null;
  forma_pagamento: string | null;
  situacao: string | null;
  valor: number;
  data_vencimento: string | null;
  data_pagamento: string | null;
  plano_primario_contas: string | null;
  classificacao: string | null;
  rec_desp: string | null;
  tratativa: string | null;
  evento: string | null;
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
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<string>("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [search, setSearch] = React.useState("");
  const [searchDebounced, setSearchDebounced] = React.useState("");
  const [situacaoFilter, setSituacaoFilter] = React.useState("");
  const [recDespFilter, setRecDespFilter] = React.useState("");
  const [page, setPage] = React.useState(1);
  const LIMIT = 50;

  const [lancamentos, setLancamentos] = React.useState<LancamentosPage | null>(null);
  const [loadingRows, setLoadingRows] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => { setSearchDebounced(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchStatus = React.useCallback(async () => {
    try {
      const res = await fetch("/api/sync/sheets", { cache: "no-store" });
      if (res.ok) setStatus(await res.json());
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  React.useEffect(() => { fetchStatus(); }, [fetchStatus]);

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

  // ── Upload — lê no browser, envia em lotes de 500 linhas ──────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const isXlsx = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");

    setUploading(true);
    setUploadProgress("Lendo arquivo…");

    try {
      let allRows: string[][];

      if (isXlsx) {
        // XLSX: parseia no browser para evitar limite 4.5MB do Vercel
        setUploadProgress("Processando planilha…");
        const ab = await file.arrayBuffer();
        const XLSX = await import("xlsx");
        const wb = XLSX.read(ab, { type: "array", cellDates: true });
        const sheetName =
          wb.SheetNames.find((n) => n.toLowerCase().includes("personalizado")) ??
          wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        allRows = XLSX.utils.sheet_to_json<string[]>(ws, {
          header: 1,
          defval: "",
          raw: false,
          dateNF: "yyyy-mm-dd",
        }) as string[][];
      } else {
        // CSV: processa no browser para evitar limite de tamanho
        const text = await file.text();
        const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(Boolean);
        const firstLine = lines[0] ?? "";
        const sep = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";
        allRows = lines.map((l) => splitLine(l, sep));
      }

      // detecta cabeçalho
      const keywords = ["cód", "cod", "valor", "situaç", "evento", "classific"];
      let headerIdx = 4;
      for (let i = 0; i < Math.min(10, allRows.length); i++) {
        const rowText = allRows[i].join(" ").toLowerCase();
        if (keywords.filter((k) => rowText.includes(k)).length >= 3) { headerIdx = i; break; }
      }

      const headers = allRows[headerIdx] ?? [];
      const dataRows = allRows.slice(headerIdx + 1);
      const CHUNK = 500;
      const totalChunks = Math.ceil(dataRows.length / CHUNK);
      let logId: string | undefined;

      for (let i = 0; i < totalChunks; i++) {
        const chunk = dataRows.slice(i * CHUNK, (i + 1) * CHUNK);
        setUploadProgress(
          `Importando… ${Math.min((i + 1) * CHUNK, dataRows.length).toLocaleString("pt-BR")} / ${dataRows.length.toLocaleString("pt-BR")} registros`
        );

        const res = await fetch("/api/sync/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            headers,
            rows: chunk,
            is_first_batch: i === 0,
            is_last_batch: i === totalChunks - 1,
            log_id: logId,
            total_rows: dataRows.length,
          }),
        });

        const json = await res.json();
        if (!res.ok) { toast.error(`Erro: ${json.error}`); return; }
        if (i === 0) logId = json.log_id;
      }

      toast.success(`Concluído! ${dataRows.length.toLocaleString("pt-BR")} movimentações atualizadas.`);
      await fetchStatus();
      setPage(1);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao processar arquivo.");
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  };

  function splitLine(line: string, sep: string): string[] {
    const result: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === sep && !inQ) { result.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    result.push(cur.trim());
    return result;
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loadingStatus) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Carregando…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Upload card ─────────────────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold tracking-tight">Atualizar movimentações financeiras</div>
            <div className="text-[12px] text-muted-foreground mt-0.5">
              Envie o arquivo da planilha financeira para atualizar os dados para todos os usuários.
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gap-2"
            >
              <Upload className={cn("h-4 w-4", uploading && "animate-bounce")} />
              {uploading ? "Importando…" : "Enviar arquivo CSV ou XLSX"}
            </Button>
            {uploadProgress && (
              <span className="text-[11px] text-muted-foreground">{uploadProgress}</span>
            )}
          </div>
        </div>

        {/* Status */}
        {status?.last_sync && (
          <div className="mt-4 rounded-xl border border-border/60 bg-foreground/[0.02] dark:bg-white/[0.02] p-3">
            <div className="flex flex-wrap items-center gap-3 text-[12px]">
              {status.last_sync.status === "success" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : status.last_sync.status === "error" ? (
                <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
              )}
              <span className="font-medium">
                {status.last_sync.status === "success"
                  ? "Última importação concluída"
                  : status.last_sync.status === "error"
                    ? "Última importação falhou"
                    : "Importação em andamento…"}
              </span>
              <span className="text-muted-foreground">{formatRelative(status.last_sync.started_at)}</span>
              {status.last_sync.status === "success" && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">
                    {status.last_sync.rows_upserted.toLocaleString("pt-BR")} movimentações
                  </span>
                </>
              )}
              {status.last_sync.error_message && (
                <span className="text-rose-500">{status.last_sync.error_message}</span>
              )}
            </div>
          </div>
        )}

        {status?.total_lancamentos ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatMini
              label="Total de movimentações"
              value={status.total_lancamentos.toLocaleString("pt-BR")}
            />
            <StatMini
              label="Última atualização"
              value={
                status.last_sync?.finished_at
                  ? formatRelative(status.last_sync.finished_at)
                  : "—"
              }
            />
          </div>
        ) : !uploading ? (
          <div className="mt-4 rounded-xl border border-dashed border-border/60 p-6 text-center text-[12px] text-muted-foreground">
            Nenhuma movimentação importada ainda. Clique em <strong>Enviar arquivo</strong> para começar.
          </div>
        ) : null}
      </Card>

      {/* ── Tabela ────────────────────────────────────────────────────────────── */}
      {(status?.total_lancamentos ?? 0) > 0 && (
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

          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="bg-foreground/[0.02] dark:bg-white/[0.02]">
                  {["Cód.", "Descrição", "Nome / Razão Social", "Plano Primário", "Evento", "Situação", "Valor", "Conta"].map((h) => (
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
                      Nenhuma movimentação para os filtros selecionados.
                    </td>
                  </tr>
                )}
                {!loadingRows && lancamentos?.data.map((l) => (
                  <tr key={l.id} className="border-t border-border/50 hover:bg-foreground/[0.015]">
                    <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{l.cod}</td>
                    <td className="px-3 py-2 max-w-[240px]">
                      <div className="text-xs font-medium truncate" title={l.descricao ?? ""}>
                        {l.descricao ?? <span className="text-muted-foreground">—</span>}
                      </div>
                      {l.data_vencimento && (
                        <div className="text-[10px] text-muted-foreground">Venc. {formatDateBR(l.data_vencimento)}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 max-w-[180px]">
                      <div className="text-xs truncate text-muted-foreground" title={l.nome_razao_social ?? ""}>
                        {l.nome_razao_social ?? <span className="opacity-40">—</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 max-w-[160px]">
                      <div className="text-xs truncate text-muted-foreground" title={l.plano_primario_contas ?? ""}>
                        {l.plano_primario_contas ?? <span className="opacity-40">—</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 max-w-[160px]">
                      <div className="text-xs truncate text-muted-foreground" title={l.evento ?? ""}>
                        {l.evento ?? <span className="opacity-40">—</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2"><SituacaoBadge value={l.situacao} /></td>
                    <td className={cn(
                      "px-3 py-2 text-right font-semibold tabular-nums text-sm whitespace-nowrap",
                      l.rec_desp === "Receitas" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    )}>
                      {l.rec_desp === "Receitas" ? "+" : "−"}{formatCurrencyBRL(l.valor)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {l.conta_caixa ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {lancamentos && lancamentos.pages > 1 && (
            <div className="flex items-center justify-between text-[12px] text-muted-foreground">
              <span>
                {((lancamentos.page - 1) * lancamentos.limit + 1).toLocaleString("pt-BR")}–
                {Math.min(lancamentos.page * lancamentos.limit, lancamentos.total).toLocaleString("pt-BR")} de{" "}
                {lancamentos.total.toLocaleString("pt-BR")} movimentações
              </span>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2">Pág. {lancamentos.page} / {lancamentos.pages}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" disabled={page >= lancamentos.pages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
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
    return <Badge variant="warning" className="text-[10px]">{value}</Badge>;
  }
  return <Badge className="text-[10px]">{value}</Badge>;
}
