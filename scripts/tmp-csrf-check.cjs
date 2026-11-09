// Vérifie la chaîne CSRF vue par nginx : Host vs X-Forwarded-Host
// Scénario suspect : navigateur sur 2.24.49.223.sslip.io → nginx → Next.js
require("dotenv").config({ path: "/var/www/palacio/.env" });
const http = require("http");

function probe(headers) {
  return new Promise((resolve) => {
    const req = http.request({ host: "localhost", port: 3000, path: "/api/auth", method: "GET", headers }, (res) => {
      let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => resolve({ status: res.statusCode, body: b.slice(0, 100) }));
    });
    req.on("error", (e) => resolve({ status: "err", body: e.message }));
    req.end();
  });
}

(async () => {
  // Cas 1 : navigateur normal → nginx transmet Host = domaine + X-Forwarded-Host absent
  const r1 = await probe({ Host: "2.24.49.223.sslip.io" });
  console.log("sans X-Forwarded-Host :", r1.status);
  // Cas 2 : mutation POST simulée avec Origin = domaine, Host = domaine (config nginx actuelle)
  const pass = process.env.ADMIN_PASSWORD;
  const login = await new Promise((resolve) => {
    const data = JSON.stringify({ action: "login", email: "admin@palaciohotel.com", password: pass });
    const req = http.request({
      host: "localhost", port: 3000, path: "/api/auth", method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
    }, (res) => {
      let b = ""; res.on("data", (c) => (b += c));
      res.on("end", () => resolve({ status: res.statusCode, body: b, setCookie: res.headers["set-cookie"] }));
    });
    req.write(data); req.end();
  });
  const cookie = (login.setCookie?.find((c) => c.startsWith("palacio_session=")) || "").split(";")[0];
  console.log("login:", login.status, "cookie présent:", Boolean(cookie));
  // POST avec Origin différent du Host (simule un mismatch CSRF)
  const r2 = await new Promise((resolve) => {
    const data = JSON.stringify({ resource: "settings", action: "update", id: 1, data: {} });
    const req = http.request({
      host: "localhost", port: 3000, path: "/api/admin/manage", method: "POST",
      headers: {
        "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data), Cookie: cookie,
        Origin: "https://2.24.49.223.sslip.io", Host: "localhost:3000",
        "Sec-Fetch-Site": "same-origin", "X-Forwarded-Host": "2.24.49.223.sslip.io"
      }
    }, (res) => {
      let b = ""; res.on("data", (c) => (b += c)); res.on("end", () => resolve({ status: res.statusCode, body: b.slice(0, 120) }));
    });
    req.write(data); req.end();
  });
  console.log("POST avec Origin≠Host (via X-Forwarded-Host):", r2.status, r2.body);
  process.exit(0);
})();
