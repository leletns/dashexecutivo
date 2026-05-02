"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Calculator,
  Receipt,
  Users,
  Landmark,
  CheckCircle2,
  Download,
  CalendarClock,
  ShieldCheck,
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
import { ImpostosFolhaChart } from "@/components/dashboard/impostos-folha-chart";
import { useRegisterPageState } from "@/lib/page-state";
import { formatCurrencyBRL } from "@/lib/utils";

type SituacaoCertidao = "regular" | "pendente";

type Certidao = {
  esfera: "Federal" | "Estadual" | "Municipal" | "Trabalhista" | "FGTS";
  orgao: string;
  numero: string;
  emissao: string;
  validade: string;
  situacao: SituacaoCertidao;
};

const CERTIDOES: Certidao[] = [
  { esfera: "Federal", orgao: "Receita federal · PGFN", numero: "CND-FED-2026-00482", emissao: "12/01/2026", validade: "11/07/2026", situacao: "regular" },
  { esfera: "Estadual", orgao: "Sefaz", numero: "CND-EST-2026-00211", emissao: "08/01/2026", validade: "07/07/2026", situacao: "regular" },
  { esfera: "Municipal", orgao: "Prefeitura", numero: "CND-MUN-2026-00117", emissao: "10/01/2026", validade: "10/07/2026", situacao: "regular" },
  { esfera: "Trabalhista", orgao: "TST · CNDT", numero: "CNDT-2026-00388", emissao: "15/01/2026", validade: "15/07/2026", situacao: "regular" },
  { esfera: "FGTS", orgao: "Caixa econômica federal", numero: "CRF-2026-00566", emissao: "05/02/2026", validade: "05/04/2026", situacao: "pendente" },
];

export default function ContabilPage() {
  const [impostos, setImpostos] = React.useState(82_300);
  const [folha, setFolha] = React.useState(64_500);
  const [provisoes, setProvisoes] = React.useState(28_900);
  const [tributario, setTributario] = React.useState(11.4);

  const regulares = CERTIDOES.filter((c) => c.situacao === "regular").length;

  useRegisterPageState({
    module: "Contábil",
    summary: [
      { label: "Impostos", value: formatCurrencyBRL(impostos) },
      { label: "Folha", value: formatCurrencyBRL(folha) },
      { label: "Provisões", value: formatCurrencyBRL(provisoes) },
      { label: "Carga tributária", value: `${tributario}%` },
      { label: "Certidões regulares", value: `${regulares}/${CERTIDOES.length}` },
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
          <h1 className="text-xl font-semibold tracking-tight">Contábil</h1>
          <p className="text-xs text-muted-foreground">
            Apurações, encargos e obrigações fiscais consolidadas
          </p>
        </div>
        <Badge variant="success" className="gap-1.5">
          <ShieldCheck className="h-3 w-3" />
          {regulares} de {CERTIDOES.length} certidões regulares
        </Badge>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiInline
          label="Impostos do mês"
          value={impostos}
          onChange={setImpostos}
          icon={Receipt}
          format="currency"
          hint="DAS, ISS, INSS retido"
          trend={{ delta: 4, label: "vs anterior" }}
        />
        <KpiInline
          label="Folha de pagamento"
          value={folha}
          onChange={setFolha}
          icon={Users}
          format="currency"
          hint="Equipe fixa + encargos"
          trend={{ delta: 2, label: "vs anterior" }}
        />
        <KpiInline
          label="Provisões contábeis"
          value={provisoes}
          onChange={setProvisoes}
          icon={Landmark}
          format="currency"
          hint="Férias, 13º e contingências"
        />
        <KpiInline
          label="Carga tributária efetiva"
          value={tributario}
          onChange={setTributario}
          icon={Calculator}
          format="percent"
          hint="Regime: lucro presumido"
          trend={{ delta: -1, label: "vs benchmark" }}
        />
      </div>

      <ImpostosFolhaChart />

      <Card className="overflow-hidden">
        <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold tracking-tight">
              Certidões negativas
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            Última verificação: hoje, 09:12
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Esfera</TableHead>
              <TableHead>Órgão</TableHead>
              <TableHead>Nº da certidão</TableHead>
              <TableHead className="whitespace-nowrap">Emissão</TableHead>
              <TableHead className="whitespace-nowrap">Validade</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right pr-5">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CERTIDOES.map((c) => (
              <TableRow key={c.numero}>
                <TableCell>
                  <Badge variant="outline">{c.esfera}</Badge>
                </TableCell>
                <TableCell className="font-medium">{c.orgao}</TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {c.numero}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {c.emissao}
                </TableCell>
                <TableCell className="text-muted-foreground tabular-nums">
                  {c.validade}
                </TableCell>
                <TableCell>
                  {c.situacao === "regular" ? (
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Regular
                    </Badge>
                  ) : (
                    <Badge variant="warning">Renovar</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right pr-5">
                  <Button size="sm" variant="ghost" className="h-7 px-2">
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    PDF
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
