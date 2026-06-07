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

/**
 * Mapa completo de colunas — baseado na planilha real "personalizadoFinanceiro (13)":
 *
 *  A  Cód.
 *  B  Descrição
 *  C  Conta Caixa
 *  D  Plano de contas  (base e-Gestor — ex: "SÓCIOS FUNDADORES")
 *  E  Nome/Razão do contato
 *  F  CPF/CNPJ (não armazenado — privacidade)
 *  G  Forma de pagamento  (PIX / DINHEIRO)
 *  H  Situação  (Recebido / Pago / A receber / A pagar)
 *  I  Valor  (negativo para Despesas)
 *  J  Data de cadastro (ignorada)
 *  K  Data de vencimento
 *  L  Data de pagamento
 *  M  Data de créd/déb  (efetivação bancária)
 *  N  Observações
 *  O  (vazia)
 *  P  Plano Primário de Contas  (ex: "DESPESAS OPERACIONAIS BAPS")
 *  Q  Classificação de Contas   (ex: "DESPESAS COM SERVIÇOS PROFISSIONAIS")
 *  R  Sub Classificação de Contas (ex: "IMÓVEL - ALUGUEL")
 *  S  Ent./Saída  (Crédito / Débito)
 *  T  Rec./Des.   (Receitas / Despesas)
 *  U  Tratativa   (Empréstimos / Despesas / Receitas)
 *  V  Forma de Ptgto. (duplicata simplificada de G)
 *  W  Tratativa Oculta de Nome/Razão Social
 *  X  Nome/Razão Social (versão limpa — para exibição)
 *  Y  Coluna3 (CPF/CNPJ — não armazenado)
 *  Z  Coluna32 (REALIZADO — sempre igual, ignorado)
 *  AA Evento  (ex: "OPERAÇÃO DE FUNDAÇÃO BAPS")
 */
export interface SheetColumnMap {
  cod?: number;
  descricao?: number;
  conta_caixa?: number;
  plano_contas?: number;           // col D — plano base do e-Gestor
  nome_razao_social?: number;      // col E
  forma_pagamento?: number;        // col G
  situacao?: number;               // col H
  valor?: number;                  // col I
  data_vencimento?: number;        // col K
  data_pagamento?: number;         // col L
  data_cred_deb?: number;          // col M
  plano_primario_contas?: number;  // col P — categoria principal enriquecida
  classificacao?: number;          // col Q
  sub_classificacao?: number;      // col R
  ent_saida?: number;              // col S
  rec_desp?: number;               // col T
  tratativa?: number;              // col U
  tratativa_oculta?: number;       // col W
  nome_completo?: number;          // col X — nome limpo para exibição
  evento?: number;                 // col AA
}

export function buildColumnMap(headers: string[]): SheetColumnMap {
  const map: SheetColumnMap = {};

  // Normaliza: minúsculas sem acentos
  const norm = (h: string) =>
    h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

  headers.forEach((h, i) => {
    const n = norm(h);

    // ── Identificação ─────────────────────────────────────────────────────
    if (/^co[d]\.?$/.test(n) || n === "cod" || n === "codigo") {
      map.cod = i;

    // ── Descrição do lançamento ───────────────────────────────────────────
    } else if (n === "descricao" || n === "descricao do lancamento") {
      map.descricao = i;

    // ── Conta Caixa ───────────────────────────────────────────────────────
    } else if (n.includes("conta") && n.includes("caixa")) {
      map.conta_caixa = i;

    // ── Plano Primário de Contas (col P — enriquecido) ────────────────────
    } else if (n.includes("plano") && n.includes("primario")) {
      map.plano_primario_contas = i;

    // ── Plano de contas base (col D — e-Gestor nativo) ────────────────────
    } else if (n === "plano de contas" || (n.includes("plano") && n.includes("conta") && !n.includes("primario"))) {
      map.plano_contas = i;

    // ── Classificação e Sub ───────────────────────────────────────────────
    } else if (n.includes("sub") && n.includes("classif")) {
      map.sub_classificacao = i;
    } else if (n.includes("classif") && !n.includes("sub")) {
      map.classificacao = i;

    // ── Nomes ────────────────────────────────────────────────────────────
    } else if (n === "nome/razao social" || n === "nome/razao do social") {
      // col X — nome limpo (prioridade maior)
      map.nome_completo = i;
    } else if (n.includes("tratativa oculta")) {
      map.tratativa_oculta = i;
    } else if ((n.includes("nome") || n.includes("razao")) && !n.includes("social")) {
      // col E — "Nome/Razão do contato"
      map.nome_razao_social = map.nome_razao_social ?? i;
    } else if (n.includes("nome") || n.includes("razao")) {
      map.nome_razao_social = map.nome_razao_social ?? i;

    // ── Forma de pagamento ───────────────────────────────────────────────
    } else if ((n.includes("forma") && n.includes("pagamento")) ||
               (n.includes("forma") && n.includes("ptgto"))) {
      map.forma_pagamento = map.forma_pagamento ?? i;

    // ── Situação ─────────────────────────────────────────────────────────
    } else if (n === "situacao" || n.includes("situac")) {
      map.situacao = i;

    // ── Valor ────────────────────────────────────────────────────────────
    } else if (n === "valor") {
      map.valor = i;

    // ── Datas ────────────────────────────────────────────────────────────
    } else if (n.includes("vencimento")) {
      map.data_vencimento = i;
    } else if (n.includes("cred") && n.includes("deb")) {
      map.data_cred_deb = i;
    } else if (n.includes("pagamento")) {
      map.data_pagamento = i;

    // ── Rec./Desp., Ent./Saída, Tratativa ────────────────────────────────
    } else if ((n.includes("rec") && n.includes("des")) ||
               (n.includes("receita") && n.includes("despesa"))) {
      map.rec_desp = i;
    } else if (n.includes("ent") && n.includes("saida")) {
      map.ent_saida = i;
    } else if (n === "tratativa") {
      map.tratativa = i;

    // ── Evento ───────────────────────────────────────────────────────────
    } else if (n === "evento") {
      map.evento = i;
    }
  });

  return map;
}

/**
 * Converte data exportada pelo Google Sheets para ISO (yyyy-mm-dd).
 *
 * IMPORTANTE: a planilha exporta no formato AMERICANO m/d/yyyy (ex.: "5/22/2026",
 * "3/25/2026 8:38" — confirmado olhando a própria planilha). O 1º número é o MÊS.
 * Só invertemos para d/m quando o 1º número não pode ser mês (>12) — ex.: "25/3/2026".
 * Aceita também hora opcional no fim (ignorada), pois colunas como "Data de cadastro"
 * vêm como "3/25/2026 8:38".
 */
export function parseDateBR(value: string): string | null {
  if (!value?.trim()) return null;
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);

  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/);
  if (m) {
    let mo = parseInt(m[1], 10);
    let d  = parseInt(m[2], 10);
    const y = parseInt(m[3], 10);
    if (mo > 12 && d <= 12) { [d, mo] = [mo, d]; }
    if (mo > 12 || mo < 1 || d > 31 || d < 1) return null;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
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
