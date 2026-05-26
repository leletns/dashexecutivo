/**
 * Google Sheets API v4 client — autenticação via Service Account
 * Usa Node.js crypto nativo (sem googleapis package).
 *
 * Variáveis de ambiente necessárias:
 *   GOOGLE_SERVICE_ACCOUNT_KEY_B64  — JSON da Service Account em Base64
 *   GOOGLE_SHEETS_SPREADSHEET_ID    — ID da planilha (da URL do Google Sheets)
 *   GOOGLE_SHEETS_SHEET_NAME        — nome da aba (ex: "personalizadoFinanceiro (13)")
 */

import { createSign } from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServiceAccountCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
}

// ─── JWT helpers ─────────────────────────────────────────────────────────────

function base64url(input: string | Buffer): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function getAccessToken(creds: ServiceAccountCredentials): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: creds.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );

  const signingInput = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = base64url(signer.sign(creds.private_key));

  const jwt = `${signingInput}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Google OAuth2 falhou: ${txt}`);
  }

  const { access_token } = (await res.json()) as { access_token: string };
  return access_token;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Lê todos os valores de um intervalo na planilha. */
export async function readSheetValues(
  spreadsheetId: string,
  sheetName: string,
  range = "A:Z"
): Promise<string[][]> {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
  if (!b64) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_B64 não configurado.");

  const creds = JSON.parse(
    Buffer.from(b64, "base64").toString("utf-8")
  ) as ServiceAccountCredentials;

  const token = await getAccessToken(creds);

  const encodedRange = encodeURIComponent(`${sheetName}!${range}`);
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}` +
    `?valueRenderOption=FORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;

  const sheetsRes = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!sheetsRes.ok) {
    const txt = await sheetsRes.text();
    throw new Error(`Sheets API falhou: ${txt}`);
  }

  const json = (await sheetsRes.json()) as { values?: string[][] };
  return json.values ?? [];
}

/** Detecta automaticamente a linha de cabeçalho (pula lixo do e-Gestor). */
export function findHeaderRowIndex(rows: string[][]): number {
  const keywords = ["cód", "cod", "valor", "situaç", "evento", "classific"];
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const rowText = rows[i].join(" ").toLowerCase();
    const hits = keywords.filter((k) => rowText.includes(k)).length;
    if (hits >= 3) return i;
  }
  return 4; // padrão: pula 4 linhas de cabeçalho do e-Gestor
}

/** Mapa de índices de coluna baseado no cabeçalho detectado. */
export interface SheetColumnMap {
  cod?: number;
  data_competencia?: number;
  data_pagamento?: number;
  data_vencimento?: number;
  nome_razao_social?: number;
  evento?: number;
  plano_primario_contas?: number;
  classificacao?: number;
  sub_classificacao?: number;
  rec_desp?: number;
  ent_saida?: number;
  situacao?: number;
  valor?: number;
  conta_caixa?: number;
}

export function buildColumnMap(headers: string[]): SheetColumnMap {
  const map: SheetColumnMap = {};

  headers.forEach((h, i) => {
    const n = h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

    if (/^co[dó]/.test(n) && n.length <= 5) {
      map.cod = i;
    } else if (n.includes("competencia") || n.includes("competência")) {
      map.data_competencia = i;
    } else if (
      (n.includes("cred") && n.includes("deb")) ||
      n.includes("pagamento") ||
      n.includes("liquidac")
    ) {
      map.data_pagamento = i;
    } else if (n.includes("vencimento")) {
      map.data_vencimento = i;
    } else if (n.includes("nome") || n.includes("razao") || n.includes("razão")) {
      map.nome_razao_social = i;
    } else if (n === "evento") {
      map.evento = i;
    } else if (n.includes("plano") || n.includes("primario") || n.includes("primário")) {
      map.plano_primario_contas = i;
    } else if (n.includes("sub") && n.includes("classif")) {
      map.sub_classificacao = i;
    } else if (n.includes("classif") && !n.includes("sub")) {
      map.classificacao = i;
    } else if (n.includes("rec") && n.includes("desp")) {
      map.rec_desp = i;
    } else if ((n.includes("ent") && n.includes("saida")) || n.includes("entrada")) {
      map.ent_saida = i;
    } else if (n.includes("situac") || n.includes("situação")) {
      map.situacao = i;
    } else if (n === "valor") {
      map.valor = i;
    } else if (n.includes("conta") || n.includes("caixa") || n.includes("banco")) {
      map.conta_caixa = i;
    }
  });

  return map;
}

/** Converte data brasileira (dd/mm/yyyy) para ISO (yyyy-mm-dd). */
export function parseDateBR(value: string): string | null {
  if (!value?.trim()) return null;
  const v = value.trim();
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return null;
}

/** Converte valor monetário brasileiro (1.234,56 ou 1234.56) para number. */
export function parseValueBR(value: string): number {
  if (!value?.trim()) return 0;
  const cleaned = value
    .trim()
    .replace(/R\$\s?/, "")
    .replace(/\./g, "")  // remove separador de milhar
    .replace(",", ".");  // converte decimal
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Math.abs(n);
}
