require("dotenv").config();
const { Pool } = require("pg");
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  // Compare les colonnes réelles au schéma attendu (migrations 0017 incluse)
  const expected = ["smtp_host", "smtp_port", "smtp_secure", "smtp_require_tls", "smtp_user", "smtp_password", "smtp_from", "google_client_id", "google_client_secret", "stripe_secret_key", "stripe_webhook_secret", "paypal_client_id", "paypal_client_secret", "paypal_env", "paypal_xaf_per_eur", "ai_provider", "ai_base_url", "ai_model", "ai_api_key", "accepting_quotes"];
  const cols = await pool.query("select column_name from information_schema.columns where table_name='site_settings'");
  const have = new Set(cols.rows.map(r => r.column_name));
  const missing = expected.filter(c => !have.has(c));
  console.log("colonnes site_settings manquantes:", missing.length ? missing : "aucune ✅");
  // comptage métier
  for (const t of ["bookings", "quote_requests", "users", "catalog", "notifications"]) {
    const r = await pool.query(`select count(*)::int as n from ${t}`).catch(e => ({ rows: [{ n: "TABLE ABSENTE: " + e.code }] }));
    console.log(t.padEnd(16), r.rows[0].n);
  }
  await pool.end();
})();
