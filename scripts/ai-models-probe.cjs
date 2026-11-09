require("dotenv/config");
const base = "https://generativelanguage.googleapis.com/v1beta/openai";
const key = process.env.GOOGLE_API_KEY;
if (!key) throw new Error("Missing GOOGLE_API_KEY; set it in the ignored .env file or environment.");
const models = ["gemini-3.8-flash", "gemini-3.8-flash-lite", "gemini-2.5-flash-lite"];
(async () => {
  for (const model of models) {
    try {
      const r = await fetch(base + "/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
        body: JSON.stringify({ model, max_tokens: 16, messages: [{ role: "user", content: "Reply with OK" }] }),
      });
      console.log(model, "->", r.status, (await r.text()).slice(0, 120));
    } catch (e) { console.log(model, "ERR", e.message); }
  }
})();
