/**
 * Integração com Dropbox — lê a planilha financeira (XLSX/CSV) mais recente
 * de uma pasta do Dropbox, usada quando o cliente mantém a planilha-mestre
 * lá em vez do Google Sheets/OneDrive.
 *
 * Bem mais simples que a integração com Microsoft Graph: não exige registro
 * de aplicativo corporativo nem fluxo OAuth por usuário. Basta gerar um
 * access token direto no painel do Dropbox (dropbox.com/developers/apps →
 * app → Settings → OAuth 2 → Generate) e configurá-lo como variável de
 * ambiente.
 *
 * Variáveis de ambiente:
 *   DROPBOX_ACCESS_TOKEN — token gerado no painel do app Dropbox
 *   DROPBOX_FOLDER_PATH  — opcional; pasta a vigiar (padrão: raiz da pasta do app)
 */

const DROPBOX_API = "https://api.dropboxapi.com/2";
const DROPBOX_CONTENT_API = "https://content.dropboxapi.com/2";

export function isDropboxConfigured(): boolean {
  return !!process.env.DROPBOX_ACCESS_TOKEN;
}

function folderPath(): string {
  return process.env.DROPBOX_FOLDER_PATH ?? "";
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

async function listFolder(): Promise<DropboxEntry[]> {
  const token = process.env.DROPBOX_ACCESS_TOKEN;
  const res = await fetch(`${DROPBOX_API}/files/list_folder`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path: folderPath() }),
  });
  if (!res.ok) {
    throw new Error(`Falha ao listar pasta do Dropbox (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  return (json.entries ?? []).map(toEntry);
}

/** Encontra a planilha (.xlsx/.xls/.csv) modificada mais recentemente na pasta configurada. */
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

/** Faz o download do conteúdo binário de um arquivo do Dropbox. */
export async function downloadFileContent(pathLower: string): Promise<Buffer> {
  const token = process.env.DROPBOX_ACCESS_TOKEN;
  const res = await fetch(`${DROPBOX_CONTENT_API}/files/download`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({ path: pathLower }),
    },
  });
  if (!res.ok) {
    throw new Error(`Falha ao baixar arquivo do Dropbox (${res.status}): ${await res.text()}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}
