import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requirePortalSession } from "@/lib/auth-server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-6";
const ANTHROPIC_VERSION = "2023-06-01";

type Imported = {
  cards?: Partial<{
    receita: number;
    despesa: number;
    lucro: number;
    ticket: number;
  }>;
  series?: Array<{
    month: string;
    receita: number;
    despesa: number;
    lucro: number;
  }>;
};

const SYSTEM_PROMPT = `Você é um motor de extração de indicadores financeiros executivos.
Receberá dados brutos: trechos de texto extraídos de planilhas, CSVs ou PDFs;
e/ou imagens (prints de dashboards, recibos, relatórios escaneados).
Sua tarefa é devolver APENAS um JSON válido (sem markdown, sem comentários) com a forma:

{
  "cards": {
    "receita": number,
    "despesa": number,
    "lucro": number,
    "ticket": number
  },
  "series": [
    { "month": "Jan", "receita": number, "despesa": number, "lucro": number }
  ]
}

Regras:
- Valores em reais (BRL), inteiros, sem separadores.
- "lucro" deve ser igual a "receita" - "despesa" quando possível.
- Use no máximo 12 pontos em "series" (Jan..Dez).
- Quando estiver lendo uma imagem, extraia números visíveis em cards/tabelas/gráficos.
- Se algum campo não for inferível, omita-o.
- Não inclua nenhum texto além do JSON.`;

export async function POST(req: Request) {
  try {
    const portal = await requirePortalSession();
    if (!portal) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Arquivo ausente" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const kind = classifyFile(file);
    let imported: Imported;

    if (apiKey) {
      if (kind === "image") {
        imported = await runVisionExtraction(apiKey, file);
      } else {
        const raw = await extractText(file, kind);
        if (raw.trim().length === 0) {
          imported = simulatedFallback(file.name);
        } else {
          imported = await runTextExtraction(apiKey, raw, file.name);
        }
      }
    } else {
      imported = simulatedFallback(file.name);
    }

    return NextResponse.json(imported);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Falha no processamento" },
      { status: 500 },
    );
  }
}

type FileKind = "pdf" | "spreadsheet" | "csv" | "image" | "text";

function classifyFile(file: File): FileKind {
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  if (type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(name)) return "image";
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    type.includes("spreadsheet") ||
    type.includes("excel") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xls")
  )
    return "spreadsheet";
  if (type === "text/csv" || name.endsWith(".csv")) return "csv";
  return "text";
}

async function extractText(file: File, kind: FileKind): Promise<string> {
  const buf = Buffer.from(await file.arrayBuffer());

  if (kind === "pdf") {
    try {
      const pdfParse = (await import("pdf-parse")).default;
      const out = await pdfParse(buf);
      return out.text ?? "";
    } catch {
      return "";
    }
  }

  if (kind === "spreadsheet") {
    const wb = XLSX.read(buf, { type: "buffer" });
    const parts: string[] = [];
    for (const sheet of wb.SheetNames) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheet]);
      parts.push(`# ${sheet}\n${csv}`);
    }
    return parts.join("\n\n").slice(0, 60_000);
  }

  if (kind === "csv" || kind === "text") {
    return buf.toString("utf-8").slice(0, 60_000);
  }

  return "";
}

function makeClient(apiKey: string) {
  return new Anthropic({
    apiKey,
    defaultHeaders: { "anthropic-version": ANTHROPIC_VERSION },
  });
}

async function runTextExtraction(
  apiKey: string,
  rawText: string,
  filename: string,
): Promise<Imported> {
  const client = makeClient(apiKey);

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Arquivo: ${filename}\n\nConteúdo bruto:\n${rawText.slice(0, 50_000)}\n\nDevolva apenas o JSON.`,
          },
        ],
      },
    ],
  });

  return finalize(message, filename);
}

async function runVisionExtraction(apiKey: string, file: File): Promise<Imported> {
  const client = makeClient(apiKey);
  const buf = Buffer.from(await file.arrayBuffer());
  const base64 = buf.toString("base64");
  const media = mediaType(file);

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: media,
              data: base64,
            },
          },
          {
            type: "text",
            text: `Imagem: ${file.name}. Extraia os números visíveis e devolva apenas o JSON descrito.`,
          },
        ],
      },
    ],
  });

  return finalize(message, file.name);
}

function mediaType(file: File): "image/png" | "image/jpeg" | "image/webp" | "image/gif" {
  const t = (file.type || "").toLowerCase();
  if (t.includes("png")) return "image/png";
  if (t.includes("jpeg") || t.includes("jpg")) return "image/jpeg";
  if (t.includes("webp")) return "image/webp";
  if (t.includes("gif")) return "image/gif";
  const n = file.name.toLowerCase();
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function finalize(message: Anthropic.Messages.Message, filename: string): Imported {
  const textBlock = message.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "";
  const json = safeParseJson(text);
  if (!json) return simulatedFallback(filename);
  return sanitize(json);
}

function safeParseJson(text: string): Imported | null {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function sanitize(input: any): Imported {
  const out: Imported = {};
  if (input?.cards && typeof input.cards === "object") {
    out.cards = {};
    for (const k of ["receita", "despesa", "lucro", "ticket"] as const) {
      const v = Number(input.cards[k]);
      if (Number.isFinite(v)) out.cards[k] = Math.round(v);
    }
  }
  if (Array.isArray(input?.series)) {
    out.series = input.series
      .filter((p: any) => p && typeof p.month === "string")
      .slice(0, 12)
      .map((p: any) => ({
        month: String(p.month).slice(0, 3),
        receita: Math.round(Number(p.receita) || 0),
        despesa: Math.round(Number(p.despesa) || 0),
        lucro: Math.round(
          Number(p.lucro) || (Number(p.receita) || 0) - (Number(p.despesa) || 0),
        ),
      }));
  }
  return out;
}

/** Sem API key ou leitura vazia: não inventa números — retorna estrutura vazia para o usuário decidir. */
function simulatedFallback(_filename: string): Imported {
  return {};
}
