// Test de bout en bout : login admin → update settings avec une nouvelle hero_image → lecture en base
require("dotenv").config({ path: "/var/www/palacio/.env" });
const { Pool } = require("/var/www/palacio/node_modules/pg");

function http(method, path, body, cookie) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = require("http").request({
      host: "localhost", port: 3000, path, method,
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}), ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}) }
    },
      (res) => { let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: b })); });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  const pass = process.env.ADMIN_PASSWORD;
  // 1. login
  const login = await http("POST", "/api/auth", { action: "login", email: "admin@palaciohotel.com", password: pass });
  const setCookie = login.headers["set-cookie"]?.[0] || "";
  const cookie = setCookie.split(";")[0];
  console.log("login:", login.status);
  // 2. update settings avec une image existante (celle du hero actuel → pas de changement réel, on teste juste le round-trip)
  const current = await http("GET", "/api/admin/data", null, cookie);
  const data = JSON.parse(current.body);
  const hero = data.settings.heroImage;
  console.log("hero actuel:", hero);
  // Changement vers une autre image existante puis retour
  const about = data.settings.aboutImage;
  const upd = await http("POST", "/api/admin/manage", { resource: "settings", action: "update", id: 1, data: { heroImage: about } }, cookie);
  console.log("update heroImage→about:", upd.status, upd.body.slice(0, 120));
  const after = JSON.parse((await http("GET", "/api/admin/data", null, cookie)).body);
  console.log("hero après update:", after.settings.heroImage, after.settings.heroImage === about ? "✅ SAUVEGARDÉ" : "❌ PERDU");
  // remise en état
  const back = await http("POST", "/api/admin/manage", { resource: "settings", action: "update", id: 1, data: { heroImage: hero } }, cookie);
  console.log("restauration:", back.status);
  const final = JSON.parse((await http("GET", "/api/admin/data", null, cookie)).body);
  console.log("hero final:", final.settings.heroImage, final.settings.heroImage === hero ? "✅ RESTAURÉ" : "❌");
  process.exit(0);
})().catch((e) => { console.error("ERREUR:", e.message); process.exit(1); });
