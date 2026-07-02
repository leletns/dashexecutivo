/**
 * Integração com Dropbox — lê a planilha financeira (XLSX/CSV) mais recente
 * de uma pasta compartilhada do Dropbox, usada quando o cliente mantém a
 * planilha-mestre lá em vez do Google Sheets/OneDrive.
 *
 * O cliente compartilha um link de pasta do Dropbox (ex.: o que o Miguel
 * enviou: dropbox.com/scl/fo/...). Não é necessário que essa pasta esteja
 * na conta do BAPS — a API do Dropbox permite listar/baixar o conteúdo de
 * qualquer link compartilhado usando um access token de qualquer conta.
 *
 * AUTENTICAÇÃO (importante):
 * Os tokens gerados no botão "Generate access token" do app Dropbox são de
 * CURTA DURAÇÃO (expiram em ~4h) — usá-los fixos faz a sincronização parar
 * sozinha depois de algumas horas (erro expired_access_token). O modo correto
 * e permanente é o REFRESH TOKEN: com ele + app key/secret, o servidor gera um
 * access token novo automaticamente sempre que precisa, para sempre.
 *
 * Variáveis de ambiente:
 *   DROPBOX_SHARED_LINK_URL — link da pasta compartilhada enviado pelo cliente
 *   Modo permanente (recomendado):
 *     DROPBOX_REFRESH_TOKEN — refresh token (gerado uma vez, via OAuth offline)
 *     DROPBOX_APP_KEY       — App key do app Dropbox
 *     DROPBOX_APP_SECRET    — App secret do app Dropbox
 *   Modo legado (temporário, expira em ~4h):
 *     DROPBOX_ACCESS_TOKEN  — token fixo do botão "Generate access token"
 */

const DROPBOX_API = "https://api.dropboxapi.com/2";
const DROPBOX_CONTENT_API = "https://content.dropboxapi.com/2";
const DROPBOX_OAUTH_TOKEN = "https://api.dropbox.com/oauth2/token";

function hasRefreshConfig(): boolean {
  return !!(
    process.env.DROPBOX_REFRESH_TOKEN &&
    process.env.DROPBOX_APP_KEY &&
    process.env.DROPBOX_APP_SECRET
  );
}

export function isDropboxConfigured(): boolean {
  if (!process.env.DROPBOX_SHARED_LINK_URL) return false;
  return hasRefreshConfig() || !!process.env.DROPBOX_ACCESS_TOKEN;
}

function sharedLinkUrl(): string {
  return process.env.DROPBOX_SHARED_LINK_URL ?? "";
}

// Cache em memória do access token gerado a partir do refresh token, para não
// pedir um novo a cada chamada (o token do Dropbox vale ~4h; renovamos antes).
let tokenCache: { token: string; expiresAt: number } | null = null;

/**
 * Retorna um access token válido. Prioriza o refresh token (renovação
 * automática); se não estiver configurado, cai no token fixo legado.
 */
async function getAccessToken(): Promise<string> {
  if (!hasRefreshConfig()) {
    const legacy = process.env.DROPBOX_ACCESS_TOKEN;
    if (!legacy) throw new Error("Dropbox não configurado (sem refresh token nem access token).");
    return legacy;
  }

  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: process.env.DROPBOX_REFRESH_TOKEN!,
    client_id: process.env.DROPBOX_APP_KEY!,
    client_secret: process.env.DROPBOX_APP_SECRET!,
  });
  const res = await fetch(DROPBOX_OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Falha ao renovar token do Dropbox (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in?: number };
  const ttl = (json.expires_in ?? 14400) * 1000;
  tokenCache = { token: json.access_token, expiresAt: Date.now() + ttl };
  return json.access_token;
}

export interface DropboxEntry {
  tag: "file" | "folder";
  name: string;
  pathLower: string;
  serverModified: string | null;
}

function toEntry(raw: any): DropboxEntry {
  return {
    tag: raw[".tag"],
    name: raw.name,
    pathLower: raw.path_lower,
    serverModified: raw.server_modified ?? null,
  };
}

/** Lista o conteúdo da pasta apontada pelo link compartilhado configurado. */
async function listFolder(): Promise<DropboxEntry[]> {
  const token = await getAccessToken();
  const res = await fetch(`${DROPBOX_API}/files/list_folder`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path: "", shared_link: { url: sharedLinkUrl() } }),
  });
  if (!res.ok) {
    throw new Error(`Falha ao listar pasta do Dropbox (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  return (json.entries ?? []).map(toEntry);
}

/** Encontra a planilha (.xlsx/.xls/.csv) modificada mais recentemente na pasta compartilhada. */
export async function findLatestSpreadsheet(): Promise<DropboxEntry | null> {
  const entries = await listFolder();
  const candidates = entries.filter(
    (e) => e.tag === "file" && /\.(xlsx|xls|csv)$/i.test(e.name)
  );
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const ta = a.serverModified ? new Date(a.serverModified).getTime() : 0;
    const tb = b.serverModified ? new Date(b.serverModified).getTime() : 0;
    return tb - ta;
  });
  return candidates[0];
}

/** Faz o download do conteúdo binário de um arquivo dentro da pasta compartilhada. */
export async function downloadFileContent(pathLower: string): Promise<Buffer> {
  const token = await getAccessToken();
  const res = await fetch(`${DROPBOX_CONTENT_API}/sharing/get_shared_link_file`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({ url: sharedLinkUrl(), path: pathLower }),
    },
  });
  if (!res.ok) {
    throw new Error(`Falha ao baixar arquivo do Dropbox (${res.status}): ${await res.text()}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

// ─── Fluxo de conexão (obter o refresh token uma única vez) ────────────────────

export function hasDropboxAppCredentials(): boolean {
  return !!(process.env.DROPBOX_APP_KEY && process.env.DROPBOX_APP_SECRET);
}

/** URL de autorização do Dropbox com acesso offline (para receber refresh token). */
export function buildDropboxAuthorizeUrl(redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.DROPBOX_APP_KEY ?? "",
    response_type: "code",
    token_access_type: "offline", // exige refresh token
    redirect_uri: redirectUri,
    state,
  });
  return `https://www.dropbox.com/oauth2/authorize?${p.toString()}`;
}

/** Troca o código de autorização pelo refresh token (chamado no callback). */
export async function exchangeCodeForRefreshToken(
  code: string,
  redirectUri: string,
): Promise<{ refresh_token: string; access_token: string }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: process.env.DROPBOX_APP_KEY ?? "",
    client_secret: process.env.DROPBOX_APP_SECRET ?? "",
    redirect_uri: redirectUri,
  });
  const res = await fetch(DROPBOX_OAUTH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Falha ao obter refresh token do Dropbox (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as { refresh_token: string; access_token: string };
}
