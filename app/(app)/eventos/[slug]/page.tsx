import { notFound } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { SectionPlaceholder } from "@/components/dashboard/section-placeholder";

const MAP: Record<string, { nome: string; periodo: string }> = {
  "edicao-1": { nome: "1ª edição anual", periodo: "1º trimestre" },
  "edicao-2": { nome: "2ª edição anual", periodo: "2º trimestre" },
  "edicao-3": { nome: "3ª edição anual", periodo: "3º trimestre" },
  "edicao-4": { nome: "4ª edição anual", periodo: "4º trimestre" },
};

export default function EdicaoPage({ params }: { params: { slug: string } }) {
  const ed = MAP[params.slug];
  if (!ed) notFound();
  return (
    <SectionPlaceholder
      icon={<CalendarRange className="h-5 w-5" />}
      title={ed.nome}
      description={`Painel detalhado · ${ed.periodo}`}
    />
  );
}
