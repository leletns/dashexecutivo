/**
 * Parsers de arquivo compartilhados (CSV / XLSX) — extraídos de
 * /api/sync/upload para reaproveitamento em /api/sync/onedrive.
 */

// ─── CSV parser (UTF-8, separador vírgula ou ponto-e-vírgula) ─────────────────

export function parseCSV(text: string): string[][] {
  // Detecta separador (vírgula ou ponto-e-vírgula)
  const firstLine = text.split("\n")[0] ?? "";
  const sep = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";

  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;
    rows.push(splitCSVLine(line, sep));
  }
  return rows;
}

function splitCSVLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === sep && !inQuote) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// ─── XLSX parser (usa biblioteca xlsx já instalada) ───────────────────────────

export async function parseXLSX(buffer: Buffer): Promise<string[][]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });

  // Procura a aba na seguinte ordem de prioridade:
  // 1. Nome exato configurado em GOOGLE_SHEETS_SHEET_NAME
  // 2. Aba que contém "personalizadoFinanceiro" no nome
  // 3. Primeira aba disponível
  const configuredName = process.env.GOOGLE_SHEETS_SHEET_NAME ?? "personalizadoFinanceiro (13)";

  const targetSheet =
    workbook.SheetNames.find((n) => n === configuredName) ??
    workbook.SheetNames.find((n) =>
      n.toLowerCase().includes("personalizadofinanceiro") ||
      n.toLowerCase().includes("personalizado")
    ) ??
    workbook.SheetNames[0];

  if (!targetSheet) throw new Error("Nenhuma aba encontrada no arquivo.");

  const sheet = workbook.Sheets[targetSheet];
  const data = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as string[][];

  return data;
}

/** Detecta o formato do arquivo pelo nome e converte para string[][]. */
export async function parseSpreadsheetFile(fileName: string, buffer: Buffer): Promise<string[][]> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) return parseCSV(buffer.toString("utf-8"));
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return parseXLSX(buffer);
  throw new Error("Formato não suportado. Use um arquivo .csv ou .xlsx.");
}
