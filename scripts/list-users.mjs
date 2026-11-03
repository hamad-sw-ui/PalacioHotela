import { Pool } from "pg";
import { config } from "dotenv";
config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const r = await pool.query("select id, email, role, full_name from users order by id asc");
console.log(r.rows);
await pool.end();
