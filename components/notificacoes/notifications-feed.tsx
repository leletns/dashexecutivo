"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AuditEvent {
  id: string;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
  sector: string | null;
  action: "criou" | "editou" | "excluiu" | string;
  entity: string;
  entity_id: string | null;
  summary: string | null;
}

const ENTIDADE_LABEL: Record<string, string> = {
  lancamento: "Lançamento",
  contrato: "Contrato",
  processo: "Processo",
  certidao: "Certidão",
  financeiro_resumo: "Resumo financeiro",
  financeiro_evento: "Evento financeiro",
  financeiro_evento_save: "Evento financeiro",
  associados_resumo: "Associados",
  institucional: "Institucional",
  congresso_disponibilidade: "Congresso",
};

const ACAO_COR: Record<string, string> = {
  criou: "text-emerald-600 dark:text-emerald-400",
  editou: "text-blue-600 dark:text-blue-400",
  excluiu: "text-rose-600 dark:text-rose-400",
};

function iniciais(nome: string | null, email: string | null): string {
  const base = (nome || email || "?").trim();
  const partes = base.split(/[\s@.]+/).filter(Boolean);
  return ((partes[0]?.[0] ?? "?") + (partes[1]?.[0] ?? "")).toUpperCase();
}

function tempoRelativo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora mesmo";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return "ontem";
  return `há ${Math.floor(diff / 86400)} dias`;
}

function diaLabel(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  const mesmoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (mesmoDia(d, hoje)) return "Hoje";
  if (mesmoDia(d, ontem)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export function NotificationsFeed() {
  const [eventos, setEventos] = React.useState<AuditEvent[] | null>(null);
  const [filtro, setFiltro] = React.useState<string>("");

  const load = React.useCallback(() => {
    fetch("/api/audit?limit=120", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setEventos(d?.eventos ?? []))
      .catch(() => setEventos([]));
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    window.addEventListener("portal:data-updated", load);
    return () => {
      clearInterval(t);
      window.removeEventListener("portal:data-updated", load);
    };
  }, [load]);

  const usuarios = React.useMemo(() => {
    const set = new Map<string, string>();
    for (const e of eventos ?? []) {
      const key = e.user_email ?? e.user_name ?? "?";
      if (!set.has(key)) set.set(key, e.user_name || e.user_email || "?");
    }
    return Array.from(set.entries());
  }, [eventos]);

  const filtrados = React.useMemo(
    () => (eventos ?? []).filter((e) => !filtro || (e.user_email ?? e.user_name) === filtro),
    [eventos, filtro],
  );

  const grupos = React.useMemo(() => {
    const map = new Map<string, AuditEvent[]>();
    for (const e of filtrados) {
      const k = diaLabel(e.created_at);
      (map.get(k) ?? map.set(k, []).get(k)!).push(e);
    }
    return Array.from(map.entries());
  }, [filtrados]);

  if (eventos === null) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="h-16 animate-pulse bg-muted/40" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {usuarios.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <FiltroChip ativo={filtro === ""} onClick={() => setFiltro("")}>
            Todos
          </FiltroChip>
          {usuarios.map(([key, nome]) => (
            <FiltroChip key={key} ativo={filtro === key} onClick={() => setFiltro(key)}>
              {nome}
            </FiltroChip>
          ))}
        </div>
      )}

      {filtrados.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma alteração registrada ainda. Quando alguém editar um dado, aparece aqui.
        </Card>
      ) : (
        grupos.map(([dia, itens]) => (
          <div key={dia} className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60 px-1">
              {dia}
            </p>
            <Card className="divide-y divide-border/50 overflow-hidden">
              {itens.map((e) => (
                <div key={e.id} className="flex items-start gap-3 p-4">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-500/15 text-[12px] font-semibold text-violet-700 dark:text-violet-300">
                    {iniciais(e.user_name, e.user_email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-foreground">
                      <span className="font-semibold">{e.user_name || e.user_email || "Alguém"}</span>{" "}
                      <span className={cn("font-medium", ACAO_COR[e.action] ?? "text-foreground")}>
                        {e.action}
                      </span>{" "}
                      {ENTIDADE_LABEL[e.entity]?.toLowerCase() ?? e.entity}
                      {e.entity_id && !e.entity_id.startsWith("MANUAL-") && (
                        <span className="text-muted-foreground"> · {e.entity_id}</span>
                      )}
                    </p>
                    {e.summary && (
                      <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{e.summary}</p>
                    )}
                  </div>
                  <time className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
                    {tempoRelativo(e.created_at)}
                  </time>
                </div>
              ))}
            </Card>
          </div>
        ))
      )}
    </div>
  );
}

function FiltroChip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-[12px] font-medium transition-colors",
        ativo
          ? "border-foreground/20 bg-foreground text-background"
          : "border-border/60 bg-background/50 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
