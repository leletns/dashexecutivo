/**
 * Gera senhas fortes distintas por e-mail, hashes bcrypt (custo 12) e imprime
 * trechos prontos para colar em .env.local (stdout). Não grava arquivos.
 *
 * Uso: npm run auth:bootstrap
 */
/* eslint-disable no-console */
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const emails = [
  "ludymilla@portal.com",
  "juridico@portal.com",
  "contabil@portal.com",
  "marketing@portal.com",
  "administrativo@portal.com",
  "financeiro@portal.com",
  "eventos@portal.com",
];

function randomPassword() {
  const core = crypto.randomBytes(12).toString("base64url");
  return `${core}Aa!9`;
}

const hashes = {};
const rows = [];

for (const email of emails) {
  const password = randomPassword();
  hashes[email] = bcrypt.hashSync(password, 12);
  rows.push({ email, password });
}

console.log("\n=== PORTAL_PASSWORD_HASHES (cole em .env.local, uma linha) ===\n");
console.log(`PORTAL_PASSWORD_HASHES=${JSON.stringify(hashes)}`);

console.log("\n=== Entregar por canal seguro (1Password / Bitwarden / e-mail cifrado) ===\n");
for (const { email, password } of rows) {
  console.log(`${email}\t${password}`);
}

console.log(
  "\nDepois de colar PORTAL_PASSWORD_HASHES, defina também NEXTAUTH_SECRET e NEXTAUTH_URL (veja .env.local.example).\n",
);
