import { Pool } from "pg";
import { config } from "dotenv";
config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const r = await pool.query(
  "select ai_provider, ai_base_url, ai_model, (ai_api_key is not null and ai_api_key <> '') as has_key, smtp_host, accepting_quotes from site_settings order by id desc limit 1"
);
console.log(r.rows);
await pool.end();
