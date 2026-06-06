/**
 * BAPS — Sincronização direta Google Sheets → Supabase
 * =====================================================
 *
 * COMO INSTALAR (5 minutos):
 *
 * 1. Abra a planilha no Google Sheets
 * 2. Extensões → Apps Script → apague tudo → cole este arquivo
 * 3. Configure as propriedades do script (veja abaixo)
 * 4. Configure os gatilhos (veja abaixo)
 * 5. Clique ▶ em "testarConexao" para verificar
 *
 * CONFIGURAR PROPRIEDADES DO SCRIPT:
 *   No Apps Script → ícone de engrenagem (Configurações do projeto)
 *   → "Propriedades do script" → Adicionar:
 *
 *   SUPABASE_URL = https://tckkdpwcsyicgiojkrlh.supabase.co
 *   SUPABASE_KEY = (sua service_role key do Supabase)
 *   SHEET_NAME   = personalizadoFinanceiro (13)
 *
 * CONFIGURAR GATILHOS:
 *   Apps Script → ícone de relógio → "Adicionar gatilho":
 *
 *   Gatilho 1 — Tempo real ao editar:
 *     Função: aoEditar | Evento: De planilha | Tipo: Ao editar
 *
 *   Gatilho 2 — Backup a cada 15 min:
 *     Função: sincronizarTimer | Evento: Baseado em tempo | A cada 15 minutos
 */

// ─────────────────────────────────────────────────────────────────────────────
// Configuração
// ─────────────────────────────────────────────────────────────────────────────

function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    supabaseUrl:  props.getProperty("SUPABASE_URL")  || "",
    supabaseKey:  props.getProperty("SUPABASE_KEY")  || "",
    sheetName:    props.getProperty("SHEET_NAME")    || "personalizadoFinanceiro (13)",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Gatilho: ao editar a planilha (debounce 10s para não spammar)
// ─────────────────────────────────────────────────────────────────────────────

function aoEditar(e) {
  const cache = CacheService.getScriptCache();
  const agora = Date.now();
  const ultimo = cache.get("ultimo_sync");

  if (ultimo && agora - parseInt(ultimo, 10) < 10000) return; // debounce 10s

  cache.put("ultimo_sync", String(agora), 60);
  sincronizar();
}

// ─────────────────────────────────────────────────────────────────────────────
// Gatilho: timer (backup a cada 15 min)
// ─────────────────────────────────────────────────────────────────────────────

function sincronizarTimer() {
  sincronizar();
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync manual — selecione e clique ▶ para testar
// ─────────────────────────────────────────────────────────────────────────────

function sincronizarManual() {
  const resultado = sincronizar();
  if (resultado && resultado.ok) {
    SpreadsheetApp.getUi().alert("✅ Sincronizado!\n\n" + resultado.upserted + " lançamentos enviados ao dashboard.");
  } else {
    SpreadsheetApp.getUi().alert("❌ Erro: " + (resultado ? resultado.erro : "Falha desconhecida"));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Testar conexão — use para verificar se as propriedades estão corretas
// ─────────────────────────────────────────────────────────────────────────────

function testarConexao() {
  const cfg = getConfig();

  if (!cfg.supabaseUrl || !cfg.supabaseKey) {
    SpreadsheetApp.getUi().alert("❌ SUPABASE_URL ou SUPABASE_KEY não configurados.\n\nVá em: Configurações do projeto → Propriedades do script");
    return;
  }

  try {
    const resp = UrlFetchApp.fetch(cfg.supabaseUrl + "/rest/v1/portal_lancamentos?select=cod&limit=1", {
      method: "get",
      headers: {
        "apikey":        cfg.supabaseKey,
        "Authorization": "Bearer " + cfg.supabaseKey,
      },
      muteHttpExceptions: true,
    });
    const code = resp.getResponseCode();
    const body = resp.getContentText();

    if (code === 200) {
      const rows = JSON.parse(body);
      SpreadsheetApp.getUi().alert("✅ Conexão OK!\n\nTabela portal_lancamentos acessível.\nExemplo: " + JSON.stringify(rows[0] || "(vazia)"));
    } else {
      SpreadsheetApp.getUi().alert("❌ Erro HTTP " + code + "\n\n" + body);
    }
  } catch (err) {
    SpreadsheetApp.getUi().alert("❌ Exceção: " + err.toString());
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Função principal de sincronização
// ─────────────────────────────────────────────────────────────────────────────

function sincronizar() {
  const cfg = getConfig();

  if (!cfg.supabaseUrl || !cfg.supabaseKey) {
    Logger.log("[BAPS] SUPABASE_URL ou SUPABASE_KEY não configurados.");
    return { ok: false, erro: "Configuração incompleta" };
  }

  // 1. Ler a aba correta
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(cfg.sheetName);

  if (!sheet) {
    Logger.log("[BAPS] Aba '" + cfg.sheetName + "' não encontrada.");
    return { ok: false, erro: "Aba não encontrada: " + cfg.sheetName };
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) {
    Logger.log("[BAPS] Planilha vazia.");
    return { ok: false, erro: "Planilha vazia" };
  }

  const allValues = sheet.getRange(1, 1, lastRow, lastCol).getValues();

  // 2. Encontrar linha do cabeçalho — normaliza para lidar com "Cód.", "COD", etc.
  var headerIdx = -1;
  for (var hi = 0; hi < Math.min(10, allValues.length); hi++) {
    var hrow = allValues[hi];
    for (var hj = 0; hj < hrow.length; hj++) {
      var hcell = String(hrow[hj] || "").trim().toLowerCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]/g, "");
      if (hcell === "cod" || hcell === "codigo") {
        headerIdx = hi;
        break;
      }
    }
    if (headerIdx >= 0) break;
  }

  if (headerIdx < 0) {
    Logger.log("[BAPS] Cabeçalho não encontrado.");
    return { ok: false, erro: "Cabeçalho com coluna 'Cod' não encontrado" };
  }

  const headers = allValues[headerIdx].map(function(h) {
    return String(h || "").trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  });

  // 3. Mapeamento de colunas \u2014 usa busca por substring como lib/google-sheets.ts
  // "Rec./Des." \u2192 normaliza "recdes" \u2192 indexOf("rec_desp") falha \u2192 usamos includes()
  var firstCol = function(include, exclude) {
    var includeArr = Array.isArray(include) ? include : [include];
    var excludeArr = Array.isArray(exclude) ? exclude : (exclude ? [exclude] : []);
    for (var i = 0; i < headers.length; i++) {
      var h = headers[i];
      var ok = includeArr.every(function(t) { return h.indexOf(t) >= 0; }) &&
               excludeArr.every(function(t) { return h.indexOf(t) < 0; });
      if (ok) return i;
    }
    return -1;
  };

  // Log para diagn\u00f3stico (primeiros 30 headers normalizados)
  Logger.log("[BAPS] Headers normalizados: " + headers.slice(0, 30).join(" | "));

  var colMap = {
    cod:                   firstCol("cod"),
    descricao:             firstCol("descricao"),
    conta_caixa:           firstCol(["conta", "caixa"]),
    plano_contas:          firstCol(["plano", "conta"], "primario"),
    forma_pagamento:       firstCol(["forma", "pagamento"]),
    situacao:              firstCol("situacao"),
    valor:                 firstCol("valor"),
    data_vencimento:       firstCol("vencimento"),
    data_pagamento:        firstCol(["data", "pagamento"], ["vencimento", "cred", "deb", "cadastro"]),
    data_cred_deb:         firstCol(["cred", "deb"]),
    plano_primario_contas: firstCol("primario"),
    classificacao:         firstCol("classif", "sub"),
    sub_classificacao:     firstCol(["sub", "classif"]),
    ent_saida:             firstCol(["ent", "saida"]),
    rec_desp:              firstCol(["rec", "des"]),
    tratativa:             firstCol("tratativa", "oculta"),
    tratativa_oculta:      firstCol(["tratativa", "oculta"]),
    nome_razao_social:     firstCol(["nome", "razao"]),
    evento:                firstCol("evento"),
  };

  // Log dos \u00edndices de colunas cr\u00edticas para diagn\u00f3stico
  Logger.log("[BAPS] Mapa de colunas: cod=" + colMap.cod + " valor=" + colMap.valor +
    " situacao=" + colMap.situacao + " rec_desp=" + colMap.rec_desp +
    " data_pagamento=" + colMap.data_pagamento + " data_vencimento=" + colMap.data_vencimento);

  // 4. Transformar linhas em registros
  const agora = new Date().toISOString();
  const registros = [];

  for (let i = headerIdx + 1; i < allValues.length; i++) {
    const row = allValues[i];

    const codVal = colMap.cod >= 0 ? String(row[colMap.cod] || "").trim() : "";
    if (!codVal || codVal.toLowerCase().includes("total")) continue;

    // Valor: remove R$, pontos de milhar, troca vírgula por ponto
    const rawValor = colMap.valor >= 0 ? String(row[colMap.valor] || "").trim() : "0";
    const valorNum = parseFloat(
      rawValor.replace(/R\$\s?/g, "").replace(/\./g, "").replace(",", ".")
    ) || 0;

    const recDespVal = colMap.rec_desp >= 0 ? String(row[colMap.rec_desp] || "").trim() : "";
    const recDesp = recDespVal ||
      (valorNum < 0 ? "Despesas" : valorNum > 0 ? "Receitas" : null);

    // Nome: prioriza coluna de nome completo sem asterisco
    const nomeX = colMap.nome_razao_social >= 0 ? String(row[colMap.nome_razao_social] || "").trim() : "";
    const nomeOculta = colMap.tratativa_oculta >= 0 ? String(row[colMap.tratativa_oculta] || "").trim() : "";
    const nomeDisplay = (nomeX && nomeX !== "*NÃO INFORMADO*" ? nomeX : null) ||
                        (nomeOculta && nomeOculta !== "*NÃO INFORMADO*" ? nomeOculta : null) ||
                        null;

    registros.push({
      cod:                   codVal,
      descricao:             getCell(row, colMap.descricao),
      conta_caixa:           getCell(row, colMap.conta_caixa),
      plano_contas:          getCell(row, colMap.plano_contas),
      nome_razao_social:     nomeDisplay,
      forma_pagamento:       getCell(row, colMap.forma_pagamento),
      situacao:              getCell(row, colMap.situacao),
      valor:                 Math.abs(valorNum),
      data_vencimento:       parseDateBR(getCell(row, colMap.data_vencimento)),
      data_pagamento:        parseDateBR(getCell(row, colMap.data_pagamento)),
      data_cred_deb:         parseDateBR(getCell(row, colMap.data_cred_deb)),
      plano_primario_contas: getCell(row, colMap.plano_primario_contas),
      classificacao:         getCell(row, colMap.classificacao),
      sub_classificacao:     getCell(row, colMap.sub_classificacao),
      ent_saida:             getCell(row, colMap.ent_saida),
      rec_desp:              recDesp,
      tratativa:             getCell(row, colMap.tratativa),
      tratativa_oculta:      getCell(row, colMap.tratativa_oculta),
      evento:                getCell(row, colMap.evento),
      synced_at:             agora,
    });
  }

  if (registros.length === 0) {
    Logger.log("[BAPS] Nenhum registro válido para enviar.");
    return { ok: true, upserted: 0 };
  }

  // 5. Enviar ao Supabase em lotes de 500
  const BATCH = 500;
  let totalEnviado = 0;

  for (let i = 0; i < registros.length; i += BATCH) {
    const lote = registros.slice(i, i + BATCH);
    const resp = UrlFetchApp.fetch(cfg.supabaseUrl + "/rest/v1/portal_lancamentos?on_conflict=cod", {
      method:  "post",
      headers: {
        "apikey":        cfg.supabaseKey,
        "Authorization": "Bearer " + cfg.supabaseKey,
        "Content-Type":  "application/json",
        "Prefer":        "resolution=merge-duplicates",
      },
      payload:            JSON.stringify(lote),
      muteHttpExceptions: true,
    });

    const code = resp.getResponseCode();
    if (code < 200 || code >= 300) {
      const msg = "Erro HTTP " + code + ": " + resp.getContentText().slice(0, 300);
      Logger.log("[BAPS] " + msg);
      return { ok: false, erro: msg, upserted: totalEnviado };
    }
    totalEnviado += lote.length;
    Logger.log("[BAPS] Lote enviado: " + totalEnviado + "/" + registros.length);
  }

  Logger.log("[BAPS] ✅ Sync concluído: " + totalEnviado + " registros");
  return { ok: true, upserted: totalEnviado };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getCell(row, idx) {
  if (idx < 0 || idx >= row.length) return null;
  const v = String(row[idx] || "").trim();
  return v || null;
}

function parseDateBR(valor) {
  if (!valor) return null;
  // Já em formato ISO (yyyy-mm-dd)
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  // Formato dd/mm/yyyy
  const m = valor.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    let dia = parseInt(m[1], 10), mes = parseInt(m[2], 10), ano = parseInt(m[3], 10);
    // Se mês > 12, tenta swap
    if (mes > 12 && dia <= 12) { const t = dia; dia = mes; mes = t; }
    if (mes < 1 || mes > 12) return null;
    return ano + "-" + String(mes).padStart(2, "0") + "-" + String(dia).padStart(2, "0");
  }
  // Objeto Date (quando a célula tem formato de data)
  if (valor instanceof Date) {
    const d = valor;
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Menu personalizado na planilha
// ─────────────────────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🔄 BAPS Sync")
    .addItem("Sincronizar agora", "sincronizarManual")
    .addItem("Testar conexão", "testarConexao")
    .addToUi();
}
