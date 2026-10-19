const { Client } = require("pg");
const c = new Client({ connectionString: "postgresql://postgres:postgres@127.0.0.1:5432/palacio_preview" });
c.connect().then(async () => {
  const r = await c.query("select email, role from users order by role limit 8");
  console.log("users:", r.rows.map(x => `${x.email}(${x.role})`).join(", "));
  const ci = await c.query("select * from catalog_items order by id limit 1");
  console.log("catalog columns:", Object.keys(ci.rows[0] || {}).join(", "));
  const b = await c.query("select count(*) from bookings");
  const q = await c.query("select count(*) from quote_requests");
  console.log("bookings:", b.rows[0].count, "| quotes:", q.rows[0].count);
  await c.end();
}).catch(e => { console.error(e.message); process.exit(1); });
