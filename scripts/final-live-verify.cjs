// Final production verification on the real domain
(async () => {
  const base = "https://xn--palaciohtel-9eb.com";
  console.log("=== health ===");
  const h = await fetch(base + "/api/health", { signal: AbortSignal.timeout(20000) });
  console.log("health:", h.status, await h.text());
  console.log("=== chat (question propriétaire) ===");
  const r = await fetch(base + "/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale: "fr", messages: [{ role: "user", content: "je suis perdu je ne sais pas comment faire dans la plateforme" }] }),
    signal: AbortSignal.timeout(60000),
  });
  const d = await r.json();
  console.log("source:", d.source);
  console.log("reply:", (d.reply || "").slice(0, 300));
})();
