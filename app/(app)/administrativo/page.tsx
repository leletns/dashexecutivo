"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
  Pie,
  PieChart,
} from "recharts";
import {
  Building2,
  Users,
  ClipboardList,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Briefcase,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiInline } from "@/components/dashboard/kpi-inline";
import { useRegisterPageState } from "@/lib/page-state";
import { formatCurrencyBRL, formatNumberBR } from "@/lib/utils";

type Status = "concluida" | "andamento" | "atrasada";

type Atividade = {
  titulo: string;
  responsavel: string;
  area: string;
  prazo: string;
  status: Status;
};

const ATIVIDADES: Atividade[] = [];

const STATUS_VARIANT: Record<Status, "success" | "warning" | "destructive"> = {
  concluida: "success",
  andamento: "warning",
  atrasada: "destructive",
};
const STATUS_LABEL: Record<Status, string> = {
  concluida: "Concluída",
  andamento: "Em andamento",
  atrasada: "Atrasada",
};

const HEADCOUNT: { area: string; pessoas: number }[] = [];

const PIE_DESPESAS: { nome: string; valor: number; cor: string }[] = [];

export default function AdministrativoPage() {
  const [colaboradores, setColaboradores] = React.useState(0);
  const [satisfacao, setSatisfacao] = React.useState(0);
  const [reunioes, setReunioes] = React.useState(0);
  const [eficiencia, setEficiencia] = React.useState(0);

  const totalDespesas = PIE_DESPESAS.reduce((acc, d) => acc + d.valor, 0);
  const totalAtrasadas = ATIVIDADES.filter((a) => a.status === "atrasada").length;

  useRegisterPageState({
    module: "Administrativo",
    summary: [
      { label: "Colaboradores", value: formatNumberBR(colaboradores) },
      { label: "Satisfação", value: `${satisfacao}%` },
      { label: "Reuniões", value: formatNumberBR(reunioes) },
      { label: "Eficiência", value: `${eficiencia}%` },
      { label: "Despesas operacionais", value: formatCurrencyBRL(totalDespesas) },
    ],
  });

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-end justify-between flex-wrap gap-3"
      >
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Administrativo</h1>
          <p className="text-xs text-muted-foreground">
            Operação interna, equipes e governança consolidada
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalAtrasadas > 0 && (
            <Badge variant="warning" className="gap-1">
              <CircleAlert className="h-3 w-3" />
              {totalAtrasadas} atividade(s) em atraso
            </Badge>
          )}
          <Badge variant="brand">Visão consolidada</Badge>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiInline
          label="Colaboradores ativos"
          value={colaboradores}
          onChange={setColaboradores}
          icon={Users}
          format="number"
          hint="CLT, PJ e estagiários"
        />
        <KpiInline
          label="Satisfação interna"
          value={satisfacao}
          onChange={setSatisfacao}
          icon={Briefcase}
          format="percent"
          hint="Pesquisa eNPS mensal"
        />
        <KpiInline
          label="Reuniões executivas"
          value={reunioes}
          onChange={setReunioes}
          icon={CalendarClock}
          format="number"
          hint="Realizadas no mês"
        />
        <KpiInline
          label="Eficiência operacional"
          value={eficiencia}
          onChange={setEficiencia}
          icon={ClipboardList}
          format="percent"
          hint="Entregas no prazo"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-3">
        <Card className="overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-semibold tracking-tight">
                  Headcount por área
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Distribuição atual da equipe
                </div>
              </div>
            </div>
            <Badge variant="muted">{HEADCOUNT.reduce((a, b) => a + b.pessoas, 0)} pessoas</Badge>
          </div>
          <div className="pl-2 pr-4 pb-2">
            <div className="h-[260px]">
              {HEADCOUNT.length === 0 ? (
                <div className="h-full mx-3 flex items-center justify-center rounded-xl border border-dashed border-border/70 bg-foreground/[0.02] dark:bg-white/[0.02] text-center text-sm text-muted-foreground px-6">
                  Sem headcount por área. Preencha quando integrar RH ou planilha de pessoal.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={HEADCOUNT} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="bar-hc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--brand-2))" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="hsl(var(--brand-1))" stopOpacity={0.55} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
                    <XAxis
                      dataKey="area"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={36}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="rounded-xl glass-strong px-3 py-2 text-xs shadow-xl">
                            <div className="text-[11px] text-muted-foreground mb-1">
                              {label}
                            </div>
                            <div className="font-medium tabular-nums">
                              {formatNumberBR(Number(payload[0].value))} pessoas
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="pessoas"
                      fill="url(#bar-hc)"
                      radius={[8, 8, 4, 4]}
                      isAnimationActive
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-semibold tracking-tight">
                  Composição das despesas
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Saídas operacionais por natureza
                </div>
              </div>
            </div>
            <Badge variant="muted" className="tabular-nums">
              {formatCurrencyBRL(totalDespesas)}
            </Badge>
          </div>
          <div className="px-2 pr-4">
            <div className="h-[210px]">
              {PIE_DESPESAS.length === 0 ? (
                <div className="h-full mx-3 flex items-center justify-center rounded-xl border border-dashed border-border/70 bg-foreground/[0.02] dark:bg-white/[0.02] text-center text-sm text-muted-foreground px-6">
                  Sem composição de despesas. Alimente a partir do financeiro ou do ERP.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={PIE_DESPESAS}
                      dataKey="valor"
                      nameKey="nome"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={82}
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                      paddingAngle={2}
                    >
                      {PIE_DESPESAS.map((d, i) => (
                        <Cell key={i} fill={d.cor} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0];
                        return (
                          <div className="rounded-xl glass-strong px-3 py-2 text-xs shadow-xl">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: (p.payload as any).cor }}
                              />
                              <span className="text-muted-foreground">{p.name}</span>
                              <span className="font-medium tabular-nums">
                                {formatCurrencyBRL(Number(p.value))}
                              </span>
                            </div>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div className="px-5 pb-5 space-y-1">
            {PIE_DESPESAS.map((d) => {
              const pct =
                totalDespesas > 0 ? Math.round((d.valor / totalDespesas) * 100) : 0;
              return (
                <div key={d.nome} className="flex items-center gap-2 text-[12px]">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: d.cor }}
                  />
                  <span className="text-muted-foreground flex-1 truncate">{d.nome}</span>
                  <span className="tabular-nums font-medium">
                    {formatCurrencyBRL(d.valor)}
                  </span>
                  <span className="w-9 text-right text-muted-foreground tabular-nums">
                    {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold tracking-tight">
              Atividades administrativas
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            Preencha com sua operação ou integração
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Atividade</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Área</TableHead>
              <TableHead className="whitespace-nowrap">Prazo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right pr-5">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ATIVIDADES.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                  Nenhuma atividade cadastrada. Use sua ferramenta de gestão ou importe dados quando estiver disponível.
                </TableCell>
              </TableRow>
            ) : (
              ATIVIDADES.map((a) => (
                <TableRow key={a.titulo}>
                  <TableCell className="font-medium">{a.titulo}</TableCell>
                  <TableCell className="text-muted-foreground">{a.responsavel}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{a.area}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{a.prazo}</TableCell>
                  <TableCell>
                    {a.status === "concluida" ? (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {STATUS_LABEL[a.status]}
                      </Badge>
                    ) : (
                      <Badge variant={STATUS_VARIANT[a.status]}>
                        {STATUS_LABEL[a.status]}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right pr-5">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]">
                      Detalhes
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
