/**
 * Integração com OneDrive / SharePoint via Microsoft Graph API.
 *
 * Permite ler um arquivo de planilha (XLSX/CSV) a partir de um link de
 * compartilhamento (ex.: https://1drv.ms/f/c/...) — usado quando o cliente
 * mantém a planilha-mestre no OneDrive em vez do Google Sheets.
 *
 * Variáveis de ambiente necessárias (App Registration no Azure AD / Entra ID):
 *   MICROSOFT_CLIENT_ID      — Application (client) ID
 *   MICROSOFT_CLIENT_SECRET  — Client secret (Certificates & secrets)
 *   MICROSOFT_TENANT_ID      — "common" (contas pessoais + organizacionais) ou o tenant específico
 *   MICROSOFT_REDIRECT_URI   — URL de callback registrada, ex.: https://SEU-APP.vercel.app/api/integrations/onedrive/callback
 *
 * Escopo solicitado: Files.Read offline_access
 * (delegado — o usuário conectado precisa ter acesso ao item compartilhado)
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const SCOPES = "Files.Read offline_access User.Read";

export function isOneDriveConfigured(): boolean {
  return !!(
    process.env.MICROSOFT_CLIENT_ID &&
    process.env.MICROSOFT_CLIENT_SECRET &&
    process.env.MICROSOFT_REDIRECT_URI
  );
}

function tenant(): string {
  return process.env.MICROSOFT_TENANT_ID || "common";
}

/** Monta a URL de autorização para iniciar o consentimento OAuth2. */
export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    response_type: "code",
    redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
    response_mode: "query",
    scope: SCOPES,
    state,
  });
  return `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/authorize?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

/** Troca o "code" do redirect OAuth2 pelos tokens de acesso/refresh. */
export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const res = await fetch(`https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
      grant_type: "authorization_code",
      code,
      scope: SCOPES,
    }),
  });
  if (!res.ok) throw new Error(`Falha ao obter token da Microsoft: ${await res.text()}`);
  return res.json() as Promise<TokenResponse>;
}

/** Lançado quando o refresh_token foi revogado/expirado — a conta precisa ser reconectada. */
export class OneDriveReauthRequiredError extends Error {
  constructor(detail: string) {
    super(`Conexão com a Microsoft expirou ou foi revogada. Reconecte a conta. (${detail})`);
    this.name = "OneDriveReauthRequiredError";
  }
}

async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(`https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: SCOPES,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    let code = "";
    try {
      code = JSON.parse(text)?.error ?? "";
    } catch {
      // resposta não-JSON — ignora
    }
    if (code === "invalid_grant" || code === "interaction_required") {
      throw new OneDriveReauthRequiredError(text);
    }
    throw new Error(`Falha ao renovar token da Microsoft: ${text}`);
  }
  return res.json() as Promise<TokenResponse>;
}

interface StoredTokenRow {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  account_label: string | null;
}

/** Salva (ou substitui) os tokens da conta Microsoft conectada. */
export async function storeTokens(
  sb: SupabaseClient,
  tokens: TokenResponse,
  accountLabel?: string | null
): Promise<void> {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await sb.from("portal_integration_tokens").upsert({
    id: "onedrive",
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    account_label: accountLabel ?? null,
    updated_at: new Date().toISOString(),
  });
}

/** Lê o token salvo, renova com o refresh_token se estiver expirado, e retorna um access_token válido. */
export async function getValidAccessToken(sb: SupabaseClient): Promise<string | null> {
  const { data } = await sb
    .from("portal_integration_tokens")
    .select("access_token, refresh_token, expires_at, account_label")
    .eq("id", "onedrive")
    .maybeSingle();

  const row = data as StoredTokenRow | null;
  if (!row?.refresh_token) return null;

  const expiresAt = new Date(row.expires_at).getTime();
  if (Date.now() < expiresAt - 60_000) {
    return row.access_token;
  }

  try {
    const refreshed = await refreshTokens(row.refresh_token);
    await storeTokens(sb, refreshed, row.account_label);
    return refreshed.access_token;
  } catch (err) {
    if (err instanceof OneDriveReauthRequiredError) {
      await disconnect(sb);
    }
    throw err;
  }
}

export async function getConnectionInfo(
  sb: SupabaseClient
): Promise<{ connected: boolean; account_label: string | null }> {
  const { data } = await sb
    .from("portal_integration_tokens")
    .select("account_label, refresh_token")
    .eq("id", "onedrive")
    .maybeSingle();
  const row = data as { account_label: string | null; refresh_token: string | null } | null;
  return { connected: !!row?.refresh_token, account_label: row?.account_label ?? null };
}

export async function disconnect(sb: SupabaseClient): Promise<void> {
  await sb.from("portal_integration_tokens").delete().eq("id", "onedrive");
}

/** Busca o e-mail/nome da conta Microsoft conectada (para exibição). */
export async function fetchAccountLabel(accessToken: string): Promise<string | null> {
  const res = await fetch(`${GRAPH_BASE}/me?$select=mail,userPrincipalName,displayName`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const me = (await res.json()) as { mail?: string; userPrincipalName?: string; displayName?: string };
  return me.mail || me.userPrincipalName || me.displayName || null;
}

/** Codifica uma URL de compartilhamento no formato exigido por /shares/{id}. */
function encodeShareUrl(url: string): string {
  const base64 = Buffer.from(url, "utf-8")
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\//g, "_")
    .replace(/\+/g, "-");
  return `u!${base64}`;
}

export interface DriveItemRef {
  driveId: string;
  itemId: string;
  name: string;
  isFolder: boolean;
  children?: DriveItemRef[];
}

interface GraphDriveItem {
  id: string;
  name: string;
  folder?: unknown;
  file?: unknown;
  parentReference?: { driveId: string };
  children?: GraphDriveItem[];
}

function toRef(item: GraphDriveItem): DriveItemRef {
  return {
    driveId: item.parentReference?.driveId ?? "",
    itemId: item.id,
    name: item.name,
    isFolder: !!item.folder,
    children: item.children?.map(toRef),
  };
}

/** Resolve um link compartilhado (arquivo ou pasta) para o item correspondente no Graph. */
export async function resolveSharedItem(shareUrl: string, accessToken: string): Promise<DriveItemRef> {
  const shareId = encodeShareUrl(shareUrl.trim());
  const res = await fetch(`${GRAPH_BASE}/shares/${shareId}/driveItem?$expand=children`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Não foi possível abrir o link compartilhado (${res.status}): ${await res.text()}`);
  }
  const item = (await res.json()) as GraphDriveItem;
  return toRef(item);
}

/**
 * A partir de um item resolvido (arquivo ou pasta), encontra a planilha a sincronizar:
 * - se for um arquivo .xlsx/.xls/.csv, usa ele mesmo
 * - se for uma pasta, procura entre os filhos (prioriza nomes com "financeiro"/"personalizado")
 */
export function findSpreadsheetItem(item: DriveItemRef): DriveItemRef | null {
  const isSpreadsheet = (name: string) => /\.(xlsx|xls|csv)$/i.test(name);

  if (!item.isFolder) return isSpreadsheet(item.name) ? item : null;

  const candidates = (item.children ?? []).filter((c) => !c.isFolder && isSpreadsheet(c.name));
  if (candidates.length === 0) return null;

  const preferred = candidates.find((c) =>
    /financeiro|personalizado/i.test(c.name)
  );
  return preferred ?? candidates[0];
}

/** Faz o download do conteúdo binário de um item do Drive. */
export async function downloadDriveItemContent(
  driveId: string,
  itemId: string,
  accessToken: string
): Promise<Buffer> {
  const res = await fetch(`${GRAPH_BASE}/drives/${driveId}/items/${itemId}/content`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Falha ao baixar arquivo do OneDrive (${res.status}): ${await res.text()}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

// ─── Configuração (URL da pasta/arquivo compartilhado) ────────────────────────

export async function getShareUrl(sb: SupabaseClient): Promise<string | null> {
  const { data } = await sb
    .from("portal_settings")
    .select("value")
    .eq("key", "onedrive_share_url")
    .maybeSingle();
  return (data as { value: string } | null)?.value ?? null;
}

export async function setShareUrl(sb: SupabaseClient, url: string): Promise<void> {
  await sb.from("portal_settings").upsert({
    key: "onedrive_share_url",
    value: url,
    updated_at: new Date().toISOString(),
  });
}
