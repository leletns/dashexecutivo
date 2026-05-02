"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Scale,
  Lock,
  KeyRound,
  LogOut,
  ShieldCheck,
  FileSignature,
  CircleAlert,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const INSTITUCIONAL: Contrato[] = [
  { numero: "INS-0241", parte: "BRX Consultoria empresarial", objeto: "Assessoria estratégica anual", inicio: "01/02/2026", termino: "31/01/2027", valor: 180000, status: "vigente" },
  { numero: "INS-0238", parte: "Vértice contabilidade", objeto: "Serviços contábeis recorrentes", inicio: "01/01/2025", termino: "31/12/2026", valor: 96000, status: "vigente" },
  { numero: "INS-0226", parte: "Magellan TI", objeto: "Licenciamento ERP corporativo", inicio: "10/03/2024", termino: "10/03/2026", valor: 64000, status: "renovacao" },
  { numero: "INS-0210", parte: "Aliança seguros", objeto: "Apólice empresarial integrada", inicio: "01/06/2024", termino: "31/05/2026", valor: 28500, status: "vigente" },
];

const EVENTOS: Contrato[] = [
  { numero: "EVT-1102", parte: "Centro de convenções Aurora", objeto: "Locação de espaço — 1ª edição", inicio: "12/03/2026", termino: "16/03/2026", valor: 145000, status: "vigente" },
  { numero: "EVT-1108", parte: "Patrocínio Vega Telecom", objeto: "Master sponsor — 2ª edição", inicio: "01/06/2026", termino: "30/06/2026", valor: 320000, status: "vigente" },
  { numero: "EVT-1115", parte: "Atlas produtora audiovisual", objeto: "Cobertura completa de evento", inicio: "10/03/2026", termino: "20/03/2026", valor: 48000, status: "renovacao" },
  { numero: "EVT-1098", parte: "Cia. de catering Solène", objeto: "Operação gastronômica", inicio: "12/03/2026", termino: "16/03/2026", valor: 76200, status: "encerrado" },
];

const TERCEIRO_SETOR: Contrato[] = [
  { numero: "TS-0073", parte: "Instituto Caminhos", objeto: "Convênio de fomento cultural", inicio: "01/03/2026", termino: "31/12/2026", valor: 60000, status: "vigente" },
  { numero: "TS-0068", parte: "Fundação Horizonte", objeto: "Parceria educacional", inicio: "15/02/2026", termino: "15/02/2027", valor: 42000, status: "vigente" },
  { numero: "TS-0061", parte: "ONG Gerar", objeto: "Incentivo via Lei Rouanet", inicio: "01/01/2025", termino: "31/12/2025", valor: 90000, status: "encerrado" },
];

const SECRET_FAKE = "advogado@juridico.com / portal2026";

export default function JuridicoPage() {
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

      <LoginAdvogadoMock />

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
          {rows.map((c) => (
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
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function LoginAdvogadoMock() {
  const [email, setEmail] = React.useState("");
  const [pwd, setPwd] = React.useState("");
  const [hint, setHint] = React.useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = React.useState(false);
  const [signedIn, setSignedIn] = React.useState(false);

  const onLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setSignedIn(true);
    setHint(
      "Acesso liberado em modo demonstração. Em produção, o formulário valida via SSO corporativo e MFA antes de habilitar edição de contratos.",
    );
  };

  const onLogout = () => {
    setSignedIn(false);
    setEmail("");
    setPwd("");
    setHint("Sessão encerrada com sucesso.");
  };

  return (
    <Card className="p-5 overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6 items-center">
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
              Esta área demonstra o ponto de entrada — a CEO mantém visão consolidada
              somente em modo leitura.
            </p>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              SSO corporativo · MFA · auditoria de acesso
            </div>
          </div>
        </div>

        <form onSubmit={onLogin} className="glass rounded-xl p-4 space-y-3">
          <div className="space-y-1.5">
            <label className="text-[11px] text-muted-foreground">E-mail corporativo</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="advogado@juridico.com"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] text-muted-foreground">Senha</label>
            <div className="relative">
              <Input
                type="password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                placeholder="••••••••"
                autoComplete="off"
                className="pr-9"
              />
              <Lock className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setForgotOpen((v) => !v)}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <KeyRound className="h-3.5 w-3.5" />
              Esqueci a senha
            </Button>
            <div className="flex items-center gap-2">
              {signedIn && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onLogout}
                  className="gap-1.5"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sair
                </Button>
              )}
              <Button type="submit" size="sm" className="gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                Acesso do advogado
              </Button>
            </div>
          </div>

          {forgotOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[11px] text-muted-foreground rounded-lg bg-foreground/[0.03] dark:bg-white/[0.03] p-2.5"
            >
              Recuperação enviada para o e-mail informado em até 5 minutos. Em produção,
              o link expira em 15 min e exige validação por MFA.
            </motion.div>
          )}

          {hint && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[11px] text-muted-foreground rounded-lg bg-[hsl(var(--brand-1)/0.10)] p-2.5"
            >
              {hint} <span className="opacity-60">({SECRET_FAKE})</span>
            </motion.div>
          )}
        </form>
      </div>
    </Card>
  );
}
