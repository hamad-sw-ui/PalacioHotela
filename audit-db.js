const fs = require("fs");
const path = require("path");
const envPath = path.join(__dirname, ".env");
const env = fs.readFileSync(envPath, "utf8");
const match = env.match(/^DATABASE_URL=(.*)$/m);
let url = match[1].trim().replace(/^["']|["']$/g, "");
const { Client } = require("pg");
const client = new Client({ connectionString: url });
(async () => {
  await client.connect();
  const q = async (sql, label) => {
    try { const r = await client.query(sql); console.log(`=== ${label} ===`); console.log(JSON.stringify(r.rows)); }
    catch (e) { console.log(`=== ${label} === ERROR: ${e.message}`); }
  };
  await q(`SELECT column_name, data_type, character_maximum_length AS len, is_nullable, column_default
           FROM information_schema.columns WHERE table_schema='public' AND table_name='quote_requests'
           ORDER BY ordinal_position`, "quote_requests all columns");
  await q(`SELECT column_name, data_type, character_maximum_length AS len, is_nullable, column_default
           FROM information_schema.columns WHERE table_schema='public' AND table_name='catalog_items'
           ORDER BY ordinal_position`, "catalog_items all columns");
  await q(`SELECT column_name, data_type, character_maximum_length AS len, is_nullable, column_default
           FROM information_schema.columns WHERE table_schema='public' AND table_name='users'
           ORDER BY ordinal_position`, "users all columns");
  await q(`SELECT column_name, data_type, character_maximum_length AS len, is_nullable, column_default
           FROM information_schema.columns WHERE table_schema='public' AND table_name='bookings'
           ORDER BY ordinal_position`, "bookings all columns");
  await q(`SELECT column_name, data_type, character_maximum_length AS len, is_nullable, column_default
           FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('contact_messages','content_pages','notifications','activity_logs')
           ORDER BY table_name, ordinal_position`, "remaining tables");
  await client.end();
})();
