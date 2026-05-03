"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type Edicao,
  nextEdicaoSlug,
  corPadraoLote,
  useAppState,
} from "@/lib/app-state";
import { parseLooseNumber } from "@/lib/utils";

type Mode =
  | { kind: "create" }
  | { kind: "edit"; slug: string };

export function EdicaoFormDialog({
  open,
  onOpenChange,
  mode,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: Mode;
  onSaved?: (edicao: Edicao) => void;
}) {
  const { state, upsertEdicao, patchEdicao } = useAppState();
  const editing = mode.kind === "edit" ? state.edicoes.find((e) => e.slug === mode.slug) : null;

  const [nome, setNome] = React.useState("");
  const [cidade, setCidade] = React.useState("");
  const [data, setData] = React.useState("");
  const [capacidade, setCapacidade] = React.useState("");
  const [patrocinio, setPatrocinio] = React.useState("");
  const [custoProducao, setCustoProducao] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setNome(editing.nome);
      setCidade(editing.cidade);
      setData(editing.data);
      setCapacidade(String(editing.capacidade));
      setPatrocinio(String(editing.patrocinio));
      setCustoProducao(String(editing.custoProducao));
    } else {
      const proximaOrdem = state.edicoes.length + 1;
      setNome(`${proximaOrdem}ª edição anual`);
      setCidade("");
      setData("");
      setCapacidade("2000");
      setPatrocinio("0");
      setCustoProducao("0");
    }
  }, [open, editing, state.edicoes.length]);

  const submit = () => {
    const baseLotes = editing?.lotes ?? [
      { nome: "Pista", preco: 280, vendidos: 0, estoque: 1000, cor: corPadraoLote(0) },
      { nome: "Premium", preco: 480, vendidos: 0, estoque: 400, cor: corPadraoLote(1) },
      { nome: "VIP", preco: 950, vendidos: 0, estoque: 150, cor: corPadraoLote(2) },
    ];

    const edicao: Edicao = {
      slug: editing?.slug ?? nextEdicaoSlug(state.edicoes),
      nome: nome.trim() || "Nova edição",
      cidade: cidade.trim() || "Cidade · local",
      data: data.trim() || "Datas a definir",
      capacidade: Math.max(0, Math.round(parseLooseNumber(capacidade))),
      patrocinio: Math.max(0, Math.round(parseLooseNumber(patrocinio))),
      custoProducao: Math.max(0, Math.round(parseLooseNumber(custoProducao))),
      lotes: baseLotes,
    };

    if (editing) {
      patchEdicao(editing.slug, {
        nome: edicao.nome,
        cidade: edicao.cidade,
        data: edicao.data,
        capacidade: edicao.capacidade,
        patrocinio: edicao.patrocinio,
        custoProducao: edicao.custoProducao,
      });
    } else {
      upsertEdicao(edicao);
    }
    onSaved?.(edicao);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar edição" : "Nova edição"}
          </DialogTitle>
          <DialogDescription>
            Defina nome, local, data, capacidade e budget. Os lotes podem ser ajustados
            depois, dentro do painel da edição.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nome da edição">
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: 5ª edição anual" />
          </Field>
          <Field label="Cidade · local">
            <Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Curitiba · Centro de eventos" />
          </Field>
          <Field label="Período" hint="Ex.: 12 a 16 de março de 2026">
            <Input value={data} onChange={(e) => setData(e.target.value)} placeholder="12 a 16 de março de 2026" />
          </Field>
          <Field label="Capacidade total">
            <Input value={capacidade} onChange={(e) => setCapacidade(e.target.value)} inputMode="numeric" />
          </Field>
          <Field label="Patrocínios contratados (R$)">
            <Input value={patrocinio} onChange={(e) => setPatrocinio(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Custo de produção (R$)">
            <Input value={custoProducao} onChange={(e) => setCustoProducao(e.target.value)} inputMode="decimal" />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>
            {editing ? "Salvar alterações" : "Criar edição"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1 block">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-muted-foreground/80 block">{hint}</span>}
    </label>
  );
}
