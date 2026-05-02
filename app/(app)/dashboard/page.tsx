"use client";

import { motion } from "framer-motion";
import { UploadZone } from "@/components/dashboard/upload-zone";
import { EditableCard } from "@/components/dashboard/editable-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { CategoryBarChart } from "@/components/dashboard/category-bar-chart";
import { EditionPieChart } from "@/components/dashboard/edition-pie-chart";
import { AutoConciliacaoSheet } from "@/components/dashboard/auto-conciliacao-sheet";
import { ExportButton } from "@/components/dashboard/export-button";
import { useDashboardContext } from "@/components/dashboard/dashboard-context";

const fade = {
  hidden: { opacity: 0, y: 8 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function VisaoGeralPage() {
  const { cards } = useDashboardContext();

  return (
    <div className="space-y-4">
      <motion.div initial="hidden" animate="show" custom={0} variants={fade}>
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Visão geral</h1>
            <p className="text-xs text-muted-foreground">
              Painel exclusivo da CEO · indicadores consolidados de toda a operação
            </p>
          </div>
          <AutoConciliacaoSheet />
        </div>
      </motion.div>

      <motion.div
        initial="hidden"
        animate="show"
        custom={1}
        variants={fade}
        className="flex flex-col lg:flex-row gap-3 items-stretch"
      >
        <div className="flex-1">
          <UploadZone />
        </div>
        <ExportButton />
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c, i) => (
          <motion.div key={c.key} initial="hidden" animate="show" custom={i + 2} variants={fade}>
            <EditableCard card={c} />
          </motion.div>
        ))}
      </div>

      <motion.div initial="hidden" animate="show" custom={6} variants={fade}>
        <RevenueChart />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-3">
        <motion.div initial="hidden" animate="show" custom={7} variants={fade}>
          <CategoryBarChart />
        </motion.div>
        <motion.div initial="hidden" animate="show" custom={8} variants={fade}>
          <EditionPieChart />
        </motion.div>
      </div>
    </div>
  );
}
