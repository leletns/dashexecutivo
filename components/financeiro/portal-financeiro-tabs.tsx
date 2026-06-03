"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  CalendarDays,
  ChevronDown,
  Landmark,
  PencilLine,
  Plus,
  Save,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { usePortalSession } from "@/components/layout/portal-sector-context";
import { cn, formatCurrencyBRL } from "@/lib/utils";
import { currentMonthBrasilia } from "@/lib/timezone";
import {
  DEPARTAMENTOS,
  EMPTY_SNAPSHOT,
  MESES_2026,
  PERIODO_HISTORICO,
  TIPO_CONTA_LABEL,
  type AssociadoHistorico,
  type AssociadoMensal,
  type ContaBancaria,
  type CustoDepartamento,
  type EventoResultado,
  type PortalFinanceiroSnapshot,
  type PrevisaoMensal,
} from "@/lib/portal-financeiro/types";

// ─── Data fetching ────────────────────────────────────────────────────────────

function usePortalFinanceiro(mes: string) {
  const [data, setData] = React.useState<PortalFinanceiroSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = React.useState(true);

  const reload = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/financeiro?mes=${encodeURIComponent(mes)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const json = (await res.json()) as PortalFinanceiroSnapshot;
      setData(json);
    } catch {
      /* mantém vazio */
    } finally {
      setLoading(false);
    }
  }, [mes]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, reload };
}

async function mutate(
  table: string,
  action: "upsert" | "delete",
  payload: Record<string, unknown>,
) {
  const res = await fetch("/api/portal/financeiro", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ table, action, payload }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? "Erro ao salvar.");
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("portal:data-updated"));
  }
  return res.json();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowMes(): string {
  return currentMonthBrasilia();
}

function cryptoId(): string {
  return typeof crypto !== "undefined"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

// ─── Tab navigation ───────────────────────────────────────────────────────────

const TABS = [
  { id: "contas", label: "Contas" },
  { id: "previsao", label: "Previsão" },
  { id: "eventos", label: "Eventos" },
  { id: "associados", label: "Associados" },
  { id: "departamentos", label: "Departamentos" },
  { id: "analise", label: "Análise" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ─── Main component ───────────────────────────────────────────────────────────

export function PortalFinanceiroTabs() {
  const { sector } = usePortalSession();
  const canEdit = sector === "financeiro" || sector === "executivo";
  const [activeTab, setActiveTab] = React.useState<TabId>("contas");
  const [mes, setMes] = React.useState(nowMes());
  const { data, loading, reload } = usePortalFinanceiro(mes);

  // Lancamentos data from e-Gestor for Análise tab fallback calculations
  const [lancData, setLancData] = React.useState<{
    totais: LancTotaisAnalise | null;
    fluxo_mensal: FluxoMesAnalise[];
  }>({ totais: null, fluxo_mensal: [] });

  React.useEffect(() => {
    const load = () => {
      fetch("/api/lancamentos/fluxo", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: any) => {
          if (!d) return;
          setLancData({ totais: d.totais ?? null, fluxo_mensal: d.fluxo_mensal ?? [] });
        })
        .catch(() => {});
    };
    load();
    window.addEventListener("portal:data-updated", load);
    return () => window.removeEventListener("portal:data-updated", load);
  }, []);

  const mesOptions = React.useMemo(() => {
    const options = [];
    for (let m = 1; m <= 12; m++) {
      const label = MESES_2026.find((x) => x.mes === m)?.label ?? "";
      options.push({ value: `2026-${String(m).padStart(2, "0")}`, label: `${label} 2026` });
    }
    return options;
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
            Dados estruturados
          </p>
          <h2 className="text-sm font-semibold tracking-tight">Portal Financeiro</h2>
        </div>
        <div className="ml-auto">
          <Select
            value={mes}
            onValueChange={(v) => setMes(v)}
            options={mesOptions}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* Tab bar — layoutId for sliding indicator */}
      <div className="relative border-b border-border/50">
        <div className="flex gap-0 overflow-x-auto scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative px-4 py-2.5 text-[12px] font-medium whitespace-nowrap transition-colors duration-150",
                activeTab === tab.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground/70",
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="fin-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground rounded-t-full"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, filter: "blur(4px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, filter: "blur(4px)" }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {loading ? (
            <LoadingState />
          ) : activeTab === "contas" ? (
            <ContasTab data={data.contas_bancarias} canEdit={canEdit} mes={mes} onSave={reload} />
          ) : activeTab === "previsao" ? (
            <PrevisaoTab data={data.previsao_mensal} canEdit={canEdit} mes={mes} onSave={reload} />
          ) : activeTab === "eventos" ? (
            <EventosTab data={data.eventos_resultado} canEdit={canEdit} mes={mes} onSave={reload} />
          ) : activeTab === "associados" ? (
            <AssociadosTab
              historico={data.associados_historico}
              mensal={data.associados_mensal}
              canEdit={canEdit}
              onSave={reload}
            />
          ) : activeTab === "departamentos" ? (
            <DepartamentosTab
              data={data.custos_departamento}
              canEdit={canEdit}
              mes={mes}
              onSave={reload}
            />
          ) : (
            <AnaliseTab
              data={data}
              canEdit={canEdit}
              lancTotais={lancData.totais}
              fluxoMensal={lancData.fluxo_mensal}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-12 rounded-xl bg-muted/40 animate-pulse" />
      ))}
    </div>
  );
}

// ─── Contas bancárias ─────────────────────────────────────────────────────────

function ContasTab({
  data,
  canEdit,
  mes,
  onSave,
}: {
  data: ContaBancaria[];
  canEdit: boolean;
  mes: string;
  onSave: () => void;
}) {
  const [adding, setAdding] = React.useState(false);
  const [form, setForm] = React.useState<Partial<ContaBancaria>>({
    tipo: "corrente",
    data_saldo: currentMonthBrasilia() + "-01",
  });

  const totalSaldo = data.reduce((s, c) => s + c.saldo, 0);

  const handleSave = async () => {
    if (!form.nome || form.saldo === undefined || !form.data_saldo) {
      toast.error("Preencha nome, saldo e data.");
      return;
    }
    try {
      await mutate("portal_contas_bancarias", "upsert", { ...form, id: form.id ?? cryptoId() });
      toast.success("Conta salva.");
      setAdding(false);
      setForm({ tipo: "corrente", data_saldo: currentMonthBrasilia() + "-01" });
      onSave();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await mutate("portal_contas_bancarias", "delete", { id });
      toast.success("Conta removida.");
      onSave();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-3">
      <TableCard>
        <thead>
          <tr>
            <Th>Conta</Th>
            <Th>Banco</Th>
            <Th>Tipo</Th>
            <Th>Data</Th>
            <Th right>Saldo</Th>
            {canEdit && <Th right>Ação</Th>}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && (
            <tr>
              <td colSpan={canEdit ? 6 : 5} className="px-4 py-8 text-center text-xs text-muted-foreground">
                Nenhuma conta cadastrada.
              </td>
            </tr>
          )}
          {data.map((c) => (
            <tr key={c.id} className="border-t border-border/40">
              <Td>{c.nome}</Td>
              <Td>{c.banco || "—"}</Td>
              <Td>{TIPO_CONTA_LABEL[c.tipo]}</Td>
              <Td>{new Date(c.data_saldo + "T12:00:00").toLocaleDateString("pt-BR")}</Td>
              <Td right className={c.saldo < 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}>
                {formatCurrencyBRL(c.saldo)}
              </Td>
              {canEdit && (
                <td className="px-4 py-2.5 text-right">
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="p-1 text-muted-foreground/50 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              )}
            </tr>
          ))}
          {data.length > 0 && (
            <tr className="border-t-2 border-border bg-muted/20">
              <td colSpan={4} className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">
                Total
              </td>
              <td
                className={cn(
                  "px-4 py-2.5 text-right text-xs font-semibold tabular-nums",
                  totalSaldo < 0 ? "text-red-600 dark:text-red-400" : "text-foreground",
                )}
              >
                {formatCurrencyBRL(totalSaldo)}
              </td>
              {canEdit && <td />}
            </tr>
          )}
        </tbody>
      </TableCard>

      {canEdit && (
        adding ? (
          <Card className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Input
                placeholder="Nome da conta"
                value={form.nome ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                className="text-sm"
              />
              <Input
                placeholder="Banco (ex: Itaú)"
                value={form.banco ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, banco: e.target.value }))}
                className="text-sm"
              />
              <Select
                value={form.tipo ?? "corrente"}
                onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as ContaBancaria["tipo"] }))}
                options={[
                  { value: "corrente", label: "Corrente" },
                  { value: "poupanca", label: "Poupança" },
                  { value: "investimento", label: "Investimento" },
                  { value: "outros", label: "Outros" },
                ]}
                className="text-sm"
              />
              <Input
                type="number"
                placeholder="Saldo (R$)"
                value={form.saldo ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, saldo: Number(e.target.value) }))}
                className="text-sm"
              />
              <Input
                type="date"
                value={form.data_saldo ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, data_saldo: e.target.value }))}
                className="text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}>
                <Save className="h-3.5 w-3.5 mr-1.5" /> Salvar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </Card>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar conta
          </Button>
        )
      )}
    </div>
  );
}

// ─── Previsão mensal ──────────────────────────────────────────────────────────

function PrevisaoTab({
  data,
  canEdit,
  mes,
  onSave,
}: {
  data: PrevisaoMensal | null;
  canEdit: boolean;
  mes: string;
  onSave: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState<Partial<PrevisaoMensal>>(data ?? {});

  React.useEffect(() => {
    setForm(data ?? {});
  }, [data]);

  const resultado = (form.total_entradas_previstas ?? 0) - (form.total_despesas_previstas ?? 0);

  const handleSave = async () => {
    try {
      await mutate("portal_previsao_mensal", "upsert", {
        ...form,
        referencia_mes: mes,
        id: form.id ?? cryptoId(),
      });
      toast.success("Previsão salva.");
      setEditing(false);
      onSave();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-3 max-w-lg">
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Previsão — {mes}</h3>
          {canEdit && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <PencilLine className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="grid gap-3">
          <Field label="Entradas previstas">
            {editing ? (
              <Input
                type="number"
                value={form.total_entradas_previstas ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, total_entradas_previstas: Number(e.target.value) }))
                }
                className="text-sm"
              />
            ) : (
              <ValueLine
                value={data?.total_entradas_previstas ?? 0}
                color="text-emerald-600 dark:text-emerald-400"
              />
            )}
          </Field>

          <Field label="Despesas previstas">
            {editing ? (
              <Input
                type="number"
                value={form.total_despesas_previstas ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, total_despesas_previstas: Number(e.target.value) }))
                }
                className="text-sm"
              />
            ) : (
              <ValueLine
                value={data?.total_despesas_previstas ?? 0}
                color="text-red-600 dark:text-red-400"
              />
            )}
          </Field>

          <div className="border-t border-border/40 pt-3">
            <Field label="Resultado previsto">
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  resultado >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400",
                )}
              >
                {formatCurrencyBRL(editing ? resultado : (data?.total_entradas_previstas ?? 0) - (data?.total_despesas_previstas ?? 0))}
              </span>
            </Field>
          </div>

          {(editing || data?.notas) && (
            <Field label="Notas">
              {editing ? (
                <Input
                  placeholder="Observações..."
                  value={form.notas ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                  className="text-sm"
                />
              ) : (
                <span className="text-xs text-muted-foreground">{data?.notas}</span>
              )}
            </Field>
          )}
        </div>

        {editing && (
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={handleSave}>
              <Save className="h-3.5 w-3.5 mr-1.5" /> Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Resultado por evento ─────────────────────────────────────────────────────

function EventosTab({
  data,
  canEdit,
  mes,
  onSave,
}: {
  data: EventoResultado[];
  canEdit: boolean;
  mes: string;
  onSave: () => void;
}) {
  const [adding, setAdding] = React.useState(false);
  const [form, setForm] = React.useState<Partial<EventoResultado>>({});

  const handleSave = async () => {
    if (!form.nome_evento) {
      toast.error("Informe o nome do evento.");
      return;
    }
    try {
      await mutate("portal_evento_resultado", "upsert", {
        ...form,
        referencia_mes: mes,
        id: form.id ?? cryptoId(),
        receita_bilheteria: form.receita_bilheteria ?? 0,
        receita_patrocinio: form.receita_patrocinio ?? 0,
        receita_outros: form.receita_outros ?? 0,
        despesas_total: form.despesas_total ?? 0,
      });
      toast.success("Evento salvo.");
      setAdding(false);
      setForm({});
      onSave();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-3">
      <TableCard>
        <thead>
          <tr>
            <Th>Evento</Th>
            <Th right>Bilheteria</Th>
            <Th right>Patrocínio</Th>
            <Th right>Outros</Th>
            <Th right>Despesas</Th>
            <Th right>Resultado</Th>
            {canEdit && <Th right>Ação</Th>}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && (
            <tr>
              <td colSpan={canEdit ? 7 : 6} className="px-4 py-8 text-center text-xs text-muted-foreground">
                Nenhum evento neste mês.
              </td>
            </tr>
          )}
          {data.map((ev) => {
            const resultado = ev.receita_bilheteria + ev.receita_patrocinio + ev.receita_outros - ev.despesas_total;
            return (
              <tr key={ev.id} className="border-t border-border/40">
                <Td>{ev.nome_evento}</Td>
                <Td right>{formatCurrencyBRL(ev.receita_bilheteria)}</Td>
                <Td right>{formatCurrencyBRL(ev.receita_patrocinio)}</Td>
                <Td right>{formatCurrencyBRL(ev.receita_outros)}</Td>
                <Td right className="text-red-600 dark:text-red-400">{formatCurrencyBRL(ev.despesas_total)}</Td>
                <Td right className={resultado >= 0 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-red-600 dark:text-red-400 font-semibold"}>
                  {formatCurrencyBRL(resultado)}
                </Td>
                {canEdit && (
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={async () => {
                        await mutate("portal_evento_resultado", "delete", { id: ev.id });
                        onSave();
                      }}
                      className="p-1 text-muted-foreground/50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </TableCard>

      {canEdit && (
        adding ? (
          <Card className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Input placeholder="Nome do evento" value={form.nome_evento ?? ""} onChange={(e) => setForm((f) => ({ ...f, nome_evento: e.target.value }))} className="text-sm sm:col-span-3" />
              {(["receita_bilheteria", "receita_patrocinio", "receita_outros", "despesas_total"] as const).map((field) => (
                <Input
                  key={field}
                  type="number"
                  placeholder={{ receita_bilheteria: "Bilheteria (R$)", receita_patrocinio: "Patrocínio (R$)", receita_outros: "Outros (R$)", despesas_total: "Despesas (R$)" }[field]}
                  value={form[field] ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: Number(e.target.value) }))}
                  className="text-sm"
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}><Save className="h-3.5 w-3.5 mr-1.5" /> Salvar</Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}><X className="h-3.5 w-3.5" /></Button>
            </div>
          </Card>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar evento
          </Button>
        )
      )}
    </div>
  );
}

// ─── Associados ───────────────────────────────────────────────────────────────

function AssociadosTab({
  historico,
  mensal,
  canEdit,
  onSave,
}: {
  historico: AssociadoHistorico[];
  mensal: AssociadoMensal[];
  canEdit: boolean;
  onSave: () => void;
}) {
  const historicoByLabel = Object.fromEntries(historico.map((h) => [h.periodo_label, h]));
  const mensalByKey = Object.fromEntries(mensal.map((m) => [`${m.ano}-${m.mes}`, m]));

  const handleHistoricoSave = async (periodo: (typeof PERIODO_HISTORICO)[number], valor: number) => {
    try {
      await mutate("portal_associados_historico", "upsert", {
        id: historicoByLabel[periodo.label]?.id ?? cryptoId(),
        periodo_label: periodo.label,
        ano: periodo.ano,
        mes: periodo.mes,
        total_ativos: valor,
      });
      toast.success(`${periodo.label} salvo.`);
      onSave();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleMensalSave = async (mes: number, field: keyof AssociadoMensal, valor: number) => {
    const key = `2026-${mes}`;
    const existing = mensalByKey[key];
    try {
      await mutate("portal_associados_mensal", "upsert", {
        id: existing?.id ?? cryptoId(),
        ano: 2026,
        mes,
        total_inicio_mes: existing?.total_inicio_mes ?? 0,
        previsao_renovacoes: existing?.previsao_renovacoes ?? 0,
        renovacoes_realizadas: existing?.renovacoes_realizadas ?? 0,
        novas_adesoes: existing?.novas_adesoes ?? 0,
        saidas: existing?.saidas ?? 0,
        [field]: valor,
      });
      onSave();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Histórico anual */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-3">
          Histórico — final de agosto
        </h3>
        <TableCard>
          <thead>
            <tr>
              <Th>Período</Th>
              <Th right>Associados ativos</Th>
            </tr>
          </thead>
          <tbody>
            {PERIODO_HISTORICO.map((p) => {
              const existing = historicoByLabel[p.label];
              return (
                <tr key={p.label} className="border-t border-border/40">
                  <Td>{p.label}</Td>
                  <td className="px-4 py-2.5 text-right">
                    <InlineIntInput
                      value={existing?.total_ativos ?? 0}
                      canEdit={canEdit}
                      onSave={(v) => handleHistoricoSave(p, v)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableCard>
      </div>

      {/* 2026 mês a mês */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-3">
          2026 — acompanhamento mensal
        </h3>
        <div className="overflow-x-auto rounded-xl border border-border/50">
          <table className="w-full text-xs min-w-[700px]">
            <thead>
              <tr className="bg-muted/30">
                <Th>Mês</Th>
                <Th right>Total início</Th>
                <Th right>Previsão renovação</Th>
                <Th right>Renovações realizadas</Th>
                <Th right>Novas adesões</Th>
                <Th right>Saídas</Th>
              </tr>
            </thead>
            <tbody>
              {MESES_2026.map(({ mes, label }) => {
                const key = `2026-${mes}`;
                const row = mensalByKey[key];
                return (
                  <tr key={mes} className="border-t border-border/40">
                    <Td className="font-medium">{label}</Td>
                    {(
                      [
                        "total_inicio_mes",
                        "previsao_renovacoes",
                        "renovacoes_realizadas",
                        "novas_adesoes",
                        "saidas",
                      ] as const
                    ).map((field) => (
                      <td key={field} className="px-4 py-2.5 text-right">
                        <InlineIntInput
                          value={row?.[field] ?? 0}
                          canEdit={canEdit}
                          onSave={(v) => handleMensalSave(mes, field, v)}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Custos por departamento ──────────────────────────────────────────────────

function DepartamentosTab({
  data,
  canEdit,
  mes,
  onSave,
}: {
  data: CustoDepartamento[];
  canEdit: boolean;
  mes: string;
  onSave: () => void;
}) {
  const byDept = Object.fromEntries(data.map((d) => [d.departamento, d]));
  const total = data.reduce((s, d) => s + d.valor_mensal, 0);

  const handleSave = async (departamento: string, valor: number) => {
    const existing = byDept[departamento];
    try {
      await mutate("portal_custos_departamento", "upsert", {
        id: existing?.id ?? cryptoId(),
        departamento,
        referencia_mes: mes,
        valor_mensal: valor,
        notas: existing?.notas ?? "",
      });
      onSave();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-3">
      <TableCard>
        <thead>
          <tr>
            <Th>Departamento</Th>
            <Th right>Custo mensal</Th>
          </tr>
        </thead>
        <tbody>
          {DEPARTAMENTOS.map((dept) => (
            <tr key={dept} className="border-t border-border/40">
              <Td>{dept}</Td>
              <td className="px-4 py-2.5 text-right">
                <InlineCurrencyInput
                  value={byDept[dept]?.valor_mensal ?? 0}
                  canEdit={canEdit}
                  onSave={(v) => handleSave(dept, v)}
                />
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-border bg-muted/20">
            <td className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Total</td>
            <td className="px-4 py-2.5 text-right text-xs font-semibold tabular-nums">
              {formatCurrencyBRL(total)}
            </td>
          </tr>
        </tbody>
      </TableCard>
    </div>
  );
}

// ─── Tipos auxiliares para AnaliseTab ─────────────────────────────────────────

type LancTotaisAnalise = {
  total_receitas_pagas: number;
  total_despesas_pagas: number;
  saldo_realizado: number;
  resultado_projetado: number;
  total_a_receber: number;
  total_a_pagar: number;
};

type FluxoMesAnalise = {
  mes: string;
  entradas: number;
  saidas: number;
};

const OV_KEY = "analise_overrides_v1";

// ─── Análise automática ───────────────────────────────────────────────────────

function AnaliseTab({
  data,
  canEdit,
  lancTotais,
  fluxoMensal,
}: {
  data: PortalFinanceiroSnapshot;
  canEdit: boolean;
  lancTotais: LancTotaisAnalise | null;
  fluxoMensal: FluxoMesAnalise[];
}) {
  // ── Auto-calculated from real e-Gestor data when manual tables are empty ──
  const saldoFromContas = data.contas_bancarias.reduce((s, c) => s + c.saldo, 0);
  const hasContas = data.contas_bancarias.length > 0;
  const autoSaldo = hasContas ? saldoFromContas : (lancTotais?.saldo_realizado ?? 0);

  const custoFromDept = data.custos_departamento.reduce((s, d) => s + d.valor_mensal, 0);
  const hasDept = data.custos_departamento.length > 0;
  const last3 = fluxoMensal.slice(-3);
  const avg3Custo = last3.length > 0
    ? last3.reduce((s, r) => s + r.saidas, 0) / last3.length
    : 0;
  const autoCusto = hasDept ? custoFromDept : avg3Custo;

  const ultimoMensal = data.associados_mensal.at(-1);
  const autoAtivos = ultimoMensal?.total_inicio_mes ?? 0;

  const numMeses = fluxoMensal.length;
  const receitaMediaMensal = numMeses > 0 ? (lancTotais?.total_receitas_pagas ?? 0) / numMeses : 0;
  const autoMensalidade = autoAtivos > 0 && receitaMediaMensal > 0
    ? receitaMediaMensal / autoAtivos
    : 0;

  // ── Override states (localStorage) ────────────────────────────────────────
  const [ovSaldo, setOvSaldo] = React.useState<number | null>(null);
  const [ovCusto, setOvCusto] = React.useState<number | null>(null);
  const [ovAtivos, setOvAtivos] = React.useState<number | null>(null);
  const [ovMensalidade, setOvMensalidade] = React.useState<number | null>(null);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(OV_KEY);
      if (raw) {
        const ov = JSON.parse(raw) as Record<string, number | null>;
        if (ov.saldo != null) setOvSaldo(ov.saldo);
        if (ov.custo != null) setOvCusto(ov.custo);
        if (ov.ativos != null) setOvAtivos(ov.ativos);
        if (ov.mensalidade != null) setOvMensalidade(ov.mensalidade);
      }
    } catch {}
  }, []);

  const persistOv = (patch: Record<string, number | null>) => {
    try {
      const raw = localStorage.getItem(OV_KEY);
      const cur = raw ? (JSON.parse(raw) as Record<string, number | null>) : {};
      localStorage.setItem(OV_KEY, JSON.stringify({ ...cur, ...patch }));
    } catch {}
  };

  // ── Final computed values ──────────────────────────────────────────────────
  const saldoTotal = ovSaldo ?? autoSaldo;
  const totalCustosMensais = ovCusto ?? autoCusto;
  const totalAtivos = ovAtivos ?? autoAtivos;
  const mensalidadeMedia = ovMensalidade ?? autoMensalidade;

  const custoPorAssociado = totalAtivos > 0 ? totalCustosMensais / totalAtivos : 0;
  const runway = totalCustosMensais > 0 ? saldoTotal / totalCustosMensais : null;
  const breakEven = mensalidadeMedia > 0 ? totalCustosMensais / mensalidadeMedia : null;

  const previsto = data.previsao_mensal
    ? data.previsao_mensal.total_entradas_previstas - data.previsao_mensal.total_despesas_previstas
    : lancTotais?.resultado_projetado ?? null;

  // ── Inline edit state ──────────────────────────────────────────────────────
  const [editingSaldo, setEditingSaldo] = React.useState(false);
  const [draftSaldo, setDraftSaldo] = React.useState("");
  const [editingCusto, setEditingCusto] = React.useState(false);
  const [draftCusto, setDraftCusto] = React.useState("");
  const [editingAtivos, setEditingAtivos] = React.useState(false);
  const [draftAtivos, setDraftAtivos] = React.useState("");
  const [editingMensalidade, setEditingMensalidade] = React.useState(false);
  const [draftMensalidade, setDraftMensalidade] = React.useState("");

  const commitSaldo = () => {
    const n = parseFloat(draftSaldo.replace(",", "."));
    if (!isNaN(n)) { setOvSaldo(n); persistOv({ saldo: n }); }
    setEditingSaldo(false);
  };
  const commitCusto = () => {
    const n = parseFloat(draftCusto.replace(",", "."));
    if (!isNaN(n)) { setOvCusto(n); persistOv({ custo: n }); }
    setEditingCusto(false);
  };
  const commitAtivos = () => {
    const n = parseInt(draftAtivos, 10);
    if (!isNaN(n)) { setOvAtivos(n); persistOv({ ativos: n }); }
    setEditingAtivos(false);
  };
  const commitMensalidade = () => {
    const n = parseFloat(draftMensalidade.replace(",", "."));
    if (!isNaN(n)) { setOvMensalidade(n); persistOv({ mensalidade: n }); }
    setEditingMensalidade(false);
  };

  const saldoSource = ovSaldo != null ? "valor ajustado manualmente"
    : hasContas ? "soma das contas bancárias"
    : lancTotais ? "saldo do sistema financeiro" : "aguardando dados…";
  const custoSource = ovCusto != null ? "valor ajustado manualmente"
    : hasDept ? "soma dos departamentos"
    : last3.length > 0 ? `média dos últimos ${last3.length} meses` : "aguardando dados…";

  const inputCls = "w-full text-sm font-semibold border border-border/60 rounded px-2 py-0.5 bg-background outline-none focus:ring-1 focus:ring-ring tabular-nums";
  const pencilBtn = (onClick: () => void) => (
    <button onClick={onClick} className="flex-shrink-0 p-1 rounded hover:bg-muted/50 text-muted-foreground/30 hover:text-muted-foreground transition-colors">
      <PencilLine className="h-3 w-3" />
    </button>
  );
  const resetBtn = (onClick: () => void, auto: string) => (
    <button onClick={onClick} className="text-[9px] text-muted-foreground/40 hover:text-muted-foreground underline">
      Usar valor calculado ({auto})
    </button>
  );

  return (
    <div className="space-y-5">
      {/* ── Valores base editáveis ── */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/50 mb-2.5">
          Valores de referência — clique no lápis para editar
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Caixa disponível */}
          <Card className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <div className="mt-0.5 h-6 w-6 rounded-md bg-muted/50 grid place-items-center flex-shrink-0">
                  <Landmark className="h-3 w-3 text-muted-foreground/70" />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-[11px] text-muted-foreground">Caixa disponível</p>
                  {editingSaldo ? (
                    <input autoFocus type="number" value={draftSaldo} onChange={(e) => setDraftSaldo(e.target.value)}
                      onBlur={commitSaldo} onKeyDown={(e) => { if (e.key === "Enter") commitSaldo(); if (e.key === "Escape") setEditingSaldo(false); }}
                      className={inputCls} />
                  ) : (
                    <p className="text-base font-semibold tabular-nums">{formatCurrencyBRL(saldoTotal)}</p>
                  )}
                  <p className="text-[9px] text-muted-foreground/50">Fonte: {saldoSource}</p>
                  {ovSaldo != null && resetBtn(() => { setOvSaldo(null); persistOv({ saldo: null }); }, formatCurrencyBRL(autoSaldo))}
                </div>
              </div>
              {canEdit && !editingSaldo && pencilBtn(() => { setDraftSaldo(String(saldoTotal)); setEditingSaldo(true); })}
            </div>
          </Card>

          {/* Custo mensal */}
          <Card className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <div className="mt-0.5 h-6 w-6 rounded-md bg-muted/50 grid place-items-center flex-shrink-0">
                  <TrendingDown className="h-3 w-3 text-muted-foreground/70" />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-[11px] text-muted-foreground">Custo mensal médio</p>
                  {editingCusto ? (
                    <input autoFocus type="number" value={draftCusto} onChange={(e) => setDraftCusto(e.target.value)}
                      onBlur={commitCusto} onKeyDown={(e) => { if (e.key === "Enter") commitCusto(); if (e.key === "Escape") setEditingCusto(false); }}
                      className={inputCls} />
                  ) : (
                    <p className="text-base font-semibold tabular-nums">{formatCurrencyBRL(totalCustosMensais)}</p>
                  )}
                  <p className="text-[9px] text-muted-foreground/50">Fonte: {custoSource}</p>
                  {ovCusto != null && resetBtn(() => { setOvCusto(null); persistOv({ custo: null }); }, formatCurrencyBRL(autoCusto))}
                </div>
              </div>
              {canEdit && !editingCusto && pencilBtn(() => { setDraftCusto(String(totalCustosMensais)); setEditingCusto(true); })}
            </div>
          </Card>

          {/* Associados ativos */}
          <Card className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <div className="mt-0.5 h-6 w-6 rounded-md bg-muted/50 grid place-items-center flex-shrink-0">
                  <Users className="h-3 w-3 text-muted-foreground/70" />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-[11px] text-muted-foreground">Associados ativos</p>
                  {editingAtivos ? (
                    <input autoFocus type="number" value={draftAtivos} onChange={(e) => setDraftAtivos(e.target.value)}
                      onBlur={commitAtivos} onKeyDown={(e) => { if (e.key === "Enter") commitAtivos(); if (e.key === "Escape") setEditingAtivos(false); }}
                      className={inputCls} />
                  ) : (
                    <p className="text-base font-semibold tabular-nums">
                      {totalAtivos > 0 ? totalAtivos.toLocaleString("pt-BR") : "—"}
                    </p>
                  )}
                  <p className="text-[9px] text-muted-foreground/50">
                    {ovAtivos != null ? "valor ajustado manualmente" : "aba Associados"}
                  </p>
                  {ovAtivos != null && resetBtn(() => { setOvAtivos(null); persistOv({ ativos: null }); }, autoAtivos.toLocaleString("pt-BR"))}
                </div>
              </div>
              {canEdit && !editingAtivos && pencilBtn(() => { setDraftAtivos(String(totalAtivos)); setEditingAtivos(true); })}
            </div>
          </Card>

          {/* Mensalidade média */}
          <Card className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <div className="mt-0.5 h-6 w-6 rounded-md bg-muted/50 grid place-items-center flex-shrink-0">
                  <TrendingUp className="h-3 w-3 text-muted-foreground/70" />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-[11px] text-muted-foreground">Mensalidade média por associado</p>
                  {editingMensalidade ? (
                    <input autoFocus type="number" value={draftMensalidade} onChange={(e) => setDraftMensalidade(e.target.value)}
                      onBlur={commitMensalidade} onKeyDown={(e) => { if (e.key === "Enter") commitMensalidade(); if (e.key === "Escape") setEditingMensalidade(false); }}
                      className={inputCls} />
                  ) : (
                    <p className="text-base font-semibold tabular-nums">
                      {mensalidadeMedia > 0 ? formatCurrencyBRL(mensalidadeMedia) : "—"}
                    </p>
                  )}
                  <p className="text-[9px] text-muted-foreground/50">
                    {ovMensalidade != null ? "valor ajustado manualmente" : "receita média ÷ associados"}
                  </p>
                  {ovMensalidade != null && resetBtn(() => { setOvMensalidade(null); persistOv({ mensalidade: null }); }, formatCurrencyBRL(autoMensalidade))}
                </div>
              </div>
              {canEdit && !editingMensalidade && pencilBtn(() => { setDraftMensalidade(String(mensalidadeMedia)); setEditingMensalidade(true); })}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Indicadores calculados ── */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/50 mb-2.5">
          Indicadores calculados automaticamente
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0, duration: 0.3, type: "spring", stiffness: 400, damping: 30 }}>
            <Card className="p-4">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 h-6 w-6 rounded-md bg-muted/50 grid place-items-center flex-shrink-0">
                  <Landmark className="h-3 w-3 text-muted-foreground/70" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-[11px] text-muted-foreground">Caixa cobre despesas por quantos meses?</p>
                  <p className={cn("text-base font-semibold tabular-nums",
                    runway !== null && runway < 6 ? "text-red-600 dark:text-red-400" : "text-foreground")}>
                    {runway !== null ? (runway < 0 ? "Saldo negativo" : `${runway.toFixed(1).replace(".", ",")} meses`) : "—"}
                  </p>
                  <p className="text-[9px] text-muted-foreground/50">
                    {formatCurrencyBRL(saldoTotal)} ÷ {formatCurrencyBRL(totalCustosMensais)}/mês
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.3, type: "spring", stiffness: 400, damping: 30 }}>
            <Card className="p-4">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 h-6 w-6 rounded-md bg-muted/50 grid place-items-center flex-shrink-0">
                  <Users className="h-3 w-3 text-muted-foreground/70" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-[11px] text-muted-foreground">Ponto de equilíbrio</p>
                  <p className="text-base font-semibold tabular-nums">
                    {breakEven !== null ? `${Math.ceil(breakEven).toLocaleString("pt-BR")} assoc.` : "—"}
                  </p>
                  <p className="text-[9px] text-muted-foreground/50">
                    Custo mensal ÷ mensalidade média
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.3, type: "spring", stiffness: 400, damping: 30 }}>
            <Card className="p-4">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 h-6 w-6 rounded-md bg-muted/50 grid place-items-center flex-shrink-0">
                  <CalendarDays className="h-3 w-3 text-muted-foreground/70" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-[11px] text-muted-foreground">Custo por associado / mês</p>
                  <p className="text-base font-semibold tabular-nums">
                    {custoPorAssociado > 0 ? formatCurrencyBRL(custoPorAssociado) : "—"}
                  </p>
                  <p className="text-[9px] text-muted-foreground/50">
                    {formatCurrencyBRL(totalCustosMensais)} ÷ {totalAtivos > 0 ? totalAtivos.toLocaleString("pt-BR") : "?"} assoc.
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.3, type: "spring", stiffness: 400, damping: 30 }}>
            <Card className="p-4">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 h-6 w-6 rounded-md bg-muted/50 grid place-items-center flex-shrink-0">
                  {previsto != null && previsto >= 0
                    ? <TrendingUp className="h-3 w-3 text-emerald-500" />
                    : <TrendingDown className="h-3 w-3 text-red-500" />}
                </div>
                <div className="space-y-0.5">
                  <p className="text-[11px] text-muted-foreground">Resultado previsto no mês</p>
                  <p className={cn("text-base font-semibold tabular-nums",
                    previsto != null
                      ? previsto >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                      : "text-foreground")}>
                    {previsto != null ? formatCurrencyBRL(previsto) : "—"}
                  </p>
                  <p className="text-[9px] text-muted-foreground/50">
                    {data.previsao_mensal ? "Da sua previsão (aba Previsão)" : "A receber menos o que falta pagar"}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function TableCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/50">
      <table className="w-full text-xs">{children}</table>
    </div>
  );
}

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground bg-muted/30",
        right ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  right,
  className,
}: {
  children?: React.ReactNode;
  right?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-4 py-2.5 text-xs tabular-nums",
        right ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </td>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
      <div className="flex-1 text-right">{children}</div>
    </div>
  );
}

function ValueLine({ value, color }: { value: number; color?: string }) {
  return (
    <span className={cn("text-sm font-medium tabular-nums", color)}>
      {formatCurrencyBRL(value)}
    </span>
  );
}

function InlineIntInput({
  value,
  canEdit,
  onSave,
}: {
  value: number;
  canEdit: boolean;
  onSave: (v: number) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [val, setVal] = React.useState(String(value));

  React.useEffect(() => {
    setVal(String(value));
  }, [value]);

  if (!canEdit) return <span className="tabular-nums">{value.toLocaleString("pt-BR")}</span>;

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          setEditing(false);
          const n = parseInt(val, 10);
          if (!isNaN(n) && n !== value) onSave(n);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setEditing(false);
            setVal(String(value));
          }
        }}
        className="w-20 text-right text-xs border border-border/60 rounded px-1.5 py-0.5 bg-background outline-none focus:ring-1 focus:ring-ring"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="tabular-nums text-xs hover:text-foreground text-muted-foreground transition-colors group"
    >
      {value > 0 ? value.toLocaleString("pt-BR") : (
        <span className="text-muted-foreground/30 group-hover:text-muted-foreground">—</span>
      )}
    </button>
  );
}

function InlineCurrencyInput({
  value,
  canEdit,
  onSave,
}: {
  value: number;
  canEdit: boolean;
  onSave: (v: number) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [val, setVal] = React.useState(String(value));

  React.useEffect(() => {
    setVal(String(value));
  }, [value]);

  if (!canEdit) return <span className="tabular-nums">{formatCurrencyBRL(value)}</span>;

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          setEditing(false);
          const n = parseFloat(val);
          if (!isNaN(n) && n !== value) onSave(n);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setEditing(false);
            setVal(String(value));
          }
        }}
        className="w-28 text-right text-xs border border-border/60 rounded px-1.5 py-0.5 bg-background outline-none focus:ring-1 focus:ring-ring"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="tabular-nums text-xs hover:text-foreground text-muted-foreground transition-colors group"
    >
      {value > 0 ? formatCurrencyBRL(value) : (
        <span className="text-muted-foreground/30 group-hover:text-muted-foreground">—</span>
      )}
    </button>
  );
}
