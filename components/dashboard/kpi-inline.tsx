"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Pencil, Check, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrencyBRL, formatNumberBR, parseLooseNumber } from "@/lib/utils";

type KpiFormat = "currency" | "number" | "percent" | "raw";

export type KpiInlineProps = {
  label: string;
  value: number;
  onChange: (n: number) => void;
  icon?: LucideIcon;
  format?: KpiFormat;
  trend?: { delta: number; label?: string };
  hint?: string;
  suffix?: string;
};

function formatValue(v: number, f: KpiFormat, suffix?: string) {
  if (f === "currency") return formatCurrencyBRL(v);
  if (f === "number") return formatNumberBR(v);
  if (f === "percent") return `${formatNumberBR(v)}%`;
  return `${formatNumberBR(v)}${suffix ?? ""}`;
}

export function KpiInline({
  label,
  value,
  onChange,
  icon: Icon,
  format = "currency",
  trend,
  hint,
  suffix,
}: KpiInlineProps) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const begin = () => {
    setDraft(String(value).replace(".", ","));
    setEditing(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };
  const commit = () => {
    onChange(parseLooseNumber(draft));
    setEditing(false);
  };
  const cancel = () => setEditing(false);

  const trendUp = trend && trend.delta >= 0;

  return (
    <Card className="p-5 group relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="space-y-0.5">
          <div className="text-[12px] font-medium text-muted-foreground tracking-tight">
            {label}
          </div>
          {hint && <div className="text-[11px] text-muted-foreground/70">{hint}</div>}
        </div>
        {Icon && (
          <div className="h-7 w-7 rounded-lg bg-foreground/[0.05] dark:bg-white/[0.06] grid place-items-center text-muted-foreground">
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
      </div>

      <div className="mt-4 min-h-[44px] flex items-end gap-2 justify-between">
        {editing ? (
          <div className="flex items-center gap-2 w-full">
            <Input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") cancel();
              }}
              onBlur={commit}
              inputMode="decimal"
              className="h-10 text-2xl font-semibold tracking-tight tabular-nums px-2"
            />
            <button
              onClick={commit}
              className="h-9 w-9 grid place-items-center rounded-lg bg-foreground text-background"
              aria-label="Salvar"
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={begin}
              className="group/value flex items-center gap-2 text-left"
              aria-label="Editar"
            >
              <motion.span
                key={value}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[24px] font-semibold tracking-tight tabular-nums leading-none"
              >
                {formatValue(value, format, suffix)}
              </motion.span>
              <span className="opacity-0 group-hover/value:opacity-100 transition-opacity text-muted-foreground">
                <Pencil className="h-3.5 w-3.5" />
              </span>
            </button>
            {trend && (
              <Badge
                variant={trendUp ? "success" : "destructive"}
                className={cn("tabular-nums")}
              >
                {trendUp ? "▲" : "▼"} {Math.abs(trend.delta)}%
                {trend.label ? <span className="ml-1 opacity-80">{trend.label}</span> : null}
              </Badge>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
