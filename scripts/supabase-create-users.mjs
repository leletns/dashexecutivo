/**
 * Cria todos os usuários do portal direto no Supabase Auth.
 *
 * Uso:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=seu-service-role-key \
 *   node scripts/supabase-create-users.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "\nFaltam variáveis de ambiente.\n\n" +
    "Execute assim:\n\n" +
    "  SUPABASE_URL=https://xxx.supabase.co \\\n" +
    "  SUPABASE_SERVICE_KEY=seu-service-role-key \\\n" +
    "  node scripts/supabase-create-users.mjs\n"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USUARIOS = [
  { email: "ludymilla@portal.com", nome: "Ludymilla Paiva" },
  { email: "miguel@portal.com",    nome: "Miguel Nascimento" },
  { email: "andressa@portal.com",  nome: "Andressa Radnuz" },
  { email: "poliana@portal.com",   nome: "Poliana" },
  { email: "delta@portal.com",     nome: "Delta Contabilidade" },
  { email: "cristina@portal.com",  nome: "Cristina Ishio" },
  { email: "juridico@portal.com",  nome: "Jurídico" },
  { email: "financeiro@portal.com",nome: "Financeiro" },
  { email: "contabil@portal.com",  nome: "Contábil" },
  { email: "marketing@portal.com", nome: "Marketing" },
  { email: "administrativo@portal.com", nome: "Administrativo" },
  { email: "eventos@portal.com",   nome: "Eventos" },
];

function gerarSenha() {
  return randomBytes(10).toString("base64url") + "Aa1!";
}

console.log("\nCriando usuários no Supabase…\n");

const resultados = [];

for (const usuario of USUARIOS) {
  const senha = gerarSenha();
  const { data, error } = await supabase.auth.admin.createUser({
    email: usuario.email,
    password: senha,
    email_confirm: true,
  });

  if (error) {
    if (error.message?.includes("already been registered")) {
      console.log(`⚠  ${usuario.email} — já existe, pulando`);
    } else {
      console.log(`✗  ${usuario.email} — ERRO: ${error.message}`);
    }
    resultados.push({ ...usuario, senha: "(já existia ou erro)", ok: !error });
  } else {
    console.log(`✓  ${usuario.email}`);
    resultados.push({ ...usuario, senha, ok: true });
  }
}

console.log("\n" + "=".repeat(60));
console.log("SENHAS GERADAS — guarde em local seguro");
console.log("=".repeat(60));
console.log(`\n${"E-MAIL".padEnd(35)} SENHA`);
console.log("-".repeat(60));
for (const r of resultados) {
  console.log(`${r.email.padEnd(35)} ${r.senha}`);
}
console.log("\n" + "=".repeat(60));
console.log("Compartilhe cada senha com a pessoa por canal privado.");
console.log("=".repeat(60) + "\n");
