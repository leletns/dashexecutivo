/**
 * Integração com Dropbox — lê a planilha financeira (XLSX/CSV) mais recente
 * de uma pasta compartilhada do Dropbox, usada quando o cliente mantém a
 * planilha-mestre lá em vez do Google Sheets/OneDrive.
 *
 * O cliente compartilha um link de pasta do Dropbox (ex.: o que o Miguel
 * enviou: dropbox.com/scl/fo/...). Não é necessário que essa pasta esteja
 * na conta do BAPS — a API do Dropbox permite listar/baixar o conteúdo de
 * qualquer link compartilhado usando um access token de qualquer conta
 * Dropbox (gerado no painel do app, sem fluxo OAuth por usuário).
 *
 * Variáveis de ambiente:
 *   DROPBOX_ACCESS_TOKEN   — token gerado no painel do app Dropbox (Settings → OAuth 2 → Generate)
 *   DROPBOX_SHARED_LINK_URL — link da pasta compartilhada enviado pelo cliente
 */

const DROPBOX_API = "https://api.dropboxapi.com/2";
const DROPBOX_CONTENT_API = "https://content.dropboxapi.com/2";

export function isDropboxConfigured(): boolean {
  return !!(process.env.DROPBOX_ACCESS_TOKEN && process.env.DROPBOX_SHARED_LINK_URL);
}

function sharedLinkUrl(): string {
  return process.env.DROPBOX_SHARED_LINK_URL ?? "";
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
  const token = process.env.DROPBOX_ACCESS_TOKEN;
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
  const token = process.env.DROPBOX_ACCESS_TOKEN;
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
