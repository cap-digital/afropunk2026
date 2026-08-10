/**
 * Diagnóstico da conexão com a Google Ads API.
 * Rode com:  node --env-file=.env.local scripts/testar-google-ads.mjs
 *
 * Vai por etapas e para na primeira que falhar, dizendo o que corrigir.
 */
import { JWT } from "google-auth-library";

const ok = (m) => console.log("  \x1b[32m✓\x1b[0m " + m);
const erro = (m) => console.log("  \x1b[31m✗\x1b[0m " + m);
const soDigitos = (v) => (v ?? "").replace(/\D/g, "");

console.log("\n1. VARIÁVEIS DE AMBIENTE");
const faltando = [
  "GOOGLE_ADS_DEVELOPER_TOKEN",
  "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
  "GOOGLE_ADS_CUSTOMER_ID",
  "GOOGLE_ADS_IMPERSONATED_USER",
  "GOOGLE_ADS_SA_KEY_BASE64",
].filter((k) => !process.env[k]);
if (faltando.length) { erro("ausentes: " + faltando.join(", ")); process.exit(1); }
ok("todas presentes");

console.log("\n2. CHAVE DA CONTA DE SERVIÇO");
const b64 = process.env.GOOGLE_ADS_SA_KEY_BASE64;
let sa;
try {
  sa = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
} catch {
  erro(`não decodifica em JSON (${b64.length} caracteres de base64)`);
  console.log("     O valor está truncado ou corrompido. Regere com:");
  console.log("       base64 -i chave-da-service-account.json | tr -d '\\n'");
  console.log("     e cole o resultado inteiro numa única linha do .env.local.");
  console.log(`     Referência: a chave do GA4 nesta mesma conta tem ${
    (process.env.GA4_SA_KEY_BASE64_AFROPUNK ?? "").length || "~3100"} caracteres.`);
  process.exit(1);
}
if (!sa.client_email || !sa.private_key) { erro("JSON sem client_email ou private_key"); process.exit(1); }
ok(`${sa.client_email} (projeto ${sa.project_id})`);

console.log("\n3. TOKEN COM IMPERSONATION");
let token;
try {
  const cliente = new JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/adwords"],
    subject: process.env.GOOGLE_ADS_IMPERSONATED_USER,
  });
  ({ access_token: token } = await cliente.authorize());
  ok(`impersonando ${process.env.GOOGLE_ADS_IMPERSONATED_USER}`);
} catch (e) {
  erro(e.message);
  console.log("     Confira no Admin do Workspace se o Client ID da service account");
  console.log("     está autorizado para o escopo .../auth/adwords (Domain-Wide Delegation).");
  process.exit(1);
}

console.log("\n4. CHAMADA À API");
const versoes = [process.env.GOOGLE_ADS_API_VERSION, "v25"].filter(Boolean);
const cliente = soDigitos(process.env.GOOGLE_ADS_CUSTOMER_ID);
const login = soDigitos(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);

for (const v of [...new Set(versoes)]) {
  const res = await fetch(`https://googleads.googleapis.com/${v}/customers/${cliente}/googleAds:search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      "login-customer-id": login,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
              metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions,
              metrics.conversions_value
              FROM campaign WHERE segments.date DURING LAST_30_DAYS`,
    }),
  });
  const j = await res.json().catch(() => ({}));
  if (res.ok) {
    ok(`${v} respondeu · ${(j.results ?? []).length} linhas`);
    console.log("\n5. CAMPANHAS");
    for (const r of j.results ?? []) {
      const m = r.metrics ?? {}, c = r.campaign ?? {};
      console.log(
        `  ${(c.status ?? "").padEnd(8)} ${(c.advertisingChannelType ?? "").padEnd(14)} ` +
        `R$ ${((Number(m.costMicros ?? 0)) / 1e6).toFixed(2).padStart(10)}  ` +
        `${String(m.impressions ?? 0).padStart(8)} impr  ` +
        `${String(m.clicks ?? 0).padStart(6)} cliques  ` +
        `${Number(m.conversions ?? 0).toFixed(0).padStart(5)} conv  ${c.name ?? ""}`
      );
    }
    process.exit(0);
  }
  erro(`${v}: HTTP ${res.status} — ${j.error?.message ?? "sem detalhe"}`);
}
process.exit(1);
