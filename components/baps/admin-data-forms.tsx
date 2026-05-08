"use client";

import * as React from "react";
import { Loader2, Shield, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ProcessoFase } from "@/lib/baps/types";
import { parseLooseNumber } from "@/lib/utils";

const FASES: { value: ProcessoFase; label: string }[] = [
  { value: "inicial", label: "Inicial" },
  { value: "andamento", label: "Andamento" },
  { value: "julgado", label: "Julgado" },
  { value: "finalizado", label: "Finalizado" },
];

export function AdminDataForms() {
  const [legalBusy, setLegalBusy] = React.useState(false);
  const [finBusy, setFinBusy] = React.useState(false);
  const [legalMsg, setLegalMsg] = React.useState<string | null>(null);
  const [finMsg, setFinMsg] = React.useState<string | null>(null);

  const [nomeProcesso, setNomeProcesso] = React.useState("");
  const [fase, setFase] = React.useState<ProcessoFase>("andamento");
  const [responsavel, setResponsavel] = React.useState("");
  const [atualizacao, setAtualizacao] = React.useState("");

  const [nomeEvento, setNomeEvento] = React.useState("");
  const [cidade, setCidade] = React.useState("");
  const [receitas, setReceitas] = React.useState("");
  const [despesas, setDespesas] = React.useState("");
  const [referencia, setReferencia] = React.useState("");

  async function submitLegal(e: React.FormEvent) {
    e.preventDefault();
    setLegalMsg(null);
    setLegalBusy(true);
    try {
      const stamp = new Date().toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      });
      const texto = atualizacao.trim()
        ? `${atualizacao.trim()}\n\n— Atualização semanal (${stamp})`
        : `Atualização semanal registrada em ${stamp}.`;

      const res = await fetch("/api/baps/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "processo",
          data: {
            tipo: "extrajudicial",
            parte_envolvida: nomeProcesso.trim(),
            numero: "",
            tribunal: "",
            fase,
            responsavel_escritorio: responsavel.trim(),
            atualizacao_semanal: texto,
            nivel_risco: "medio",
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Falha ao gravar");
      setLegalMsg("Processo registrado no Supabase.");
      setNomeProcesso("");
      setAtualizacao("");
    } catch (err) {
      setLegalMsg(err instanceof Error ? err.message : "Erro ao enviar.");
    } finally {
      setLegalBusy(false);
    }
  }

  async function submitFinanceiro(e: React.FormEvent) {
    e.preventDefault();
    setFinMsg(null);
    setFinBusy(true);
    try {
      const res = await fetch("/api/baps/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "financeiro_evento_save",
          data: {
            nome_evento: nomeEvento.trim(),
            cidade: cidade.trim(),
            receitas: parseLooseNumber(receitas),
            despesas_pagas: parseLooseNumber(despesas),
            referencia: referencia.trim() || "Atualização via /admin",
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Falha ao gravar");
      setFinMsg("Receitas e despesas sincronizadas (insert ou update por nome do evento).");
      setNomeEvento("");
      setReceitas("");
      setDespesas("");
    } catch (err) {
      setFinMsg(err instanceof Error ? err.message : "Erro ao enviar.");
    } finally {
      setFinBusy(false);
    }
  }

  const labelCls = "text-sm font-medium leading-none text-foreground";

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground font-medium">
          Área restrita
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Alimentação de dados · Poliana & Miguel</h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
          Formulários diretos para o Supabase. Esta rota não aparece no menu lateral; use apenas com autorização da diretoria.
        </p>
      </header>

      <Card className="rounded-2xl border-border/60 p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2 text-foreground">
          <Shield className="h-5 w-5 opacity-80" aria-hidden />
          <h2 className="text-lg font-semibold tracking-tight">Input jurídico</h2>
        </div>
        <form onSubmit={submitLegal} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="proc-nome" className={labelCls}>
              Nome do processo / parte envolvida
            </label>
            <Input
              id="proc-nome"
              value={nomeProcesso}
              onChange={(e) => setNomeProcesso(e.target.value)}
              required
              placeholder="Ex.: Revisão contratual Mtech"
              className="rounded-xl"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <span className={labelCls}>Fase processual</span>
              <Select
                value={fase}
                onValueChange={(v) => setFase(v as ProcessoFase)}
                options={FASES.map((f) => ({ value: f.value, label: f.label }))}
                triggerClassName="w-full min-w-0 h-11 rounded-xl border border-input bg-background"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="proc-resp" className={labelCls}>
                Responsável (escritório / interno)
              </label>
              <Input
                id="proc-resp"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                required
                placeholder="Ex.: TGMED · Dr. Costa"
                className="rounded-xl"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="proc-atual" className={labelCls}>
              Atualização semanal
            </label>
            <Textarea
              id="proc-atual"
              value={atualizacao}
              onChange={(e) => setAtualizacao(e.target.value)}
              rows={4}
              placeholder="Resumo da semana: audiências, petições, prazos."
              className="rounded-xl resize-y min-h-[100px]"
            />
          </div>
          {legalMsg && (
            <p
              className={`text-sm ${legalMsg.startsWith("Processo") ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}`}
            >
              {legalMsg}
            </p>
          )}
          <Button type="submit" disabled={legalBusy} className="rounded-xl gap-2">
            {legalBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Registrar atualização semanal
          </Button>
        </form>
      </Card>

      <Card className="rounded-2xl border-border/60 p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2 text-foreground">
          <Wallet className="h-5 w-5 opacity-80" aria-hidden />
          <h2 className="text-lg font-semibold tracking-tight">Input financeiro</h2>
        </div>
        <form onSubmit={submitFinanceiro} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <label htmlFor="ev-nome" className={labelCls}>
                Nome do evento
              </label>
              <Input
                id="ev-nome"
                value={nomeEvento}
                onChange={(e) => setNomeEvento(e.target.value)}
                required
                placeholder="Ex.: Summit Turismo Saúde"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="ev-cid" className={labelCls}>
                Cidade
              </label>
              <Input
                id="ev-cid"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="Goiânia"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="ev-ref" className={labelCls}>
                Referência
              </label>
              <Input
                id="ev-ref"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder="Mar/2026 · fechamento parcial"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="ev-rec" className={labelCls}>
                Receitas (R$)
              </label>
              <Input
                id="ev-rec"
                inputMode="decimal"
                value={receitas}
                onChange={(e) => setReceitas(e.target.value)}
                required
                placeholder="82.590"
                className="rounded-xl tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="ev-des" className={labelCls}>
                Despesas pagas (R$)
              </label>
              <Input
                id="ev-des"
                inputMode="decimal"
                value={despesas}
                onChange={(e) => setDespesas(e.target.value)}
                required
                placeholder="106.102"
                className="rounded-xl tabular-nums"
              />
            </div>
          </div>
          {finMsg && (
            <p
              className={`text-sm ${finMsg.startsWith("Receitas") ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600"}`}
            >
              {finMsg}
            </p>
          )}
          <Button type="submit" disabled={finBusy} variant="secondary" className="rounded-xl gap-2">
            {finBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Gravar no Supabase
          </Button>
        </form>
      </Card>
    </div>
  );
}
