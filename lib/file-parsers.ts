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
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

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

  // Colunas de data (L/M/N — vencimento, pagamento, créd/déb; ver
  // buildColumnMap em lib/google-sheets.ts). `parseDateBR` adivinha se o
  // texto formatado é "m/d/yyyy" (americano, como o Google Sheets exporta)
  // ou "d/m/yyyy" (brasileiro, como o e-Gestor exporta nativo) — mas um
  // arquivo .xlsx baixado direto do Dropbox vem no formato brasileiro, e
  // para dias 1-12 essa adivinhação inverte dia/mês silenciosamente,
  // jogando o lançamento no mês errado (ex.: pagamentos do início do mês
  // atual somem do mês atual e aparecem em outro). Como `cellDates: true`
  // faz o XLSX guardar a data real da célula (sem depender do texto
  // formatado), pegamos esse valor direto quando disponível — sem
  // ambiguidade de formato.
  const DATE_COLS = [11, 12, 13];
  // Coluna Valor (I — índice 8). `parseMoneyBR` espera texto no formato
  // brasileiro ("1.234,56"), que é como o Google Sheets exporta o valor
  // FORMATADO. Mas um número nativo de célula .xlsx (tipo "n") vem aqui como
  // texto americano puro via `raw:false` (ex.: "1234.56", já que o formato
  // "General" do Excel não usa separador de milhar nem vírgula decimal) — ao
  // passar isso por `parseMoneyBR`, o ponto decimal é removido como se fosse
  // separador de milhar e o valor sai 100x maior (1234.56 → 123456). Como o
  // tipo da célula nos diz, sem ambiguidade, que é um número puro, formatamos
  // nós mesmos no padrão brasileiro a partir do valor real — sem depender do
  // texto que o Excel decidiu exibir.
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
  const wb = XLSX.read(buffer, { type: "buffer", cellFormula: true });
  const configured = process.env.GOOGLE_SHEETS_SHEET_NAME ?? "personalizadoFinanceiro (13)";
  const target =
    wb.SheetNames.find((n) => n === configured) ??
    wb.SheetNames.find((n) => n.toLowerCase().includes("personalizadofinanceiro")) ??
    wb.SheetNames[0];
  const ws = target ? wb.Sheets[target] : undefined;
  if (!ws) return { saldoDia: null, saldoProjetado: null };

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const numAt = (r: number, c: number): number | null => {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (!cell) return null;
    const v = typeof cell.v === "number" ? cell.v : Number(cell.v);
    return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  };

  let saldoDia: number | null = null;
  let saldoProjetado: number | null = null;
  // Varre as primeiras linhas procurando os rótulos; o valor fica na célula à direita.
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
