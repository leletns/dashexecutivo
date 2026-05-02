"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Calculator as CalcIcon, Delete } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Op = "+" | "-" | "×" | "÷";

export function CalculatorPopover() {
  const [display, setDisplay] = React.useState("0");
  const [previous, setPrevious] = React.useState<number | null>(null);
  const [op, setOp] = React.useState<Op | null>(null);
  const [overwrite, setOverwrite] = React.useState(true);

  const inputDigit = (d: string) => {
    if (overwrite) {
      setDisplay(d === "," ? "0," : d);
      setOverwrite(false);
      return;
    }
    if (d === "," && display.includes(",")) return;
    setDisplay((p) => (p === "0" && d !== "," ? d : p + d));
  };

  const compute = (a: number, b: number, o: Op) => {
    switch (o) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "×":
        return a * b;
      case "÷":
        return b === 0 ? 0 : a / b;
    }
  };

  const toNumber = (s: string) => Number(s.replace(",", "."));
  const toDisplay = (n: number) =>
    Number.isInteger(n) ? String(n) : n.toLocaleString("pt-BR", { maximumFractionDigits: 8 });

  const setOperation = (next: Op) => {
    const current = toNumber(display);
    if (previous === null) setPrevious(current);
    else if (op) {
      const result = compute(previous, current, op);
      setPrevious(result);
      setDisplay(toDisplay(result));
    }
    setOp(next);
    setOverwrite(true);
  };

  const equals = () => {
    if (op === null || previous === null) return;
    const result = compute(previous, toNumber(display), op);
    setDisplay(toDisplay(result));
    setPrevious(null);
    setOp(null);
    setOverwrite(true);
  };

  const clearAll = () => {
    setDisplay("0");
    setPrevious(null);
    setOp(null);
    setOverwrite(true);
  };

  const backspace = () => {
    if (overwrite) return;
    setDisplay((p) => (p.length <= 1 ? "0" : p.slice(0, -1)));
  };

  const Key = ({
    label,
    onClick,
    className,
    accent,
  }: {
    label: React.ReactNode;
    onClick: () => void;
    className?: string;
    accent?: "op" | "fn" | "eq";
  }) => (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      className={cn(
        "h-10 rounded-xl text-sm font-medium transition-colors",
        "bg-foreground/[0.04] hover:bg-foreground/[0.08] dark:bg-white/[0.04] dark:hover:bg-white/[0.08]",
        accent === "op" &&
          "bg-foreground/[0.07] dark:bg-white/[0.08] text-foreground",
        accent === "fn" && "text-muted-foreground",
        accent === "eq" &&
          "bg-foreground text-background hover:bg-foreground/90 col-span-1",
        className,
      )}
    >
      {label}
    </motion.button>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="glass" size="icon" aria-label="Abrir calculadora">
          <CalcIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="rounded-xl bg-foreground/[0.03] dark:bg-white/[0.03] px-4 py-3 text-right">
          <div className="text-[11px] text-muted-foreground h-4">
            {previous !== null ? `${toDisplay(previous)} ${op ?? ""}` : "\u00A0"}
          </div>
          <div className="text-2xl font-semibold tracking-tight tabular-nums truncate">
            {display}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          <Key label="C" onClick={clearAll} accent="fn" />
          <Key label={<Delete className="h-4 w-4 mx-auto" />} onClick={backspace} accent="fn" />
          <Key label="%" onClick={() => setDisplay(toDisplay(toNumber(display) / 100))} accent="fn" />
          <Key label="÷" onClick={() => setOperation("÷")} accent="op" />

          <Key label="7" onClick={() => inputDigit("7")} />
          <Key label="8" onClick={() => inputDigit("8")} />
          <Key label="9" onClick={() => inputDigit("9")} />
          <Key label="×" onClick={() => setOperation("×")} accent="op" />

          <Key label="4" onClick={() => inputDigit("4")} />
          <Key label="5" onClick={() => inputDigit("5")} />
          <Key label="6" onClick={() => inputDigit("6")} />
          <Key label="−" onClick={() => setOperation("-")} accent="op" />

          <Key label="1" onClick={() => inputDigit("1")} />
          <Key label="2" onClick={() => inputDigit("2")} />
          <Key label="3" onClick={() => inputDigit("3")} />
          <Key label="+" onClick={() => setOperation("+")} accent="op" />

          <Key label="0" onClick={() => inputDigit("0")} className="col-span-2" />
          <Key label="," onClick={() => inputDigit(",")} />
          <Key label="=" onClick={equals} accent="eq" />
        </div>
      </PopoverContent>
    </Popover>
  );
}
