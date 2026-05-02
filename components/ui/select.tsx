"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string; hint?: string };

export function Select({
  value,
  onValueChange,
  options,
  className,
  align = "start",
  triggerClassName,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: SelectOption[];
  className?: string;
  align?: "start" | "center" | "end";
  triggerClassName?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "h-9 inline-flex items-center justify-between gap-2 rounded-xl glass px-3 text-sm min-w-[180px] transition-colors",
            "hover:bg-white/80 dark:hover:bg-white/[0.08]",
            triggerClassName,
          )}
        >
          <span className="truncate">{selected?.label ?? "Selecione"}</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className={cn("p-1.5 w-[var(--radix-popover-trigger-width)]", className)}
      >
        <div className="flex flex-col">
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                onClick={() => {
                  onValueChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm text-left transition-colors",
                  active
                    ? "bg-foreground/[0.06] dark:bg-white/[0.08]"
                    : "hover:bg-foreground/[0.04] dark:hover:bg-white/[0.05]",
                )}
              >
                <div className="min-w-0">
                  <div className="truncate">{opt.label}</div>
                  {opt.hint && (
                    <div className="text-[11px] text-muted-foreground truncate">
                      {opt.hint}
                    </div>
                  )}
                </div>
                {active && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
