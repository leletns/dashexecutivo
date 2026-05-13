"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, type SelectOption } from "@/components/ui/select";
import { parseLooseNumber } from "@/lib/utils";
import { FormCongressoDisponibilidade } from "@/components/baps/form-congresso-disponibilidade";
import type { PortalSector } from "@/lib/portal-sector";

async function postMutate(kind: string, data: Record<string, unknown>) {
  const res = await fetch("/api/baps/mutate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, data }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Falha ao gravar");
}

const TABS_POR_SETOR: Record<PortalSector, string[]> = {
  executivo: ["contratos", "processos", "certidoes", "financeiro", "congresso", "associados", "institucional"],
  juridico: ["contratos", "processos", "certidoes"],
  financeiro: ["financeiro", "associados"],
  contabil: ["financeiro"],
  administrativo: ["institucional", "certidoes"],
  eventos: ["congresso"],
  marketing: [],
};

const TAB_LABELS: Record<string, string> = {
  contratos: "Contratos",
  processos: "Processos",
  certidoes: "Certidões",
  financeiro: "Financeiro",
  congresso: "5º Congresso",
  associados: "Associados",
  institucional: "Institucional",
};

export function EntradaDadosClient({ sector }: { sector: PortalSector }) {
  const visibleTabs = TABS_POR_SETOR[sector];
  const defaultTab = visibleTabs[0];

  return (
    <div className="space-y-6 pb-16 max-w-4xl mx-auto print:hidden">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-3 w-3" />
            Voltar ao painel
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">Inserir dados</h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-lg leading-relaxed">
            Preencha os formulários abaixo para atualizar o painel da sua área.
          </p>
        </div>
      </div>

      {visibleTabs.length === 0 ? (
        <Card className="p-6 rounded-2xl border-border/60 text-sm text-muted-foreground">
          Sua área não usa este formulário. Use o editor da sua página para atualizar os dados.
        </Card>
      ) : (
        <Tabs defaultValue={defaultTab}>
          <TabsList className="flex flex-wrap h-auto gap-1 p-1">
            {visibleTabs.map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {TAB_LABELS[tab]}
              </TabsTrigger>
            ))}
          </TabsList>

          {visibleTabs.includes("contratos") && (
            <TabsContent value="contratos" className="mt-4">
              <FormContrato />
            </TabsContent>
          )}
          {visibleTabs.includes("processos") && (
            <TabsContent value="processos" className="mt-4">
              <FormProcesso />
            </TabsContent>
          )}
          {visibleTabs.includes("certidoes") && (
            <TabsContent value="certidoes" className="mt-4">
              <FormCertidao />
            </TabsContent>
          )}
          {visibleTabs.includes("financeiro") && (
            <TabsContent value="financeiro" className="mt-4">
              <div className="space-y-4">
                <FormFinanceiroResumo />
                <FormFinanceiroEvento />
              </div>
            </TabsContent>
          )}
          {visibleTabs.includes("congresso") && (
            <TabsContent value="congresso" className="mt-4">
              <FormCongressoDisponibilidade />
            </TabsContent>
          )}
          {visibleTabs.includes("associados") && (
            <TabsContent value="associados" className="mt-4">
              <FormAssociados />
            </TabsContent>
          )}
          {visibleTabs.includes("institucional") && (
            <TabsContent value="institucional" className="mt-4">
              <FormInstitucional />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}

function FormContrato() {
  const [busy, setBusy] = React.useState(false);
  const [fornecedor, setFornecedor] = React.useState("");
  const [status, setStatus] = React.useState("demanda");
  const [dataInicio, setDataInicio] = React.useState("");
  const [emissaoNf, setEmissaoNf] = React.useState("");
  const [vencTipo, setVencTipo] = React.useState("automatico");
  const [vencData, setVencData] = React.useState("");
  const [responsavel, setResponsavel] = React.useState("");
  const [ta, setTa] = React.useState(false);
  const [tap, setTap] = React.useState(false);
  const [decisao, setDecisao] = React.useState("");
  const [destaque, setDestaque] = React.useState(false);

  const opts: SelectOption[] = [
    { value: "demanda", label: "Demanda" },
    { value: "em_elaboracao", label: "Em elaboração" },
    { value: "gestao_assinaturas", label: "Gestão / assinaturas" },
    { value: "ativo", label: "Ativo" },
  ];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fornecedor.trim() || !dataInicio) {
      toast.error("Preencha fornecedor e data de início.");
      return;
    }
    setBusy(true);
    try {
      await postMutate("contrato", {
        fornecedor: fornecedor.trim(),
        status,
        data_inicio: dataInicio,
        emissao_nf: emissaoNf || null,
        vencimento_tipo: vencTipo,
        vencimento_data: vencData || null,
        responsavel: responsavel.trim(),
        testemunha_andressa: ta,
        testemunha_ana_paula: tap,
        decisao_notas: decisao.trim() || null,
        destaque_risco: destaque,
      });
      toast.success("Contrato registrado.");
      setFornecedor("");
      setDecisao("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5 sm:p-6 rounded-2xl border-border/60">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Fornecedor">
          <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} required />
        </Field>
        <Field label="Status">
          <Select value={status} onValueChange={setStatus} options={opts} triggerClassName="w-full min-w-0" />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Data de início">
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} required />
          </Field>
          <Field label="Emissão NF (opcional)">
            <Input type="date" value={emissaoNf} onChange={(e) => setEmissaoNf(e.target.value)} />
          </Field>
        </div>
        <Field label="Vencimento">
          <Select
            value={vencTipo}
            onValueChange={setVencTipo}
            options={[
              { value: "automatico", label: "Automático" },
              { value: "15_dias", label: "15 dias" },
            ]}
            triggerClassName="w-full min-w-0"
          />
        </Field>
        <Field label="Data vencimento (se aplicável)">
          <Input type="date" value={vencData} onChange={(e) => setVencData(e.target.value)} />
        </Field>
        <Field label="Responsável (dono)">
          <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
        </Field>
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={ta} onChange={(e) => setTa(e.target.checked)} className="rounded border-input" />
            Testemunha Andressa
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={tap} onChange={(e) => setTap(e.target.checked)} className="rounded border-input" />
            Testemunha Ana Paula
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={destaque} onChange={(e) => setDestaque(e.target.checked)} className="rounded border-input" />
            Destaque de risco / minuta não habitual
          </label>
        </div>
        <Field label="Decisões / notas">
          <Textarea value={decisao} onChange={(e) => setDecisao(e.target.value)} placeholder="Resumo executivo da decisão…" />
        </Field>
        <Button type="submit" disabled={busy} className="rounded-xl">
          {busy ? "Gravando…" : "Inserir contrato"}
        </Button>
      </form>
    </Card>
  );
}

function FormProcesso() {
  const [busy, setBusy] = React.useState(false);
  const [tipo, setTipo] = React.useState("judicial");
  const [parte, setParte] = React.useState("");
  const [numero, setNumero] = React.useState("");
  const [tribunal, setTribunal] = React.useState("");
  const [fase, setFase] = React.useState("inicial");
  const [escritorio, setEscritorio] = React.useState("Escritório Meyer");
  const [atualizacao, setAtualizacao] = React.useState("");
  const [risco, setRisco] = React.useState("medio");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parte.trim()) {
      toast.error("Informe a parte envolvida.");
      return;
    }
    setBusy(true);
    try {
      await postMutate("processo", {
        tipo,
        parte_envolvida: parte.trim(),
        numero,
        tribunal,
        fase,
        responsavel_escritorio: escritorio,
        atualizacao_semanal: atualizacao,
        nivel_risco: risco,
      });
      toast.success("Processo registrado.");
      setParte("");
      setNumero("");
      setAtualizacao("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5 sm:p-6 rounded-2xl border-border/60">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Tipo">
            <Select
              value={tipo}
              onValueChange={setTipo}
              options={[
                { value: "judicial", label: "Judicial" },
                { value: "extrajudicial", label: "Extrajudicial" },
              ]}
              triggerClassName="w-full min-w-0"
            />
          </Field>
          <Field label="Nível de risco">
            <Select
              value={risco}
              onValueChange={setRisco}
              options={[
                { value: "baixo", label: "Baixo" },
                { value: "medio", label: "Médio" },
                { value: "alto", label: "Alto" },
              ]}
              triggerClassName="w-full min-w-0"
            />
          </Field>
        </div>
        <Field label="Parte envolvida">
          <Input value={parte} onChange={(e) => setParte(e.target.value)} required />
        </Field>
        <Field label="Número">
          <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
        </Field>
        <Field label="Tribunal / órgão">
          <Input value={tribunal} onChange={(e) => setTribunal(e.target.value)} placeholder="Use — se extrajudicial" />
        </Field>
        <Field label="Fase">
          <Select
            value={fase}
            onValueChange={setFase}
            options={[
              { value: "inicial", label: "Inicial" },
              { value: "andamento", label: "Andamento" },
              { value: "julgado", label: "Julgado" },
              { value: "finalizado", label: "Finalizado" },
            ]}
            triggerClassName="w-full min-w-0"
          />
        </Field>
        <Field label="Responsável (escritório)">
          <Input value={escritorio} onChange={(e) => setEscritorio(e.target.value)} />
        </Field>
        <Field label="Atualização semanal">
          <Textarea value={atualizacao} onChange={(e) => setAtualizacao(e.target.value)} />
        </Field>
        <Button type="submit" disabled={busy} className="rounded-xl">
          {busy ? "Gravando…" : "Inserir processo"}
        </Button>
      </form>
    </Card>
  );
}

function FormCertidao() {
  const [busy, setBusy] = React.useState(false);
  const [nome, setNome] = React.useState("");
  const [ultima, setUltima] = React.useState("");
  const [proxima, setProxima] = React.useState("");
  const [pendencia, setPendencia] = React.useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !ultima || !proxima) {
      toast.error("Nome e datas são obrigatórios.");
      return;
    }
    setBusy(true);
    try {
      await postMutate("certidao", {
        nome: nome.trim(),
        data_ultima_emissao: ultima,
        previsao_proxima: proxima,
        status_pendencia: pendencia.trim(),
      });
      toast.success("Certidão registrada.");
      setNome("");
      setPendencia("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5 sm:p-6 rounded-2xl border-border/60">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nome da certidão">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Última emissão">
            <Input type="date" value={ultima} onChange={(e) => setUltima(e.target.value)} required />
          </Field>
          <Field label="Previsão próxima">
            <Input type="date" value={proxima} onChange={(e) => setProxima(e.target.value)} required />
          </Field>
        </div>
        <Field label="Status de pendência">
          <Textarea value={pendencia} onChange={(e) => setPendencia(e.target.value)} />
        </Field>
        <Button type="submit" disabled={busy} className="rounded-xl">
          {busy ? "Gravando…" : "Inserir certidão"}
        </Button>
      </form>
    </Card>
  );
}

function FormFinanceiroResumo() {
  const [busy, setBusy] = React.useState(false);
  const [saldo, setSaldo] = React.useState("1190000");
  const [deficit, setDeficit] = React.useState("-25900");
  const [contas, setContas] = React.useState("");
  const [pendencias, setPendencias] = React.useState("");
  const [inad, setInad] = React.useState("");
  const [ref, setRef] = React.useState("mar/2026");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await postMutate("financeiro_resumo", {
        saldo_global: parseLooseNumber(saldo),
        deficit_q1: parseLooseNumber(deficit),
        contas_bancarias: contas,
        pendencias,
        inadimplencia_patrocinadores: inad,
        referencia_mes: ref,
      });
      toast.success("Resumo financeiro atualizado.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5 sm:p-6 rounded-2xl border-border/60">
      <h2 className="text-sm font-semibold mb-4">Resumo financeiro</h2>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Saldo global (R$)">
            <Input value={saldo} onChange={(e) => setSaldo(e.target.value)} />
          </Field>
          <Field label="Resultado do período (R$)">
            <Input value={deficit} onChange={(e) => setDeficit(e.target.value)} />
          </Field>
        </div>
        <Field label="Contas bancárias (texto)">
          <Textarea value={contas} onChange={(e) => setContas(e.target.value)} />
        </Field>
        <Field label="Pendências">
          <Textarea value={pendencias} onChange={(e) => setPendencias(e.target.value)} />
        </Field>
        <Field label="Inadimplência patrocinadores">
          <Textarea value={inad} onChange={(e) => setInad(e.target.value)} />
        </Field>
        <Field label="Referência (mês/ano)">
          <Input value={ref} onChange={(e) => setRef(e.target.value)} />
        </Field>
        <Button type="submit" disabled={busy} className="rounded-xl">
          {busy ? "Gravando…" : "Salvar resumo"}
        </Button>
      </form>
    </Card>
  );
}

function FormFinanceiroEvento() {
  const [busy, setBusy] = React.useState(false);
  const [nome, setNome] = React.useState("");
  const [cidade, setCidade] = React.useState("");
  const [rec, setRec] = React.useState("");
  const [desp, setDesp] = React.useState("");
  const [ref, setRef] = React.useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Nome do evento é obrigatório.");
      return;
    }
    setBusy(true);
    try {
      await postMutate("financeiro_evento_save", {
        nome_evento: nome.trim(),
        cidade,
        receitas: parseLooseNumber(rec),
        despesas_pagas: parseLooseNumber(desp),
        referencia: ref,
      });
      toast.success("Evento gravado (novo ou atualizado pelo nome).");
      setNome("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5 sm:p-6 rounded-2xl border-border/60">
      <h2 className="text-sm font-semibold mb-4">Receitas e despesas por evento</h2>
      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
        Se já existir um evento com o mesmo nome, os valores são <strong className="text-foreground font-medium">substituídos</strong>.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nome do evento">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
        </Field>
        <Field label="Cidade">
          <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Receitas (R$)">
            <Input value={rec} onChange={(e) => setRec(e.target.value)} />
          </Field>
          <Field label="Despesas pagas (R$)">
            <Input value={desp} onChange={(e) => setDesp(e.target.value)} />
          </Field>
        </div>
        <Field label="Referência / notas">
          <Input value={ref} onChange={(e) => setRef(e.target.value)} />
        </Field>
        <Button type="submit" disabled={busy} className="rounded-xl">
          {busy ? "Gravando…" : "Salvar evento"}
        </Button>
      </form>
    </Card>
  );
}

function FormAssociados() {
  const [busy, setBusy] = React.useState(false);
  const [total, setTotal] = React.useState("428");
  const [venc, setVenc] = React.useState("36");
  const [mes, setMes] = React.useState("2");
  const [sem, setSem] = React.useState("2");
  const [ytd, setYtd] = React.useState("18");
  const [notas, setNotas] = React.useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await postMutate("associados_resumo", {
        total_ativos: Math.round(parseLooseNumber(total)),
        vencimentos_mes: Math.round(parseLooseNumber(venc)),
        saidas_mes: Math.round(parseLooseNumber(mes)),
        saidas_semana: Math.round(parseLooseNumber(sem)),
        saidas_ytd: Math.round(parseLooseNumber(ytd)),
        notas_comercial: notas,
      });
      toast.success("Indicadores de associados atualizados.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5 sm:p-6 rounded-2xl border-border/60">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Total ativos">
            <Input value={total} onChange={(e) => setTotal(e.target.value)} />
          </Field>
          <Field label="Vencimentos do mês">
            <Input value={venc} onChange={(e) => setVenc(e.target.value)} />
          </Field>
          <Field label="Saídas no mês">
            <Input value={mes} onChange={(e) => setMes(e.target.value)} />
          </Field>
          <Field label="Saídas na semana">
            <Input value={sem} onChange={(e) => setSem(e.target.value)} />
          </Field>
          <Field label="Saídas no ano">
            <Input value={ytd} onChange={(e) => setYtd(e.target.value)} />
          </Field>
        </div>
        <Field label="Notas">
          <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} />
        </Field>
        <Button type="submit" disabled={busy} className="rounded-xl">
          {busy ? "Gravando…" : "Salvar associados"}
        </Button>
      </form>
    </Card>
  );
}

function FormInstitucional() {
  const [busy, setBusy] = React.useState(false);
  const [atas, setAtas] = React.useState(true);
  const [statuto, setStatuto] = React.useState("");
  const [assembleia, setAssembleia] = React.useState("");
  const [regimento, setRegimento] = React.useState(true);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await postMutate("institucional", {
        atas_procuracoes_ok: atas,
        status_estatutario: statuto,
        proxima_assembleia: assembleia || null,
        regimento_interno_ok: regimento,
      });
      toast.success("Institucional atualizado.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5 sm:p-6 rounded-2xl border-border/60">
      <form onSubmit={submit} className="space-y-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={atas} onChange={(e) => setAtas(e.target.checked)} className="rounded border-input" />
          Atas e procurações em ordem
        </label>
        <Field label="Situação estatutária">
          <Textarea value={statuto} onChange={(e) => setStatuto(e.target.value)} />
        </Field>
        <Field label="Data próxima assembleia">
          <Input type="date" value={assembleia} onChange={(e) => setAssembleia(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={regimento} onChange={(e) => setRegimento(e.target.checked)} className="rounded border-input" />
          Regimento interno atualizado
        </label>
        <Button type="submit" disabled={busy} className="rounded-xl">
          {busy ? "Gravando…" : "Salvar institucional"}
        </Button>
      </form>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
