/**
 * Atualiza o "retrato" embutido da base viva do Dropbox.
 *
 * Baixa a planilha-mestre pela pasta compartilhada do Miguel (link durável,
 * sem token temporário), reprocessa e regenera lib/data/base-snapshot.* SOMENTE
 * se a base tiver mudado (compara um hash da fonte). Assim o painel pode se
 * manter batendo com a base sem depender das variáveis do Vercel.
 *
 * Uso:  node scripts/refresh-snapshot.cjs
 * Saída: imprime "CHANGED" (regenerou) ou "UNCHANGED" (nada a fazer).
 * Se mudou, o chamador deve commitar lib/data/base-snapshot.* e publicar.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");
const XLSX = require("xlsx");
const { unzipSync } = require("fflate");

// Pasta compartilhada do Dropbox do Miguel (link durável — só rlkey).
const DROPBOX_FOLDER_LINK =
  "https://www.dropbox.com/scl/fo/8e0cx1yvwb14p755e6i2l/AJLuA8TMiWMXSp-RgwLv3HQ?rlkey=j3t1xp0v4qvxifr2xgykh0c99&dl=1";

const ROOT = path.resolve(__dirname, "..");
const OUT_B64 = path.join(ROOT, "lib/data/base-snapshot.b64.ts");
const OUT_META = path.join(ROOT, "lib/data/base-snapshot-meta.json");
const SHEET = "personalizadoFinanceiro (13)";

async function download(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function pickXlsx(zipBuf) {
  const files = unzipSync(new Uint8Array(zipBuf));
  const names = Object.keys(files).filter((n) => /\.xlsx$/i.test(n));
  if (!names.length) throw new Error("nenhum .xlsx no zip");
  // maior arquivo = a base
  names.sort((a, b) => files[b].length - files[a].length);
  return Buffer.from(files[names[0]]);
}

const norm = (s) =>
  String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

function money(s) {
  if (s == null || s === "") return null;
  let v = String(s).replace(/R\$\s?/, "").trim();
  const neg = /^\(.*\)$/.test(v);
  v = v.replace(/[()]/g, "").replace(/,/g, "");
  const n = parseFloat(v);
  if (isNaN(n)) return null;
  return neg ? -Math.abs(n) : n;
}

function build(xlsxBuf) {
  const wb = XLSX.read(xlsxBuf, { type: "buffer", cellDates: true, sheets: [SHEET] });
  const ws = wb.Sheets[SHEET];
  if (!ws) throw new Error(`aba "${SHEET}" não encontrada`);
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  const range = XLSX.utils.decode_range(ws["!ref"]);

  let hIdx = -1;
  for (let i = 0; i < 30; i++) {
    const c = (rows[i] || []).map(norm);
    if (c.some((x) => x === "evento") && c.some((x) => x.includes("situac"))) { hIdx = i; break; }
  }
  if (hIdx < 0) throw new Error("cabeçalho não encontrado");
  const H = rows[hIdx].map(norm);
  const idx = (pred) => H.findIndex(pred);
  const C = {
    descricao: idx((c) => c === "descricao"),
    plano: idx((c) => c === "plano de contas"),
    situacao: idx((c) => c.includes("situac")),
    planoPrim: idx((c) => c.includes("plano") && c.includes("primario")),
    classif: idx((c) => c.includes("classif") && !c.includes("sub")),
    subclassif: idx((c) => c.includes("sub") && c.includes("classif")),
    recdesp: idx((c) => c.includes("rec") && c.includes("des")),
    tratativa: idx((c) => c === "tratativa"),
    nome: idx((c) => c.includes("nome") && c.includes("razao") && c.includes("social") && !c.includes("oculta")),
    evento: idx((c) => c === "evento"),
  };

  function findSaldo(label) {
    for (let i = 0; i < hIdx; i++) {
      const row = rows[i] || [];
      for (let j = 0; j < row.length; j++) {
        if (norm(row[j]) === label || norm(row[j]).startsWith(label)) {
          for (let k = j + 1; k < row.length; k++) if (String(row[k] || "").trim()) return String(row[k]).trim();
        }
      }
    }
    return null;
  }
  const saldoDia = money(findSaldo("saldo do dia"));
  const saldoProj = money(findSaldo("saldo projetado"));
  let relatorio = null;
  for (let i = 0; i < hIdx && !relatorio; i++)
    for (const c of rows[i] || []) { const m = String(c || "").match(/gerado em\s*([\d/]+)/i); if (m) { relatorio = m[1]; break; } }

  const valorAt = (r) => {
    const cell = ws[XLSX.utils.encode_cell({ r, c: 8 })];
    if (cell && cell.t === "n" && typeof cell.v === "number") return cell.v;
    return money(cell && cell.w) || 0;
  };
  const dateAt = (r, c) => {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (cell && cell.t === "d" && cell.v instanceof Date) {
      const d = cell.v;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    const s = String((rows[r] && rows[r][c]) || "").trim();
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})/);
    if (m) {
      let mo = +m[1], dd = +m[2], y = +m[3];
      if (m[3].length === 2) y += y <= 79 ? 2000 : 1900;
      if (mo > 12 && dd <= 12) { const t = dd; dd = mo; mo = t; }
      if (mo < 1 || mo > 12 || dd < 1 || dd > 31) return null;
      return `${y}-${String(mo).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
    return null;
  };
  const S = (v) => { const x = String(v == null ? "" : v).trim(); return x || null; };

  const recs = [];
  for (let r = hIdx + 1; r <= range.e.r; r++) {
    const row = rows[r]; if (!row) continue;
    const cod = String(row[0] || "").trim();
    if (!cod || cod.toLowerCase().includes("total")) continue;
    const valorRaw = valorAt(r);
    let recdesp = S(row[C.recdesp]);
    if (!recdesp) recdesp = valorRaw < 0 ? "Despesas" : valorRaw > 0 ? "Receitas" : null;
    recs.push({
      cod, descricao: S(row[C.descricao]), conta_caixa: S(row[2]), plano_contas: S(row[C.plano]),
      situacao: S(row[C.situacao]), valor: Math.abs(valorRaw),
      data_vencimento: dateAt(r, 11), data_pagamento: dateAt(r, 12),
      plano_primario_contas: S(row[C.planoPrim]), classificacao: S(row[C.classif]), sub_classificacao: S(row[C.subclassif]),
      rec_desp: recdesp, tratativa: S(row[C.tratativa]), nome_razao_social: S(row[C.nome]), evento: S(row[C.evento]),
    });
  }
  return { recs, saldoDia, saldoProj, relatorio };
}

(async () => {
  const zip = await download(DROPBOX_FOLDER_LINK);
  const xlsx = pickXlsx(zip);
  const { recs, saldoDia, saldoProj, relatorio } = build(xlsx);
  const json = JSON.stringify(recs);
  const sourceHash = crypto.createHash("sha256").update(json).digest("hex");

  // já está atualizado?
  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(OUT_META, "utf8")); } catch {}
  if (prev && prev.source_hash === sourceHash) {
    console.log("UNCHANGED", "registros=" + recs.length);
    return;
  }

  const meta = {
    gerado_em: new Date().toISOString(),
    relatorio_em: relatorio,
    saldo_dia: saldoDia,
    saldo_projetado: saldoProj,
    total_registros: recs.length,
    fonte: "dropbox-base-viva",
    source_hash: sourceHash,
  };
  const gz = zlib.gzipSync(Buffer.from(json), { level: 9 });
  const b64 = gz.toString("base64");
  const metaStr = JSON.stringify(meta, null, 2);
  const out =
    `// GERADO AUTOMATICAMENTE por scripts/refresh-snapshot.cjs — retrato\n` +
    `// comprimido (gzip+base64) da base viva do Dropbox do Miguel.\n` +
    `/* meta: ${metaStr.replace(/\*\//g, "* /")} */\n` +
    `export const SNAPSHOT_META = ${metaStr} as const;\n` +
    `export const SNAPSHOT_GZ_B64 =\n  "${b64}";\n`;
  fs.writeFileSync(OUT_B64, out);
  fs.writeFileSync(OUT_META, metaStr + "\n");
  console.log("CHANGED", "registros=" + recs.length, "saldo_dia=" + saldoDia, "relatorio=" + relatorio);
})().catch((e) => { console.error("ERRO", e && e.message ? e.message : e); process.exit(1); });
