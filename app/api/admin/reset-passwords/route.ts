import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const USUARIOS = [
  { email: "ludymilla@portal.com", password: "Lud@Baps2026" },
  { email: "miguel@portal.com",    password: "Mig@Baps2026" },
  { email: "andressa@portal.com",  password: "And@Baps2026" },
  { email: "poliana@portal.com",   password: "Pol@Baps2026" },
  { email: "delta@portal.com",     password: "Del@Baps2026" },
  { email: "cristina@portal.com",  password: "Cri@Baps2026" },
  { email: "juridico@portal.com",  password: "Jur@Baps2026" },
  { email: "financeiro@portal.com",password: "Fin@Baps2026" },
  { email: "contabil@portal.com",  password: "Con@Baps2026" },
  { email: "marketing@portal.com", password: "Mkt@Baps2026" },
  { email: "administrativo@portal.com", password: "Adm@Baps2026" },
  { email: "eventos@portal.com",   password: "Eve@Baps2026" },
];

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret");
  if (secret !== process.env.RESET_SECRET) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const url = rawUrl.replace(/\/(rest|auth)(\/.*)?$/, "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Env vars ausentes" }, { status: 500 });

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Deletar todos os usuários com os e-mails do portal
  const { data: allUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const portalEmails = new Set(USUARIOS.map((u) => u.email));
  const toDelete = (allUsers?.users ?? []).filter((u) => u.email && portalEmails.has(u.email));

  for (const u of toDelete) {
    await supabase.auth.admin.deleteUser(u.id);
  }

  // 2. Recriar via admin API (hash correto)
  const results: { email: string; ok: boolean; error?: string }[] = [];

  for (const u of USUARIOS) {
    const { error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });
    results.push({ email: u.email, ok: !error, error: error?.message });
  }

  return NextResponse.json({ deleted: toDelete.length, results });
}
