/**
 * BAPS — Sincronização automática Google Sheets → Dashboard
 * ============================================================
 *
 * COMO INSTALAR (5 minutos):
 *
 * 1. Abra a planilha no Google Sheets
 * 2. No menu: Extensões → Apps Script
 * 3. Apague todo o código existente
 * 4. Cole este arquivo inteiro
 * 5. Clique em "Salvar projeto" (ícone de disquete)
 * 6. Configure as propriedades (passo abaixo)
 * 7. Configure os gatilhos (passo abaixo)
 *
 * CONFIGURAR PROPRIEDADES:
 * No Apps Script → menu "Projeto" → "Propriedades do script" → Adicionar:
 *   CRON_URL    = https://SEU-PROJETO.vercel.app/api/cron/sync-sheets
 *   CRON_SECRET = (o mesmo valor de CRON_SECRET no Vercel)
 *
 * CONFIGURAR GATILHOS (automação):
 * No Apps Script → ícone de relógio (Gatilhos) → "Adicionar gatilho"
 *   Opção A — Ao editar (melhor):
 *     Função: syncOnChange | Evento: De planilha | Tipo: Ao editar
 *   Opção B — Por tempo (a cada 15 min):
 *     Função: syncOnTimer | Evento: Baseado em tempo | A cada: 15 minutos
 * Use os DOIS gatilhos juntos para máxima cobertura.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Configuração — lida das Propriedades do Script (não altere aqui)
// ─────────────────────────────────────────────────────────────────────────────

function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    cronUrl: props.getProperty("CRON_URL"),
    cronSecret: props.getProperty("CRON_SECRET"),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Gatilho: ao editar a planilha
// ─────────────────────────────────────────────────────────────────────────────

function syncOnChange(e) {
  // Evita sync em edições muito rápidas (debounce de 10 segundos via cache)
  const cache = CacheService.getScriptCache();
  const lastSync = cache.get("last_sync_ts");
  const now = Date.now();

  if (lastSync && now - parseInt(lastSync, 10) < 10_000) {
    return; // menos de 10 segundos desde o último sync — ignora
  }

  cache.put("last_sync_ts", String(now), 60);
  callDashboardSync("onChange");
}

// ─────────────────────────────────────────────────────────────────────────────
// Gatilho: por tempo (a cada 15 minutos)
// ─────────────────────────────────────────────────────────────────────────────

function syncOnTimer() {
  callDashboardSync("timer");
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync manual — use para testar: selecione esta função e clique ▶
// ─────────────────────────────────────────────────────────────────────────────

function syncManual() {
  const result = callDashboardSync("manual");
  if (result.ok) {
    SpreadsheetApp.getUi().alert(
      "✅ Sincronizado!\n\n" +
      result.rows_upserted + " movimentações atualizadas no dashboard."
    );
  } else {
    SpreadsheetApp.getUi().alert("❌ Erro: " + result.error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Função principal — chama o endpoint do dashboard
// ─────────────────────────────────────────────────────────────────────────────

function callDashboardSync(triggeredBy) {
  const { cronUrl, cronSecret } = getConfig();

  if (!cronUrl || !cronSecret) {
    Logger.log("[BAPS Sync] CRON_URL ou CRON_SECRET não configurados nas Propriedades do Script.");
    return { ok: false, error: "Configuração incompleta" };
  }

  try {
    const response = UrlFetchApp.fetch(cronUrl, {
      method: "post",
      headers: {
        "Authorization": "Bearer " + cronSecret,
        "Content-Type": "application/json",
      },
      payload: JSON.stringify({ triggered_by: triggeredBy }),
      muteHttpExceptions: true,
    });

    const code = response.getResponseCode();
    const body = response.getContentText();

    let json = {};
    try { json = JSON.parse(body); } catch (_) {}

    if (code >= 200 && code < 300) {
      Logger.log("[BAPS Sync] ✅ Sucesso (" + triggeredBy + "): " + json.rows_upserted + " linhas");
      return { ok: true, ...json };
    } else {
      Logger.log("[BAPS Sync] ❌ Erro HTTP " + code + ": " + body);
      return { ok: false, error: "HTTP " + code + ": " + body };
    }
  } catch (err) {
    Logger.log("[BAPS Sync] ❌ Exceção: " + err.toString());
    return { ok: false, error: err.toString() };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Menu personalizado na planilha (aparece em "BAPS" no menu)
// ─────────────────────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🔄 BAPS Sync")
    .addItem("Sincronizar agora", "syncManual")
    .addItem("Ver logs", "openLogs")
    .addToUi();
}

function openLogs() {
  const html = HtmlService.createHtmlOutput(
    '<p>Para ver os logs de execução: <br>' +
    'Apps Script → Execuções → clique em qualquer item para ver os logs detalhados.</p>'
  ).setWidth(400).setHeight(150);
  SpreadsheetApp.getUi().showModelessDialog(html, "Como ver os logs");
}
