// Tests des flux reservation + devis (invite / connecte)
const BASE = "http://localhost:3000";
const out = [];
function log(line) { out.push(line); console.log(line); }

async function jf(path, opts = {}) {
  const r = await fetch(BASE + path, opts);
  let body = {};
  try { body = await r.json(); } catch {}
  return { status: r.status, body, headers: r.headers };
}

(async () => {
  try {
    // 0. sanity
    const health = await jf("/api/health");
    log("health: " + health.status);

    // 1. disponibilite pour trouver les items actifs + inventory
    const disp = await jf("/api/availability?checkIn=2027-01-10&checkOut=2027-01-12");
    const items = disp.body.availability || [];
    const item = items.find(i => (i.category || "").includes("room") || (i.category || "").includes("hebergement")) || items.find(i => (i.remaining || 0) >= 1) || items[0];
    if (!item) throw new Error("aucun item actif");
    log("availability: " + disp.status + " item1=" + item.itemId + " remaining=" + item.remaining);

    // 2. INVITE : devis quantity > stock -> attendu 400/409
    const q1 = await jf("/api/v1/quote-requests", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestName: "Invite Test", guestEmail: "invite@test.cm", guestPhone: "+237600000001", requestKind: "accommodation", selectedItems: [{ property_id: item.itemId, quantity: 99, check_in: "2027-01-10", check_out: "2027-01-12" }], checkIn: "2027-01-10", checkOut: "2027-01-12", people: 2, message: "Test capacite depassee pour la verification non regression." }) });
    log("quote invite qty>stock: " + q1.status + " " + (q1.body.error || "").slice(0, 80));

    // 3. INVITE : devis valide -> 201
    const q2 = await jf("/api/v1/quote-requests", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestName: "Invite Test", guestEmail: "invite@test.cm", guestPhone: "+237600000001", requestKind: "accommodation", selectedItems: [{ property_id: item.itemId, quantity: 1, check_in: "2027-01-10", check_out: "2027-01-12" }], checkIn: "2027-01-10", checkOut: "2027-01-12", people: 2, message: "Demande de devis invite pour verification non regression." }) });
    log("quote invite valide: " + q2.status + " ref=" + (q2.body.reference || "-") + " err=" + (q2.body.error || "").slice(0, 100));

    // 4. INVITE : devis people > capacite totale -> attendu 400
    const q3 = await jf("/api/v1/quote-requests", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestName: "Invite Test", guestEmail: "invite@test.cm", guestPhone: "+237600000001", requestKind: "accommodation", selectedItems: [{ property_id: item.itemId, quantity: 1, check_in: "2027-01-20", check_out: "2027-01-22" }], checkIn: "2027-01-20", checkOut: "2027-01-22", people: 5000, message: "Test people superieur a la capacite totale de l hotel." }) });
    log("quote invite people>cap: " + q3.status + " " + (q3.body.error || "").slice(0, 80));

    // 5. REGISTER compte test
    const reg = await jf("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "register", email: "client-test@palacio.cm", password: "Password2026!", fullName: "Client Test Palacio", phone: "+237655000002", country: "Cameroun", locale: "fr" }) });
    const token0 = reg.body.token || "";
    let token = token0;
    log("register: " + reg.status + " role=" + (reg.body.user?.role || "-") + " phone=" + (reg.body.user?.phone || "-"));
    if (reg.status === 409) {
      const lg = await jf("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email: "client-test@palacio.cm", password: "Password2026!" }) });
      log("login: " + lg.status);
      token = lg.body.token || token;
    }
    const H = { "Content-Type": "application/json", Authorization: "Bearer " + token };

    // 6. GET /api/auth renvoie phone
    const me = await jf("/api/auth", { headers: { Authorization: "Bearer " + token } });
    const t2 = me.body.token || token;
    H.Authorization = "Bearer " + t2;
    log("me.phone: " + (me.body.user?.phone || "ABSENT"));

    // 7. CONNECTE : devis avec coordonnees spoofees -> serveur doit ignorer et utiliser celles du compte
    const q4 = await jf("/api/v1/quote-requests", { method: "POST", headers: H,
      body: JSON.stringify({ guestName: "FAUX NOM", guestEmail: "spoof@evil.cm", guestPhone: "+331111111111", company: "X", requestKind: item.category || "accommodation", selectedItems: [{ property_id: item.itemId, quantity: 1, check_in: "2027-02-01", check_out: "2027-02-03" }], checkIn: "2027-02-01", checkOut: "2027-02-03", people: 2, message: "Test anti-spoofing des coordonnees du client connecte." }) });
    log("quote connecte: " + q4.status + " ref=" + (q4.body.reference || "-"));

    // 8. CONNECTE : reservation avec coordonnees spoofees -> 201 et nom du compte
    const b1 = await jf("/api/bookings", { method: "POST", headers: H,
      body: JSON.stringify({ itemId: item.itemId, checkIn: "2027-03-01", checkOut: "2027-03-03", guests: Math.min(2, item.capacity || 2), quantity: 1, guestName: "FAUX NOM", guestEmail: "spoof@evil.cm", guestPhone: "+331111111111", notes: "Test anti-spoofing reservation.", paymentMethod: "cash", locale: "fr" }) });
    log("booking connecte: " + b1.status + " ref=" + (b1.body.reference || "-"));
  } catch (e) {
    log("FATAL: " + e.message);
  }
  const fs = require("fs");
  fs.writeFileSync("flow-results.txt", out.join("\n"));
})();
