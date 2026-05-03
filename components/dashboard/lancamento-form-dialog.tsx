"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type FinanceCategoria,
  type FinanceLancamento,
  useAppState,
} from "@/lib/app-state";
import { parseLooseNumber } from "@/lib/utils";

const CATEGORIAS: FinanceCategoria[] = [
  "Patrocínio",
  "Ingressos",
  "Locação",
  "Marketing",
  "Equipe",
  "Catering",
  "Operação",
  "Impostos",
  "Outros",
];

type Mode =
  | { kind: "create"; tipo: "receita" | "despesa" }
  | { kind: "edit"; id: string };

export function LancamentoFormDialog({
  open,
  onOpenChange,
  mode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: Mode;
}) {
  const { state, addLancamento, patchLancamento } = useAppState();
  const editing =
    mode.kind === "edit" ? state.financeiro.find((f) => f.id === mode.id) ?? null : null;
  const tipo = editing?.tipo ?? (mode.kind === "create" ? mode.tipo : "receita");

  const [descricao, setDescricao] = React.useState("");
  const [valor, setValor] = React.useState("");
  const [vencimento, setVencimento] = React.useState("");
  const [pagamento, setPagamento] = React.useState<string>("");
  const [categoria, setCategoria] = React.useState<FinanceCategoria>("Outros");
  const [edicaoSlug, setEdicaoSlug] = React.useState<string>("none");

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setDescricao(editing.descricao);
      setValor(String(editing.valor));
      setVencimento(editing.vencimento);
      setPagamento(editing.pagamento ?? "");
      setCategoria(editing.categoria);
      setEdicaoSlug(editing.edicaoSlug ?? "none");
    } else {
      setDescricao("");
      setValor("");
      setVencimento(new Date().toISOString().slice(0, 10));
      setPagamento("");
      setCategoria(tipo === "receita" ? "Patrocínio" : "Operação");
      setEdicaoSlug("none");
    }
  }, [open, editing, tipo]);

  const submit = () => {
    const valorNum = Math.max(0, Math.round(parseLooseNumber(valor)));
    const desc = descricao.trim() || (tipo === "receita" ? "Receita sem descrição" : "Despesa sem descrição");
    const venc = vencimento || new Date().toISOString().slice(0, 10);
    const pag = pagamento || null;
    const slug = edicaoSlug === "none" ? null : edicaoSlug;

    if (editing) {
      patchLancamento(editing.id, {
        descricao: desc,
        valor: valorNum,
        vencimento: venc,
        pagamento: pag,
        categoria,
        edicaoSlug: slug,
      });
    } else {
      const novo: Omit<FinanceLancamento, "id"> = {
        tipo,
        descricao: desc,
        valor: valorNum,
        vencimento: venc,
        pagamento: pag,
        categoria,
        edicaoSlug: slug,
      };
      addLancamento(novo);
    }
    onOpenChange(false);
  };

  const edicaoOptions: SelectOption[] = [
    { value: "none", label: "Sem edição vinculada", hint: "Lançamento corporativo" },
    ...state.edicoes.map((e) => ({ value: e.slug, label: e.nome, hint: e.data })),
  ];

  const categoriaOptions: SelectOption[] = CATEGORIAS.map((c) => ({ value: c, label: c }));

  const titulo = editing
    ? `Editar ${tipo === "receita" ? "recebimento" : "pagamento"}`
    : tipo === "receita"
      ? "Novo recebimento"
      : "Novo pagamento";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            Preencha os dados do lançamento. Vencimento e pagamento podem ficar separados
            para que apareça em contas a pagar ou já entre como conciliado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Descrição" wide>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Patrocínio Aurora" />
          </Field>
          <Field label="Valor (R$)">
            <Input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0" />
          </Field>
          <Field label="Categoria">
            <Select value={categoria} onValueChange={(v) => setCategoria(v as FinanceCategoria)} options={categoriaOptions} triggerClassName="w-full" />
          </Field>
          <Field label="Vencimento">
            <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
          </Field>
          <Field label="Pagamento" hint="Deixe em branco para manter em aberto">
            <Input type="date" value={pagamento} onChange={(e) => setPagamento(e.target.value)} />
          </Field>
          <Field label="Edição vinculada" wide>
            <Select value={edicaoSlug} onValueChange={setEdicaoSlug} options={edicaoOptions} triggerClassName="w-full" />
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>{editing ? "Salvar" : "Adicionar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={wide ? "space-y-1 block sm:col-span-2" : "space-y-1 block"}>
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-muted-foreground/80 block">{hint}</span>}
    </label>
  );
}
