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

const CERTIDOES: Certidao[] = [];

export default function ContabilPage() {
  const [impostos, setImpostos] = React.useState(0);
  const [folha, setFolha] = React.useState(0);
  const [provisoes, setProvisoes] = React.useState(0);
  const [tributario, setTributario] = React.useState(0);

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
        <Badge
          variant={CERTIDOES.length === 0 ? "outline" : "success"}
          className="gap-1.5"
        >
          <ShieldCheck className="h-3 w-3" />
          {CERTIDOES.length === 0
            ? "Nenhuma certidão cadastrada"
            : `${regulares} de ${CERTIDOES.length} certidões regulares`}
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
        />
        <KpiInline
          label="Folha de pagamento"
          value={folha}
          onChange={setFolha}
          icon={Users}
          format="currency"
          hint="Equipe fixa + encargos"
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
          hint="Percentual sobre a base apurada"
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
            Preencha após integração com certidões online
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
            {CERTIDOES.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                  Nenhuma certidão listada. Importe ou conecte o serviço de consulta da contabilidade.
                </TableCell>
              </TableRow>
            ) : (
              CERTIDOES.map((c) => (
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
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
