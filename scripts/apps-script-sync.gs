/**
 * BAPS — Sincronização automática Google Sheets → Supabase
 * =========================================================
 *
 * COMO INSTALAR (5 minutos):
 *
 * 1. Na planilha: Extensões → Apps Script
 * 2. Apague todo o código existente
 * 3. Cole este arquivo inteiro
 * 4. Clique em "Salvar projeto" (ícone de disquete)
 *
 * CONFIGURAR PROPRIEDADES DO SCRIPT:
 * No Apps Script → ícone de engrenagem (⚙️ Configurações do projeto) → "Propriedades de script" → Adicionar:
 *   SUPABASE_URL  = https://SEU_PROJECT_ID.supabase.co
 *   SUPABASE_KEY  = sua_service_role_key_aqui
 *
 * CONFIGURAR GATILHOS (automação):
 * No Apps Script → ícone de relógio (Gatilhos) → "Adicionar gatilho":
 *   Gatilho 1 — Ao editar:
 *     Função: aoEditar | Evento: Da planilha | Tipo: Ao editar
 *   Gatilho 2 — A cada 15 minutos (backup):
 *     Função: sincronizarTimer | Evento: Baseado em tempo | A cada: 15 minutos
 *
 * COMO TESTAR:
 * Selecione a função "testarConexao" e clique ▶ — deve mostrar quantas linhas existem no banco.
 * Selecione a função "sincronizar" e clique ▶ — sincroniza tudo agora.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Configuração
// ─────────────────────────────────────────────────────────────────────────────

var ABA_ALVO = "personalizadoFinanceiro (13)";
var BATCH_SIZE = 500;

function getConfig_() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty("SUPABASE_URL");
  var key = props.getProperty("SUPABASE_KEY");
  if (!url || !key) {
    throw new Error(
      "Configure SUPABASE_URL e SUPABASE_KEY nas Propriedades do Script.\n" +
      "Apps Script → ⚙️ Configurações → Propriedades de script"
    );
  }
  return { supabaseUrl: url.replace(/\/$/, ""), supabaseKey: key };
}

// ─────────────────────────────────────────────────────────────────────────────
// Gatilho: ao editar a planilha (com debounce de 10 segundos)
// ─────────────────────────────────────────────────────────────────────────────

function aoEditar(e) {
  // Ignora edições em outras abas
  if (e && e.source) {
    var abaEditada = e.source.getActiveSheet().getName();
    if (abaEditada !== ABA_ALVO) return;
  }

  // Debounce: evita múltiplos syncs em edições rápidas
  var cache = CacheService.getScriptCache();
  var ultimoSync = cache.get("ultimo_sync_ts");
  var agora = Date.now();

  if (ultimoSync && agora - parseInt(ultimoSync, 10) < 10000) {
    return; // menos de 10 segundos desde o último sync
  }

  cache.put("ultimo_sync_ts", String(agora), 60);
  sincronizar_("aoEditar");
}

// ─────────────────────────────────────────────────────────────────────────────
// Gatilho: por tempo (a cada 15 minutos como backup)
// ─────────────────────────────────────────────────────────────────────────────

function sincronizarTimer() {
  sincronizar_("timer");
}

// ─────────────────────────────────────────────────────────────────────────────
// Sincronização manual — selecione esta função e clique ▶ para testar
// ─────────────────────────────────────────────────────────────────────────────

function sincronizar() {
  try {
    var resultado = sincronizar_("manual");
    SpreadsheetApp.getUi().alert(
      "✅ Sincronizado!\n\n" +
      resultado.linhasLidas + " linhas lidas da planilha\n" +
      resultado.linhasEnviadas + " registros gravados no banco"
    );
  } catch (err) {
    SpreadsheetApp.getUi().alert("❌ Erro: " + err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Teste de conexão — confirma que o Supabase está acessível
// ─────────────────────────────────────────────────────────────────────────────

function testarConexao() {
  try {
    var cfg = getConfig_();
    var resp = UrlFetchApp.fetch(
      cfg.supabaseUrl + "/rest/v1/portal_lancamentos?select=count&limit=1",
      {
        method: "get",
        headers: {
          "apikey": cfg.supabaseKey,
          "Authorization": "Bearer " + cfg.supabaseKey,
          "Content-Type": "application/json",
          "Prefer": "count=exact",
        },
        muteHttpExceptions: true,
      }
    );
    var code = resp.getResponseCode();
    var headers = resp.getAllHeaders();
    var total = headers["content-range"] || headers["Content-Range"] || "desconhecido";
    if (code >= 200 && code < 300) {
      SpreadsheetApp.getUi().alert(
        "✅ Conexão OK!\n\nSupabase respondeu com código " + code + "\nTotal de registros: " + total
      );
    } else {
      SpreadsheetApp.getUi().alert(
        "❌ Erro na conexão\n\nCódigo: " + code + "\n\n" + resp.getContentText().substring(0, 300)
      );
    }
  } catch (err) {
    SpreadsheetApp.getUi().alert("❌ Exceção: " + err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lógica principal de sincronização
// ─────────────────────────────────────────────────────────────────────────────

function sincronizar_(origem) {
  origem = origem || "manual";
  var cfg = getConfig_();

  // 1. Abrir aba alvo
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  var aba = planilha.getSheetByName(ABA_ALVO);
  if (!aba) throw new Error("Aba \"" + ABA_ALVO + "\" não encontrada na planilha.");

  // 2. Ler todos os dados
  var ultimaLinha = aba.getLastRow();
  var ultimaColuna = aba.getLastColumn();
  if (ultimaLinha < 2) throw new Error("A aba está vazia.");
  var dados = aba.getRange(1, 1, ultimaLinha, ultimaColuna).getValues();

  // 3. Encontrar linha do cabeçalho (procura por "Cod" na coluna A)
  var linhaHeader = -1;
  for (var i = 0; i < Math.min(dados.length, 10); i++) {
    var celula = String(dados[i][0]).trim().toLowerCase();
    if (celula === "cod" || celula === "código" || celula === "codigo") {
      linhaHeader = i;
      break;
    }
  }
  if (linhaHeader === -1) {
    // Fallback: primeira linha com conteúdo
    for (var i = 0; i < Math.min(dados.length, 5); i++) {
      if (dados[i][0] !== "") { linhaHeader = i; break; }
    }
  }
  if (linhaHeader === -1) throw new Error("Cabeçalho não encontrado. Coluna A deve ter 'Cod'.");

  var headersRow = dados[linhaHeader];
  var colMap = buildColMap_(headersRow);

  // 4. Transformar linhas em registros
  var registros = [];
  var agora = new Date().toISOString();

  for (var i = linhaHeader + 1; i < dados.length; i++) {
    var row = dados[i];
    var cod = col_(row, colMap.cod);
    if (!cod || cod.toLowerCase().indexOf("total") !== -1) continue;

    var rawValor = col_(row, colMap.valor);
    var valorNum = parseValor_(rawValor);

    var recDespCol = col_(row, colMap.rec_desp);
    var recDesp = recDespCol || (valorNum < 0 ? "Despesas" : valorNum > 0 ? "Receitas" : null);

    var nomeX = col_(row, colMap.nome_completo);
    var nomeW = col_(row, colMap.tratativa_oculta);
    var nomeE = col_(row, colMap.nome_razao_social);
    var nomeDisplay =
      (nomeX && nomeX !== "*NÃO INFORMADO*" ? nomeX : null) ||
      (nomeW && nomeW !== "*NÃO INFORMADO*" ? nomeW : null) ||
      (nomeE && nomeE !== "*NÃO INFORMADO*" ? nomeE : null) ||
      null;

    registros.push({
      cod: cod,
      descricao:             col_(row, colMap.descricao)             || null,
      conta_caixa:           col_(row, colMap.conta_caixa)           || null,
      plano_contas:          col_(row, colMap.plano_contas)          || null,
      nome_razao_social:     nomeDisplay,
      forma_pagamento:       col_(row, colMap.forma_pagamento)       || null,
      situacao:              col_(row, colMap.situacao)              || null,
      valor:                 Math.abs(valorNum),
      data_vencimento:       parseDateBR_(col_(row, colMap.data_vencimento)),
      data_pagamento:        parseDateBR_(col_(row, colMap.data_pagamento)),
      data_cred_deb:         parseDateBR_(col_(row, colMap.data_cred_deb)),
      plano_primario_contas: col_(row, colMap.plano_primario_contas)  || null,
      classificacao:         col_(row, colMap.classificacao)          || null,
      sub_classificacao:     col_(row, colMap.sub_classificacao)      || null,
      ent_saida:             col_(row, colMap.ent_saida)              || null,
      rec_desp:              recDesp,
      tratativa:             col_(row, colMap.tratativa)              || null,
      tratativa_oculta:      col_(row, colMap.tratativa_oculta)       || null,
      evento:                col_(row, colMap.evento)                 || null,
      synced_at:             agora,
    });
  }

  if (registros.length === 0) {
    Logger.log("[BAPS Sync] Nenhum registro válido encontrado.");
    return { linhasLidas: 0, linhasEnviadas: 0 };
  }

  // 5. Enviar ao Supabase em lotes de 500
  var totalEnviado = 0;
  for (var i = 0; i < registros.length; i += BATCH_SIZE) {
    var lote = registros.slice(i, i + BATCH_SIZE);
    var resp = UrlFetchApp.fetch(
      cfg.supabaseUrl + "/rest/v1/portal_lancamentos",
      {
        method: "post",
        headers: {
          "apikey": cfg.supabaseKey,
          "Authorization": "Bearer " + cfg.supabaseKey,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        payload: JSON.stringify(lote),
        muteHttpExceptions: true,
      }
    );
    var code = resp.getResponseCode();
    if (code < 200 || code >= 300) {
      var erro = resp.getContentText();
      Logger.log("[BAPS Sync] ❌ Erro no lote " + i + ": HTTP " + code + " — " + erro);
      throw new Error("Erro ao gravar no banco (HTTP " + code + "): " + erro.substring(0, 200));
    }
    totalEnviado += lote.length;
    Logger.log("[BAPS Sync] ✅ Lote " + (Math.floor(i / BATCH_SIZE) + 1) + ": " + lote.length + " registros enviados");
  }

  Logger.log("[BAPS Sync] ✅ Concluído (" + origem + "): " + registros.length + " registros → Supabase");
  return { linhasLidas: registros.length, linhasEnviadas: totalEnviado };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapeamento de colunas — igual ao lib/google-sheets.ts do projeto
// Tenta por nome do cabeçalho primeiro; usa posição fixa como fallback.
// ─────────────────────────────────────────────────────────────────────────────

function buildColMap_(headers) {
  var map = {};

  function norm(s) { return String(s).trim().toLowerCase().replace(/\s+/g, " "); }

  var NOMES = {
    cod:                  ["cod", "código", "codigo"],
    descricao:            ["descrição", "descricao", "descrição da movimentação"],
    conta_caixa:          ["conta caixa", "conta/caixa", "conta"],
    plano_contas:         ["plano de contas", "plano contas"],
    nome_razao_social:    ["nome / razão social", "nome/razão social", "nome razão social", "razão social"],
    forma_pagamento:      ["forma de pagamento", "forma pagamento"],
    situacao:             ["situação", "situacao", "status"],
    valor:                ["valor"],
    data_vencimento:      ["data de vencimento", "data vencimento", "vencimento"],
    data_pagamento:       ["data de pagamento", "data pagamento", "pagamento"],
    data_cred_deb:        ["data crédito/débito", "data cred/deb", "data cred deb", "crédito/débito"],
    plano_primario_contas:["plano primário de contas", "plano primário", "primário"],
    classificacao:        ["classificação", "classificacao"],
    sub_classificacao:    ["subclassificação", "sub classificação", "subclassificacao"],
    ent_saida:            ["entrada/saída", "ent/saída", "entrada saída"],
    rec_desp:             ["rec/desp", "receita/despesa", "tipo"],
    tratativa:            ["tratativa"],
    tratativa_oculta:     ["tratativa oculta"],
    nome_completo:        ["nome completo", "nome (tratado)"],
    evento:               ["evento"],
  };

  for (var campo in NOMES) {
    var candidatos = NOMES[campo];
    for (var j = 0; j < headers.length; j++) {
      var h = norm(headers[j]);
      for (var k = 0; k < candidatos.length; k++) {
        if (h === candidatos[k] || h.indexOf(candidatos[k]) !== -1) {
          map[campo] = j;
          break;
        }
      }
      if (map[campo] !== undefined) break;
    }
  }

  // Fallback por posição fixa (colunas do e-Gestor, índice 0 = coluna A)
  var FIXO = {
    cod: 0, descricao: 1, conta_caixa: 2, plano_contas: 3, nome_razao_social: 4,
    forma_pagamento: 6, situacao: 7, valor: 8,
    data_vencimento: 10, data_pagamento: 11, data_cred_deb: 12,
    plano_primario_contas: 15, classificacao: 16, sub_classificacao: 17,
    ent_saida: 18, rec_desp: 19, tratativa: 20, tratativa_oculta: 22,
    nome_completo: 23, evento: 26,
  };
  for (var campo in FIXO) {
    if (map[campo] === undefined) map[campo] = FIXO[campo];
  }

  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function col_(row, idx) {
  if (idx === undefined || idx === null) return "";
  var val = row[idx];
  if (val === undefined || val === null) return "";
  return String(val).trim();
}

function parseValor_(s) {
  if (!s) return 0;
  var limpo = s.replace(/R\$\s?/g, "").replace(/\./g, "").replace(",", ".");
  var n = parseFloat(limpo);
  return isNaN(n) ? 0 : n;
}

function parseDateBR_(s) {
  if (!s) return null;
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  var dia = parseInt(m[1], 10);
  var mes = parseInt(m[2], 10);
  var ano = parseInt(m[3], 10);
  if (mes > 12 && dia <= 12) { var t = dia; dia = mes; mes = t; }
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return ano + "-" + (mes < 10 ? "0" : "") + mes + "-" + (dia < 10 ? "0" : "") + dia;
}

// ─────────────────────────────────────────────────────────────────────────────
// Menu personalizado na planilha
// ─────────────────────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🔄 Sincronizar Dashboard")
    .addItem("Sincronizar agora", "sincronizar")
    .addItem("Testar conexão", "testarConexao")
    .addToUi();
}
