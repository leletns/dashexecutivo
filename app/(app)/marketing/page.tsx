"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Megaphone,
  TrendingUp,
  Users,
  Target,
  Plus,
  X,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { KpiInline } from "@/components/dashboard/kpi-inline";
import { useRegisterPageState } from "@/lib/page-state";
import { cn, formatCurrencyBRL, formatNumberBR } from "@/lib/utils";

type Status = "todo" | "doing" | "done";
type Task = {
  id: string;
  title: string;
  owner: string;
  channel: "Instagram" | "LinkedIn" | "Tráfego pago" | "Imprensa" | "Site";
  status: Status;
  priority: "alta" | "média" | "baixa";
};

const COLUMNS: { id: Status; label: string; tone: string; pill: string }[] = [
  { id: "todo", label: "A fazer", tone: "bg-foreground/[0.04]", pill: "bg-foreground/[0.07]" },
  { id: "doing", label: "Em andamento", tone: "bg-[hsl(var(--brand-1)/0.10)]", pill: "bg-[hsl(var(--brand-1)/0.18)]" },
  { id: "done", label: "Concluído", tone: "bg-emerald-500/[0.08]", pill: "bg-emerald-500/[0.15]" },
];

const PRIORITY_VARIANT: Record<Task["priority"], "destructive" | "warning" | "muted"> = {
  alta: "destructive",
  média: "warning",
  baixa: "muted",
};

export default function MarketingPage() {
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");

  const [alcance, setAlcance] = React.useState(0);
  const [conversoes, setConversoes] = React.useState(0);
  const [investimento, setInvestimento] = React.useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  useRegisterPageState({
    module: "Marketing",
    summary: [
      { label: "Alcance", value: formatNumberBR(alcance) },
      { label: "Conversões", value: formatNumberBR(conversoes) },
      { label: "Investimento em mídia", value: formatCurrencyBRL(investimento) },
      { label: "Tarefas em aberto", value: tasks.filter((t) => t.status !== "done").length },
    ],
  });

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const targetStatus = (over.data.current as { status?: Status } | undefined)?.status;
    if (!targetStatus) return;
    setTasks((prev) =>
      prev.map((t) => (t.id === active.id ? { ...t, status: targetStatus } : t)),
    );
  };

  const addTask = (status: Status) => {
    const id = `t${Date.now()}`;
    setTasks((p) => [
      ...p,
      {
        id,
        title: "Nova tarefa",
        owner: "Equipe",
        channel: "Instagram",
        status,
        priority: "média",
      },
    ]);
    setEditingId(id);
    setDraft("Nova tarefa");
  };

  const removeTask = (id: string) =>
    setTasks((p) => p.filter((t) => t.id !== id));

  const beginEditTitle = (t: Task) => {
    setEditingId(t.id);
    setDraft(t.title);
  };
  const commitEditTitle = () => {
    if (!editingId) return;
    setTasks((p) =>
      p.map((t) => (t.id === editingId ? { ...t, title: draft.trim() || t.title } : t)),
    );
    setEditingId(null);
  };

  const activeTask = tasks.find((t) => t.id === activeId) ?? null;

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-end justify-between flex-wrap gap-3"
      >
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Marketing</h1>
          <p className="text-xs text-muted-foreground">
            Performance de campanhas, marca e produção de conteúdo
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiInline
          label="Alcance acumulado"
          value={alcance}
          onChange={setAlcance}
          icon={Users}
          format="number"
          hint="Últimos 30 dias"
          trend={{ delta: 18, label: "vs anterior" }}
        />
        <KpiInline
          label="Conversões qualificadas"
          value={conversoes}
          onChange={setConversoes}
          icon={Target}
          format="number"
          hint="Cadastros + leads VIP"
          trend={{ delta: 12, label: "vs meta" }}
        />
        <KpiInline
          label="Investimento em mídia"
          value={investimento}
          onChange={setInvestimento}
          icon={TrendingUp}
          format="currency"
          hint="CPL médio: R$ 39,75"
          trend={{ delta: -6, label: "vs orçado" }}
        />
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold tracking-tight">
              Quadro de campanhas
            </span>
          </div>
          <Badge variant="muted">
            {tasks.length} tarefas · arraste entre as colunas
          </Badge>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {COLUMNS.map((col) => {
              const colTasks = tasks.filter((t) => t.status === col.id);
              return (
                <Column
                  key={col.id}
                  status={col.id}
                  label={col.label}
                  tone={col.tone}
                  pill={col.pill}
                  count={colTasks.length}
                  onAdd={() => addTask(col.id)}
                >
                  <AnimatePresence initial={false}>
                    {colTasks.map((t) => (
                      <motion.div
                        key={t.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18 }}
                      >
                        <DraggableCard
                          task={t}
                          editing={editingId === t.id}
                          draft={draft}
                          setDraft={setDraft}
                          beginEdit={() => beginEditTitle(t)}
                          commitEdit={commitEditTitle}
                          cancelEdit={() => setEditingId(null)}
                          onRemove={() => removeTask(t.id)}
                          dimmed={activeId === t.id}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {colTasks.length === 0 && (
                    <div className="text-[11px] text-muted-foreground text-center py-6">
                      Solte uma tarefa aqui
                    </div>
                  )}
                </Column>
              );
            })}
          </div>

          <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.22,1,0.36,1)" }}>
            {activeTask ? <CardPreview task={activeTask} floating /> : null}
          </DragOverlay>
        </DndContext>
      </Card>
    </div>
  );
}

function Column({
  status,
  label,
  tone,
  pill,
  count,
  onAdd,
  children,
}: {
  status: Status;
  label: string;
  tone: string;
  pill: string;
  count: number;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col-${status}`,
    data: { status },
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-2xl p-3 min-h-[460px] flex flex-col transition-colors",
        tone,
        isOver && "ring-2 ring-[hsl(var(--brand-1)/0.55)] ring-offset-0",
      )}
    >
      <div className="flex items-center justify-between px-1.5 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold tracking-tight">{label}</span>
          <span
            className={cn(
              "text-[10px] tabular-nums px-1.5 py-0.5 rounded-full text-foreground/80",
              pill,
            )}
          >
            {count}
          </span>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={onAdd}
          aria-label="Nova tarefa"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="space-y-2 flex-1">{children}</div>
    </div>
  );
}

function DraggableCard({
  task,
  editing,
  draft,
  setDraft,
  beginEdit,
  commitEdit,
  cancelEdit,
  onRemove,
  dimmed,
}: {
  task: Task;
  editing: boolean;
  draft: string;
  setDraft: (v: string) => void;
  beginEdit: () => void;
  commitEdit: () => void;
  cancelEdit: () => void;
  onRemove: () => void;
  dimmed?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { task },
    disabled: editing,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "transition-opacity",
        (isDragging || dimmed) && "opacity-30",
      )}
    >
      <CardPreview
        task={task}
        editing={editing}
        draft={draft}
        setDraft={setDraft}
        beginEdit={beginEdit}
        commitEdit={commitEdit}
        cancelEdit={cancelEdit}
        onRemove={onRemove}
        handleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function CardPreview({
  task,
  editing,
  draft,
  setDraft,
  beginEdit,
  commitEdit,
  cancelEdit,
  onRemove,
  handleProps,
  floating,
}: {
  task: Task;
  editing?: boolean;
  draft?: string;
  setDraft?: (v: string) => void;
  beginEdit?: () => void;
  commitEdit?: () => void;
  cancelEdit?: () => void;
  onRemove?: () => void;
  handleProps?: React.HTMLAttributes<HTMLButtonElement>;
  floating?: boolean;
}) {
  return (
    <Card
      className={cn(
        "p-3 group/card",
        floating && "shadow-2xl scale-[1.02] rotate-[-1deg] border-[hsl(var(--brand-1)/0.45)]",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          {...handleProps}
          className="mt-0.5 -ml-1 h-6 w-5 grid place-items-center text-muted-foreground/60 hover:text-foreground cursor-grab active:cursor-grabbing"
          aria-label="Arrastar"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <div className="flex-1 min-w-0">
          {editing ? (
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft?.(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit?.();
                if (e.key === "Escape") cancelEdit?.();
              }}
              className="h-7 text-sm px-2"
            />
          ) : (
            <button
              onClick={beginEdit}
              className="text-sm leading-snug text-left w-full hover:text-foreground"
            >
              {task.title}
            </button>
          )}
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline">{task.channel}</Badge>
            <Badge variant={PRIORITY_VARIANT[task.priority]}>{task.priority}</Badge>
            <span className="text-[11px] text-muted-foreground">· {task.owner}</span>
          </div>
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            className="opacity-0 group-hover/card:opacity-100 transition-opacity h-6 w-6 grid place-items-center rounded-md text-muted-foreground hover:text-foreground"
            aria-label="Remover"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </Card>
  );
}
