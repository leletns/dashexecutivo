"use client";

import { motion } from "framer-motion";
import {
  Scale,
  ShieldCheck,
  FileSignature,
  CircleAlert,
  Info,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrencyBRL } from "@/lib/utils";
import { useRegisterPageState } from "@/lib/page-state";

type Status = "vigente" | "renovacao" | "encerrado";

type Contrato = {
  numero: string;
  parte: string;
  objeto: string;
  inicio: string;
  termino: string;
  valor: number;
  status: Status;
};

const STATUS_VARIANT: Record<Status, "success" | "warning" | "muted"> = {
  vigente: "success",
  renovacao: "warning",
  encerrado: "muted",
};

const STATUS_LABEL: Record<Status, string> = {
  vigente: "Vigente",
  renovacao: "Em renovação",
  encerrado: "Encerrado",
};

const INSTITUCIONAL: Contrato[] = [];

const EVENTOS: Contrato[] = [];

const TERCEIRO_SETOR: Contrato[] = [];

export default function JuridicoPage() {
  const carteira =
    INSTITUCIONAL.reduce((a, c) => a + c.valor, 0) +
    EVENTOS.reduce((a, c) => a + c.valor, 0) +
    TERCEIRO_SETOR.reduce((a, c) => a + c.valor, 0);
  const total =
    INSTITUCIONAL.length + EVENTOS.length + TERCEIRO_SETOR.length;
  const renovacao = [...INSTITUCIONAL, ...EVENTOS, ...TERCEIRO_SETOR].filter(
    (c) => c.status === "renovacao",
  ).length;

  useRegisterPageState({
    module: "Jurídico",
    summary: [
      { label: "Contratos", value: total },
      { label: "Carteira", value: formatCurrencyBRL(carteira) },
      { label: "Em renovação", value: renovacao },
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
          <h1 className="text-xl font-semibold tracking-tight">Jurídico</h1>
          <p className="text-xs text-muted-foreground">
            Contratos, compliance e governança contratual
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="brand" className="gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            Acesso restrito · perfil jurídico
          </Badge>
        </div>
      </motion.div>

      <AcessoJuridicoPanel />

      <Tabs defaultValue="institucional">
        <TabsList>
          <TabsTrigger value="institucional">Institucional</TabsTrigger>
          <TabsTrigger value="eventos">Eventos</TabsTrigger>
          <TabsTrigger value="terceiro">Terceiro setor</TabsTrigger>
        </TabsList>

        <TabsContent value="institucional">
          <ContratosTable rows={INSTITUCIONAL} titulo="Contratos institucionais" />
        </TabsContent>
        <TabsContent value="eventos">
          <ContratosTable rows={EVENTOS} titulo="Contratos de eventos" />
        </TabsContent>
        <TabsContent value="terceiro">
          <ContratosTable rows={TERCEIRO_SETOR} titulo="Convênios e parcerias" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ContratosTable({ rows, titulo }: { rows: Contrato[]; titulo: string }) {
  const total = rows.reduce((acc, r) => acc + r.valor, 0);
  const renovacao = rows.filter((r) => r.status === "renovacao").length;
  return (
    <Card className="overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileSignature className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold tracking-tight">{titulo}</span>
        </div>
        <div className="flex items-center gap-2">
          {renovacao > 0 && (
            <Badge variant="warning" className="gap-1">
              <CircleAlert className="h-3 w-3" />
              {renovacao} em renovação
            </Badge>
          )}
          <Badge variant="muted">Carteira: {formatCurrencyBRL(total)}</Badge>
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[110px]">Nº</TableHead>
            <TableHead>Parte / fornecedor</TableHead>
            <TableHead>Objeto</TableHead>
            <TableHead>Vigência</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-right pr-5">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                Nenhum contrato cadastrado. Preencha esta lista a partir do seu sistema jurídico ou planilha
                de controle.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((c) => (
              <TableRow key={c.numero}>
                <TableCell className="font-medium tabular-nums text-muted-foreground">
                  {c.numero}
                </TableCell>
                <TableCell className="font-medium">{c.parte}</TableCell>
                <TableCell className="text-muted-foreground">{c.objeto}</TableCell>
                <TableCell className="text-muted-foreground tabular-nums whitespace-nowrap">
                  {c.inicio} → {c.termino}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {formatCurrencyBRL(c.valor)}
                </TableCell>
                <TableCell className="text-right pr-5">
                  <Badge variant={STATUS_VARIANT[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}

function AcessoJuridicoPanel() {
  return (
    <Card className="p-5 overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6 items-start">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-[hsl(var(--brand-1)/0.15)] grid place-items-center text-[hsl(var(--brand-2))] dark:text-[hsl(var(--brand-3))]">
            <Scale className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight">
              Acesso do advogado
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Edição de contratos, parecer jurídico e descarga de documentos sensíveis
              ficam restritos a usuários com perfil <span className="font-medium text-foreground">jurídico</span>.
              A CEO pode manter visão consolidada em modo leitura após a integração com seu provedor de identidade.
            </p>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              SSO corporativo · MFA · auditoria de acesso
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-4 space-y-3 text-xs text-muted-foreground leading-relaxed">
          <div className="flex items-center gap-2 text-foreground font-medium text-sm">
            <Info className="h-4 w-4 shrink-0 text-[hsl(var(--brand-2))]" />
            Como funciona o acesso
          </div>
          <ul className="list-disc pl-4 space-y-2">
            <li>
              Este painel não autentica usuários: o login real fica no provedor de identidade da empresa (por
              exemplo Microsoft Entra ou Google Workspace).
            </li>
            <li>
              Quem pode editar ou baixar documentos sensíveis deve ser definido pela TI com SSO e MFA; aqui você
              apenas consulta e organiza a visão da carteira.
            </li>
            <li>
              Preencha as tabelas abaixo com dados vindos do seu controle jurídico ou ERP, ou integre via API quando
              estiver disponível.
            </li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
