"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Database } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusDot } from "@/components/baps/status-dot";
import { CommercialOverview } from "@/components/baps/commercial-overview";
import { ExecutiveHero } from "@/components/baps/executive-hero";
import { CompanyHealth } from "@/components/dashboard/company-health";
import { NpsComposedChart } from "@/components/baps/nps-composed-chart";
import { InstitutionalRiskPanel } from "@/components/baps/institutional-risk-panel";
import { CongressNucleiTable } from "@/components/baps/congress-nuclei-table";
import { CongressOperacaoPanel } from "@/components/baps/congress-operacao-panel";
import type { BapsSnapshot } from "@/lib/baps/types";
import type { PortalSector } from "@/lib/portal-sector";
import { sectorShortLabel, showZone } from "@/lib/portal-sector";
import { formatCurrencyBRL, formatNumberBR, cn } from "@/lib/utils";
import { useRegisterPageState } from "@/lib/page-state";

const fade = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.03, duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  }),
};

const CONTRATO_STATUS: Record<string, string> = {
  demanda: "Demanda",
  em_elaboracao: "Em elaboração",
  gestao_assinaturas: "Gestão / assinaturas",
  ativo: "Ativo",
};

const PROCESSO_FASE: Record<string, string> = {
  inicial: "Inicial",
  andamento: "Andamento",
  julgado: "Julgado",
  finalizado: "Finalizado",
};

const RISCO_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  baixo: "success",
  medio: "warning",
  alto: "destructive",
};

function certidaoAlertaMeses(previsaoIso: string): "calmo" | "alerta" | "vencido" {
  const alvo = new Date(previsaoIso + "T12:00:00");
  const hoje = new Date();
  const ms = alvo.getTime() - hoje.getTime();
  const meses = ms / (1000 * 60 * 60 * 24 * 30.44);
  if (ms < 0) return "vencido";
  if (meses <= 6) return "alerta";
  return "calmo";
}

export function BapsDashboard({
  initial,
  sector,
}: {
  initial: BapsSnapshot;
  sector: PortalSector;
}) {
  const [data, setData] = React.useState<BapsSnapshot>(initial);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/baps/snapshot", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as BapsSnapshot;
        if (!cancelled) setData(json);
      } catch {
        /* mantém initial */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const demandas = data.contratos.filter((c) => c.status !== "ativo");
  const ativos = data.contratos.filter((c) => c.status === "ativo");
  const risco = data.contratos.filter((c) => c.destaque_risco);
  const processosAltoRisco = data.processos.filter((p) => p.nivel_risco === "alto").length;
  const certAlertas = data.certidoes.filter(
    (c) => certidaoAlertaMeses(c.previsao_proxima) !== "calmo",
  ).length;
  const totalReceitasEventos = data.financeiro_eventos.reduce((s, e) => s + e.receitas, 0);
  const totalDespesasEventos = data.financeiro_eventos.reduce((s, e) => s + e.despesas_pagas, 0);
  const resultadoEventos = totalReceitasEventos - totalDespesasEventos;
  const trilhasCriticas = data.evento_trilhas.filter((t) => t.status === "critical").length;
  const trilhasAlerta = data.evento_trilhas.filter((t) => t.status === "warning").length;

  const pageSummary = React.useMemo(() => {
    if (sector === "executivo") {
      return [
        { label: "Saldo global", value: formatCurrencyBRL(data.financeiro_resumo.saldo_global) },
        { label: "Associados ativos", value: formatNumberBR(data.associados_resumo.total_ativos) },
        { label: "Demandas abertas", value: formatNumberBR(demandas.length) },
      ];
    }
    if (sector === "juridico") {
      return [
        { label: "Demandas em contratos", value: formatNumberBR(demandas.length) },
        { label: "Processos alto risco", value: formatNumberBR(processosAltoRisco) },
        { label: "Certidões em alerta", value: formatNumberBR(certAlertas) },
      ];
    }
    if (sector === "financeiro" || sector === "contabil") {
      return [
        { label: "Saldo global", value: formatCurrencyBRL(data.financeiro_resumo.saldo_global) },
        { label: "Resultado eventos", value: formatCurrencyBRL(resultadoEventos) },
        { label: "Eventos monitorados", value: formatNumberBR(data.financeiro_eventos.length) },
      ];
    }
    if (sector === "marketing") {
      return [
        { label: "Associados ativos", value: formatNumberBR(data.associados_resumo.total_ativos) },
        { label: "Renovações no mês", value: formatNumberBR(data.associados_resumo.vencimentos_mes) },
        { label: "Saídas YTD", value: formatNumberBR(data.associados_resumo.saidas_ytd) },
      ];
    }
    if (sector === "administrativo") {
      return [
        { label: "Certidões em alerta", value: formatNumberBR(certAlertas) },
        {
          label: "Atas / procurações",
          value: data.institucional.atas_procuracoes_ok ? "OK" : "Pendente",
        },
        {
          label: "Assembleia",
          value: data.institucional.proxima_assembleia
            ? new Date(data.institucional.proxima_assembleia + "T12:00:00").toLocaleDateString(
                "pt-BR",
              )
            : "—",
        },
      ];
    }
    return [
      { label: "Trilhas críticas", value: formatNumberBR(trilhasCriticas) },
      { label: "Resultado eventos", value: formatCurrencyBRL(resultadoEventos) },
      { label: "Eventos no painel", value: formatNumberBR(data.financeiro_eventos.length) },
    ];
  }, [
    sector,
    data,
    demandas.length,
    processosAltoRisco,
    certAlertas,
    resultadoEventos,
    trilhasCriticas,
  ]);

  useRegisterPageState({
    module: sector === "executivo" ? "Painel da presidência" : `Painel · ${sectorShortLabel(sector)}`,
    summary: pageSummary,
  });

  return (
    <div className="space-y-8 pb-16 print:space-y-4">
      <div className="hidden print:block print:mb-5 print:pb-4 print:border-b print:border-neutral-200">
        <p className="text-[10px] uppercase tracking-[0.28em] text-neutral-500 font-medium">
          BAPS · relatório executivo
        </p>
        <p className="text-lg font-semibold text-neutral-900 mt-1 tracking-tight">
          Painel executivo — referência {data.financeiro_resumo.referencia_mes}
        </p>
        <p className="text-xs text-neutral-600 mt-1">
          Documento otimizado para impressão / PDF (Ctrl+P · Guardar como PDF).
        </p>
      </div>
      <motion.header
        initial="hidden"
        animate="show"
        custom={0}
        variants={fade}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:block"
      >
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground font-medium">
            {sector === "executivo" ? "Painel da presidência" : sectorShortLabel(sector)}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Painel da presidência
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground leading-relaxed">
            {sector === "executivo" ? (
              <>
                Visão geral da organização · mês de referência:{" "}
                <span className="tabular-nums font-medium text-foreground">
                  {data.financeiro_resumo.referencia_mes}
                </span>
              </>
            ) : (
              <>
                Visão apenas do setor de <span className="font-medium text-foreground">{sectorShortLabel(sector)}</span>.
                Referência financeira{" "}
                <span className="tabular-nums font-medium text-foreground">
                  {data.financeiro_resumo.referencia_mes}
                </span>
                .
              </>
            )}
          </p>
        </div>
        {showZone(sector, "acao_entrada_dados") && (
          <Link
            href="/entrada-dados"
            className="inline-flex items-center gap-2 self-start rounded-xl border border-border/70 bg-background/50 px-4 py-2.5 text-sm font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-foreground/[0.04] print:hidden"
          >
            <Database className="h-4 w-4 opacity-70" />
            Painel de inserção de dados
            <ArrowUpRight className="h-3.5 w-3.5 opacity-50" />
          </Link>
        )}
      </motion.header>

      {sector === "executivo" && (
        <motion.div initial="hidden" animate="show" custom={1} variants={fade}>
          <CompanyHealth data={data} />
        </motion.div>
      )}

      {showZone(sector, "macro_executivo") && (
        <motion.div initial="hidden" animate="show" custom={2} variants={fade}>
          <ExecutiveHero data={data} />
        </motion.div>
      )}

      {sector === "executivo" && (
        <motion.div initial="hidden" animate="show" custom={3} variants={fade}>
          <LancamentosKpiStrip />
        </motion.div>
      )}

      {showZone(sector, "macro_juridico") && (
        <motion.section
          initial="hidden"
          animate="show"
          custom={1}
          variants={fade}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-2"
        >
          <Kpi
            label="Demandas em contratos"
            value={formatNumberBR(demandas.length)}
            hint="Fluxos até assinatura"
          />
          <Kpi label="Contratos ativos" value={formatNumberBR(ativos.length)} hint="Carteira vigente" />
          <Kpi
            label="Processos de alto risco"
            value={formatNumberBR(processosAltoRisco)}
            hint="Prioridade da assessoria"
          />
          <Kpi
            label="Certidões em alerta"
            value={formatNumberBR(certAlertas)}
            hint="Renovar em até 6 meses ou vencidas"
          />
        </motion.section>
      )}

      {showZone(sector, "macro_financeiro") && (
        <motion.section
          initial="hidden"
          animate="show"
          custom={1}
          variants={fade}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-2"
        >
          <Kpi
            label="Saldo global"
            value={formatCurrencyBRL(data.financeiro_resumo.saldo_global)}
            hint="Posição líquida consolidada"
          />
          <Kpi
            label="Déficit Q1"
            value={formatCurrencyBRL(data.financeiro_resumo.deficit_q1)}
            hint="Resultado parcial trimestral"
            accent={data.financeiro_resumo.deficit_q1 < 0 ? "rose" : undefined}
          />
          <Kpi
            label="Receitas (eventos)"
            value={formatCurrencyBRL(totalReceitasEventos)}
            hint="Soma dos eventos no painel"
          />
          <Kpi
            label="Resultado (eventos)"
            value={formatCurrencyBRL(resultadoEventos)}
            hint="Receitas − despesas pagas"
            accent={resultadoEventos < 0 ? "rose" : undefined}
          />
        </motion.section>
      )}

      {showZone(sector, "macro_marketing") && (
        <motion.section
          initial="hidden"
          animate="show"
          custom={1}
          variants={fade}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-2"
        >
          <Kpi
            label="Associados ativos"
            value={formatNumberBR(data.associados_resumo.total_ativos)}
            hint="Base vigente"
          />
          <Kpi
            label="Renovações no mês"
            value={formatNumberBR(data.associados_resumo.vencimentos_mes)}
            hint="Vencimento neste mês"
          />
          <Kpi
            label="Saídas na semana"
            value={formatNumberBR(data.associados_resumo.saidas_semana)}
            hint="Churn semanal"
          />
          <Kpi
            label="Saídas no ano (YTD)"
            value={formatNumberBR(data.associados_resumo.saidas_ytd)}
            hint="Churn acumulado no ano"
          />
        </motion.section>
      )}

      {showZone(sector, "macro_admin") && (
        <motion.section
          initial="hidden"
          animate="show"
          custom={1}
          variants={fade}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-2"
        >
          <Kpi
            label="Atas e procurações"
            value={data.institucional.atas_procuracoes_ok ? "Em dia" : "Pendente"}
            hint="Arquivo institucional"
          />
          <Kpi
            label="Regimento interno"
            value={data.institucional.regimento_interno_ok ? "Atualizado" : "Revisar"}
            hint="Disponibilidade ao conselho"
          />
          <Kpi
            label="Certidões em alerta"
            value={formatNumberBR(certAlertas)}
            hint="Vencimento ou renovação"
          />
          <Kpi
            label="Próxima assembleia"
            value={
              data.institucional.proxima_assembleia
                ? new Date(data.institucional.proxima_assembleia + "T12:00:00").toLocaleDateString(
                    "pt-BR",
                  )
                : "—"
            }
            hint="Calendário corporativo"
          />
        </motion.section>
      )}

      {showZone(sector, "macro_eventos") && (
        <motion.section
          initial="hidden"
          animate="show"
          custom={1}
          variants={fade}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-2"
        >
          <Kpi
            label="Trilhas críticas"
            value={formatNumberBR(trilhasCriticas)}
            hint="Congresso · exige plano de ação"
            accent={trilhasCriticas > 0 ? "rose" : undefined}
          />
          <Kpi
            label="Trilhas em alerta"
            value={formatNumberBR(trilhasAlerta)}
            hint="Acompanhamento próximo"
          />
          <Kpi
            label="Eventos no painel"
            value={formatNumberBR(data.financeiro_eventos.length)}
            hint="Linha financeira por evento"
          />
          <Kpi
            label="Resultado (eventos)"
            value={formatCurrencyBRL(resultadoEventos)}
            hint="Receitas − despesas pagas"
            accent={resultadoEventos < 0 ? "rose" : undefined}
          />
        </motion.section>
      )}

      {showZone(sector, "bloco_risco_contratos") && (
        <motion.section
          initial="hidden"
          animate="show"
          custom={2}
          variants={fade}
          className={cn(
            "grid gap-3",
            showZone(sector, "bloco_institucional") && "lg:grid-cols-2",
          )}
        >
          <Card className="p-5 sm:p-6 rounded-2xl border-border/60 bg-card/80 backdrop-blur-sm shadow-sm print:break-inside-avoid">
            <h2 className="text-sm font-semibold tracking-tight">Jurídico · contratos com risco</h2>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Destaque obrigatório para minutas não habituais e decisões registradas.
            </p>
            <ul className="mt-4 space-y-3">
              {risco.map((c) => (
                <li
                  key={c.id}
                  className="rounded-xl border border-border/50 bg-foreground/[0.02] dark:bg-white/[0.03] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-sm font-medium leading-snug">{c.fornecedor}</span>
                    <Badge variant="warning" className="shrink-0 tabular-nums">
                      {CONTRATO_STATUS[c.status] ?? c.status}
                    </Badge>
                  </div>
                  {c.decisao_notas && (
                    <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{c.decisao_notas}</p>
                  )}
                </li>
              ))}
            </ul>
          </Card>

          {showZone(sector, "bloco_institucional") && (
            <Card className="p-5 sm:p-6 rounded-2xl border-border/60 bg-card/80 backdrop-blur-sm shadow-sm print:break-inside-avoid">
              <h2 className="text-sm font-semibold tracking-tight">Institucional</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Checklist para assembleias e conformidade estatutária.
              </p>
              <ul className="mt-4 space-y-2.5 text-sm">
                <CheckRow done={data.institucional.atas_procuracoes_ok} label="Atas e procurações arquivadas" />
                <CheckRow
                  done={!!data.institucional.status_estatutario}
                  label="Status estatutário"
                  detail={data.institucional.status_estatutario}
                />
                <CheckRow
                  done={!!data.institucional.proxima_assembleia}
                  label="Próxima assembleia"
                  detail={
                    data.institucional.proxima_assembleia
                      ? new Date(data.institucional.proxima_assembleia + "T12:00:00").toLocaleDateString(
                          "pt-BR",
                        )
                      : undefined
                  }
                />
                <CheckRow
                  done={data.institucional.regimento_interno_ok}
                  label="Regimento interno"
                  detail={
                    data.institucional.regimento_interno_ok
                      ? "Atualizado e disponível ao conselho"
                      : "Atualização pendente"
                  }
                />
              </ul>
            </Card>
          )}
        </motion.section>
      )}

      {showZone(sector, "bloco_institucional") && !showZone(sector, "bloco_risco_contratos") && (
        <motion.section initial="hidden" animate="show" custom={2} variants={fade}>
          <Card className="p-5 sm:p-6 rounded-2xl border-border/60 bg-card/80 backdrop-blur-sm shadow-sm print:break-inside-avoid max-w-2xl">
            <h2 className="text-sm font-semibold tracking-tight">Institucional</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Checklist para assembleias e conformidade estatutária.
            </p>
            <ul className="mt-4 space-y-2.5 text-sm">
              <CheckRow done={data.institucional.atas_procuracoes_ok} label="Atas e procurações arquivadas" />
              <CheckRow
                done={!!data.institucional.status_estatutario}
                label="Status estatutário"
                detail={data.institucional.status_estatutario}
              />
              <CheckRow
                done={!!data.institucional.proxima_assembleia}
                label="Próxima assembleia"
                detail={
                  data.institucional.proxima_assembleia
                    ? new Date(data.institucional.proxima_assembleia + "T12:00:00").toLocaleDateString("pt-BR")
                    : undefined
                }
              />
              <CheckRow
                done={data.institucional.regimento_interno_ok}
                label="Regimento interno"
                detail={
                  data.institucional.regimento_interno_ok
                    ? "Atualizado e disponível ao conselho"
                    : "Atualização pendente"
                }
              />
            </ul>
          </Card>
        </motion.section>
      )}

      {showZone(sector, "bloco_contratos") && (
        <motion.section initial="hidden" animate="show" custom={3} variants={fade}>
          <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm print:break-inside-avoid">
            <div className="px-5 pt-5 pb-2">
              <h2 className="text-sm font-semibold tracking-tight">Contratos · pipeline</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Em &quot;Demandas&quot; permanecem todos os fluxos até assinatura; ao ficar &quot;Ativo&quot;, saem desta aba.
              </p>
            </div>
            <Tabs defaultValue="demandas" className="px-5 pb-5">
              <TabsList className="mb-3 print:hidden">
                <TabsTrigger value="demandas">Demandas</TabsTrigger>
                <TabsTrigger value="ativos">Carteira ativa</TabsTrigger>
                <TabsTrigger value="mapa">Mapa completo</TabsTrigger>
              </TabsList>
              <TabsContent value="demandas">
                <ContratoTable rows={demandas} empty="Nenhuma demanda em aberto." />
              </TabsContent>
              <TabsContent value="ativos">
                <ContratoTable rows={ativos} empty="Sem contratos ativos listados." />
              </TabsContent>
              <TabsContent value="mapa">
                <ContratoTable rows={data.contratos} empty="Sem registros." />
              </TabsContent>
            </Tabs>
          </Card>
        </motion.section>
      )}

      {showZone(sector, "bloco_processos") && (
        <motion.section initial="hidden" animate="show" custom={4} variants={fade}>
          <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm print:break-inside-avoid">
            <div className="px-5 pt-5 pb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold tracking-tight">Processos</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Judicial e extrajudicial · atualização semanal e nível de risco.
                </p>
              </div>
              <Badge variant="muted" className="tabular-nums">
                {data.processos.length} registros
              </Badge>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Parte</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead className="hidden xl:table-cell">Tribunal</TableHead>
                  <TableHead>Fase</TableHead>
                  <TableHead className="hidden lg:table-cell">Escritório</TableHead>
                  <TableHead>Risco</TableHead>
                  <TableHead className="hidden md:table-cell min-w-[200px]">Atualização</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.processos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="capitalize text-muted-foreground">{p.tipo}</TableCell>
                    <TableCell className="font-medium">{p.parte_envolvida}</TableCell>
                    <TableCell className="tabular-nums text-xs text-muted-foreground">{p.numero}</TableCell>
                    <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">{p.tribunal}</TableCell>
                    <TableCell>{PROCESSO_FASE[p.fase] ?? p.fase}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs">{p.responsavel_escritorio}</TableCell>
                    <TableCell>
                      <Badge variant={RISCO_VARIANT[p.nivel_risco] ?? "muted"} className="capitalize">
                        {p.nivel_risco}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground leading-snug">
                      {p.atualizacao_semanal}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </motion.section>
      )}

      {showZone(sector, "bloco_certidoes") && (
        <motion.section initial="hidden" animate="show" custom={5} variants={fade}>
          <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm print:break-inside-avoid">
            <div className="px-5 pt-5 pb-3">
              <h2 className="text-sm font-semibold tracking-tight">Certidões</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Alerta visual quando a próxima emissão estiver a menos de seis meses.
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Certidão</TableHead>
                  <TableHead>Última emissão</TableHead>
                  <TableHead>Próxima previsão</TableHead>
                  <TableHead>Pendência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.certidoes.map((c) => {
                  const al = certidaoAlertaMeses(c.previsao_proxima);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground text-sm">
                        {new Date(c.data_ultima_emissao + "T12:00:00").toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-2 tabular-nums text-sm">
                          {new Date(c.previsao_proxima + "T12:00:00").toLocaleDateString("pt-BR")}
                          {al === "alerta" && (
                            <Badge variant="warning" className="text-[10px]">
                              ≤ 6 meses
                            </Badge>
                          )}
                          {al === "vencido" && (
                            <Badge variant="destructive" className="text-[10px]">
                              Renovar
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.status_pendencia}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </motion.section>
      )}

      {(showZone(sector, "bloco_financeiro_narrativa") || showZone(sector, "bloco_financeiro_eventos")) && (
        <motion.section initial="hidden" animate="show" custom={6} variants={fade} className="grid gap-3 lg:grid-cols-2">
          {showZone(sector, "bloco_financeiro_narrativa") && (
            <Card className="p-5 sm:p-6 rounded-2xl border-border/60 shadow-sm print:break-inside-avoid">
              <h2 className="text-sm font-semibold tracking-tight">Financeiro · narrativa</h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Contas bancárias</dt>
                  <dd className="mt-1 text-muted-foreground leading-relaxed">{data.financeiro_resumo.contas_bancarias}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Pendências</dt>
                  <dd className="mt-1 text-muted-foreground leading-relaxed">{data.financeiro_resumo.pendencias}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Inadimplência · patrocinadores</dt>
                  <dd className="mt-1 text-muted-foreground leading-relaxed">
                    {data.financeiro_resumo.inadimplencia_patrocinadores}
                  </dd>
                </div>
              </dl>
            </Card>
          )}
          {showZone(sector, "bloco_financeiro_eventos") && (
            <Card className="p-5 sm:p-6 rounded-2xl border-border/60 shadow-sm print:break-inside-avoid">
              <h2 className="text-sm font-semibold tracking-tight">Eventos · receitas e despesas</h2>
              <div className="mt-4 space-y-4">
                {data.financeiro_eventos.map((ev) => {
                  const res = ev.receitas - ev.despesas_pagas;
                  return (
                    <div key={ev.id} className="rounded-xl border border-border/50 px-4 py-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium">{ev.nome_evento}</span>
                        <span className="text-xs text-muted-foreground">{ev.cidade}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm tabular-nums">
                        <div>
                          <span className="text-[11px] text-muted-foreground">Receitas</span>
                          <div className="font-semibold">{formatCurrencyBRL(ev.receitas)}</div>
                        </div>
                        <div>
                          <span className="text-[11px] text-muted-foreground">Despesas pagas</span>
                          <div className="font-semibold">{formatCurrencyBRL(ev.despesas_pagas)}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">{ev.referencia}</span>
                        <Badge variant={res >= 0 ? "success" : "destructive"} className="tabular-nums">
                          Resultado {formatCurrencyBRL(res)}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </motion.section>
      )}

      {showZone(sector, "bloco_congresso") && (
        <>
          <motion.section initial="hidden" animate="show" custom={7} variants={fade}>
            <CongressNucleiTable trilhas={data.evento_trilhas} />
          </motion.section>
          <motion.section initial="hidden" animate="show" custom={7} variants={fade}>
            <CongressOperacaoPanel data={data} />
          </motion.section>
        </>
      )}

      {showZone(sector, "bloco_nps") && (
        <motion.section initial="hidden" animate="show" custom={8} variants={fade}>
          <NpsComposedChart data={data} />
        </motion.section>
      )}

      {showZone(sector, "bloco_comercial") && (
        <motion.section initial="hidden" animate="show" custom={9} variants={fade}>
          <CommercialOverview associados={data.associados_resumo} />
        </motion.section>
      )}

      {sector === "executivo" && (
        <motion.section initial="hidden" animate="show" custom={10} variants={fade}>
          <CeoHelpCard />
        </motion.section>
      )}
    </div>
  );
}

function CeoHelpCard() {
  const items = [
    {
      q: 'O que é "Dinheiro em caixa"?',
      a: "É o valor total disponível nas contas da organização agora. Clique no número para atualizar.",
    },
    {
      q: 'O que é "Satisfação dos membros"?',
      a: "É uma nota de 0 a 100 que mede o quanto os associados estão satisfeitos com a BAPS. Quanto maior, melhor. A meta é 70 ou mais.",
    },
    {
      q: 'O que é "Total de associados"?',
      a: "O número de pessoas ativas como membros da BAPS hoje. Clique no número para atualizar.",
    },
    {
      q: "Como atualizar os outros dados?",
      a: 'Use o botão "Inserir dados" no topo da página para atualizar finanças, eventos, jurídico e muito mais.',
    },
  ];
  return (
    <Card className="p-5 sm:p-6 rounded-2xl border-border/60 bg-card/80 backdrop-blur-sm shadow-sm print:break-inside-avoid">
      <h2 className="text-sm font-semibold tracking-tight">Como usar este painel</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.q} className="rounded-xl border border-border/40 bg-foreground/[0.02] px-4 py-3">
            <p className="text-sm font-medium text-foreground leading-snug">{item.q}</p>
            <p className="mt-1.5 text-[12px] text-muted-foreground leading-relaxed">{item.a}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Kpi({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "rose";
}) {
  return (
    <Card className="p-5 rounded-2xl border-border/60 bg-card/80 backdrop-blur-sm shadow-sm print:break-inside-avoid">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      {hint && <div className="text-[11px] text-muted-foreground/80 mt-1">{hint}</div>}
      <div
        className={cn(
          "mt-3 text-xl font-semibold tracking-tight tabular-nums",
          accent === "rose" && "text-rose-600 dark:text-rose-400",
        )}
      >
        {value}
      </div>
    </Card>
  );
}

function CheckRow({ done, label, detail }: { done: boolean; label: string; detail?: string }) {
  return (
    <li className="flex gap-3 items-start">
      <StatusDot status={done ? "success" : "warning"} aria-label={done ? "Concluído" : "Pendente"} />
      <div>
        <div className="font-medium leading-tight">{label}</div>
        {detail && <div className="text-xs text-muted-foreground mt-0.5">{detail}</div>}
      </div>
    </li>
  );
}

function ContratoTable({ rows, empty }: { rows: BapsSnapshot["contratos"]; empty: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">{empty}</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fornecedor</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Início</TableHead>
          <TableHead className="hidden md:table-cell">NF</TableHead>
          <TableHead className="hidden lg:table-cell">Vencimento</TableHead>
          <TableHead className="hidden xl:table-cell">Dono</TableHead>
          <TableHead className="text-center hidden sm:table-cell">T</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-medium max-w-[200px]">{c.fornecedor}</TableCell>
            <TableCell>
              <Badge variant={c.status === "ativo" ? "success" : "muted"}>{CONTRATO_STATUS[c.status]}</Badge>
            </TableCell>
            <TableCell className="tabular-nums text-xs text-muted-foreground">
              {new Date(c.data_inicio + "T12:00:00").toLocaleDateString("pt-BR")}
            </TableCell>
            <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
              {c.emissao_nf ? new Date(c.emissao_nf + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
            </TableCell>
            <TableCell className="hidden lg:table-cell text-xs">
              {c.vencimento_tipo === "15_dias" ? "15 dias" : "Automático"}
              {c.vencimento_data && (
                <span className="block text-muted-foreground tabular-nums">
                  {new Date(c.vencimento_data + "T12:00:00").toLocaleDateString("pt-BR")}
                </span>
              )}
            </TableCell>
            <TableCell className="hidden xl:table-cell text-xs">{c.responsavel}</TableCell>
            <TableCell className="text-center hidden sm:table-cell text-[10px] text-muted-foreground">
              {c.testemunha_andressa ? "A" : "—"} / {c.testemunha_ana_paula ? "AP" : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ─── LancamentosKpiStrip ──────────────────────────────────────────────────────
// Mostra KPIs financeiros reais no painel da presidência.
// Atualiza sempre que o financeiro faz upload.

interface LancTotais {
  total_receitas_pagas: number;
  total_despesas_pagas: number;
  total_a_receber: number;
  total_a_pagar: number;
  saldo_realizado: number;
  resultado_projetado: number;
  count_total: number;
}

function LancamentosKpiStrip() {
  const [totais, setTotais] = React.useState<LancTotais | null>(null);
  const [updatedAt, setUpdatedAt] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/lancamentos/resumo", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d?.totais?.[0]) return;
        setTotais(d.totais[0]);
      })
      .catch(() => {});
    fetch("/api/sync/sheets", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d?.last_sync?.finished_at && setUpdatedAt(d.last_sync.finished_at))
      .catch(() => {});
  }, []);

  if (!totais || !totais.count_total) return null;

  const rel = (iso: string) => {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} h atrás`;
    return `${Math.floor(diff / 86400)} dias atrás`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
            Resumo financeiro
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totais.count_total.toLocaleString("pt-BR")} movimentações registradas
            {updatedAt && ` · atualizado ${rel(updatedAt)}`}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <LancKpi
          label="Receitas recebidas"
          value={formatCurrencyBRL(totais.total_receitas_pagas)}
          color="text-emerald-600 dark:text-emerald-400"
        />
        <LancKpi
          label="Despesas pagas"
          value={formatCurrencyBRL(totais.total_despesas_pagas)}
          color="text-rose-600 dark:text-rose-400"
        />
        <LancKpi
          label="Saldo realizado"
          value={formatCurrencyBRL(totais.saldo_realizado)}
          color={totais.saldo_realizado >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}
        />
        <LancKpi
          label="A receber"
          value={formatCurrencyBRL(totais.total_a_receber)}
          color="text-amber-600 dark:text-amber-400"
        />
        <LancKpi
          label="A pagar"
          value={formatCurrencyBRL(totais.total_a_pagar)}
          color="text-orange-600 dark:text-orange-400"
        />
      </div>
    </div>
  );
}

function LancKpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">{label}</p>
      <p className={cn("mt-1.5 text-lg font-semibold tabular-nums leading-none", color)}>{value}</p>
    </Card>
  );
}
