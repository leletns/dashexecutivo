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

/**
 * Escolhe a aba financeira pela ordem: nome configurado → contém
 * "personalizadoFinanceiro" → primeira aba.
 */
function escolherAbaFinanceira(sheetNames: string[]): string | undefined {
  const configuredName = process.env.GOOGLE_SHEETS_SHEET_NAME ?? "personalizadoFinanceiro (13)";
  return (
    sheetNames.find((n) => n === configuredName) ??
    sheetNames.find((n) =>
      n.toLowerCase().includes("personalizadofinanceiro") ||
      n.toLowerCase().includes("personalizado")
    ) ??
    sheetNames[0]
  );
}

export async function parseXLSX(buffer: Buffer): Promise<string[][]> {
  const XLSX = await import("xlsx");

  // A planilha do e-Gestor tem dezenas de abas; ler todas custa ~40s. Fazemos
  // 2 passes: 1º só os nomes das abas (rápido), depois lemos APENAS a aba
  // financeira alvo — corta o tempo de leitura em ~10x.
  const nomes = XLSX.read(buffer, { type: "buffer", bookSheets: true }).SheetNames;
  const targetSheet = escolherAbaFinanceira(nomes);
  if (!targetSheet) throw new Error("Nenhuma aba encontrada no arquivo.");

  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, sheets: [targetSheet] });
  return rowsFromWorksheet(XLSX, workbook.Sheets[targetSheet]);
}

/** Converte a aba financeira em string[][], corrigindo datas e valores nativos. */
function rowsFromWorksheet(XLSX: typeof import("xlsx"), sheet: any): string[][] {
  const data = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as string[][];

  // Colunas de data (L/M/N — vencimento, pagamento, créd/déb). Como
  // `cellDates: true` guarda a data real da célula, pegamos direto — sem a
  // ambiguidade d/m vs m/d do texto formatado (que jogava dias 1-12 no mês
  // errado). Coluna Valor (I=8): quando é número nativo (tipo "n"), o texto
  // via `raw:false` sai no padrão americano sem milhar (ex. "1234.56"), o que
  // faria `parseMoneyBR` inflar 100x; então formatamos no padrão brasileiro.
  const DATE_COLS = [11, 12, 13];
  const VALOR_COL = 8;
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1");
  for (let r = range.s.r; r <= range.e.r; r++) {
    const rowIdx = r - range.s.r;
    if (!data[rowIdx]) continue;
    for (const c of DATE_COLS) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell?.t === "d" && cell.v instanceof Date) {
        const d = cell.v;
        data[rowIdx][c] =
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }
    }
    const valorCell = sheet[XLSX.utils.encode_cell({ r, c: VALOR_COL })];
    if (valorCell?.t === "n" && typeof valorCell.v === "number") {
      data[rowIdx][VALOR_COL] = valorCell.v.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
  }
  return data;
}

/** Extrai "Saldo do Dia"/"Saldo Projetado" varrendo os rótulos no topo da aba. */
function resumoFromWorksheet(XLSX: typeof import("xlsx"), ws: any): PlanilhaResumo {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const numAt = (r: number, c: number): number | null => {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (!cell) return null;
    const v = typeof cell.v === "number" ? cell.v : Number(cell.v);
    return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  };
  let saldoDia: number | null = null;
  let saldoProjetado: number | null = null;
  for (let r = 0; r <= 5 && (saldoDia === null || saldoProjetado === null); r++) {
    for (let c = 0; c <= 20; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      const label = norm(String(cell.w ?? cell.v ?? ""));
      if (saldoDia === null && label === "saldo do dia") saldoDia = numAt(r, c + 1);
      else if (saldoProjetado === null && label === "saldo projetado") saldoProjetado = numAt(r, c + 1);
    }
  }
  return { saldoDia, saldoProjetado };
}

/** Detecta o formato do arquivo pelo nome e converte para string[][]. */
export async function parseSpreadsheetFile(fileName: string, buffer: Buffer): Promise<string[][]> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) return parseCSV(buffer.toString("utf-8"));
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return parseXLSX(buffer);
  throw new Error("Formato não suportado. Use um arquivo .csv ou .xlsx.");
}

export interface PlanilhaResumo {
  saldoDia: number | null;
  saldoProjetado: number | null;
}

/**
 * Extrai os saldos-resumo mantidos no topo da aba financeira (ex.: células
 * "Saldo do Dia" e "Saldo Projetado" da planilha do e-Gestor). Esses números
 * são controlados manualmente pelo financeiro e não aparecem nas linhas de
 * lançamento — então o painel precisa lê-los daqui para bater com a planilha.
 * Procura pelos rótulos nas primeiras linhas e pega o valor da célula ao lado.
 */
export async function extractPlanilhaResumo(fileName: string, buffer: Buffer): Promise<PlanilhaResumo> {
  const lower = fileName.toLowerCase();
  if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
    return { saldoDia: null, saldoProjetado: null };
  }
  const XLSX = await import("xlsx");
  const nomes = XLSX.read(buffer, { type: "buffer", bookSheets: true }).SheetNames;
  const target = escolherAbaFinanceira(nomes);
  if (!target) return { saldoDia: null, saldoProjetado: null };
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true, sheets: [target] });
  const ws = wb.Sheets[target];
  if (!ws) return { saldoDia: null, saldoProjetado: null };
  return resumoFromWorksheet(XLSX, ws);
}

/**
 * Lê a planilha UMA única vez e devolve as linhas + os saldos-resumo — usado
 * pela sincronização para não ler o arquivo (grande) duas vezes. Para CSV, o
 * resumo vem vazio.
 */
export async function parseSpreadsheetAndResumo(
  fileName: string,
  buffer: Buffer,
): Promise<{ rows: string[][]; resumo: PlanilhaResumo }> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) {
    return { rows: parseCSV(buffer.toString("utf-8")), resumo: { saldoDia: null, saldoProjetado: null } };
  }
  const XLSX = await import("xlsx");
  const nomes = XLSX.read(buffer, { type: "buffer", bookSheets: true }).SheetNames;
  const target = escolherAbaFinanceira(nomes);
  if (!target) throw new Error("Nenhuma aba encontrada no arquivo.");
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, sheets: [target] });
  const ws = workbook.Sheets[target];
  return { rows: rowsFromWorksheet(XLSX, ws), resumo: resumoFromWorksheet(XLSX, ws) };
}
