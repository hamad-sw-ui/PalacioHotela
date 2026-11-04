import { test } from "node:test";
import assert from "node:assert";
import { callAiChat, modelCandidates, probeAi, resolveAiConfig, GEMINI_FALLBACK_MODELS, GEMINI_DEFAULT_MODEL } from "@/lib/ai-provider";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";
type Msg = { role: "system" | "user"; content: string };

function jsonFetch(responses: { status: number; body: unknown }[]) {
  let index = 0;
  const bodies: string[] = [];
  const fetchImpl = (async (_url: unknown, init?: { body?: string }) => {
    bodies.push(String(init?.body || ""));
    const item = responses[Math.min(index++, responses.length - 1)];
    return new Response(JSON.stringify(item.body), { status: item.status, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  return { fetchImpl, bodies };
}

test("chat uses the AI provider and returns its reply", async () => {
  const sample = [{ status: 200, body: { choices: [{ message: { content: "Bonjour ! Voici nos chambres." } }] } }];
  const { fetchImpl, bodies } = jsonFetch(sample);
  const reply = await callAiChat([{ role: "system", content: "system" }, { role: "user", content: "Bonjour" }], { provider: "gemini", baseUrl: GEMINI_BASE, model: GEMINI_DEFAULT_MODEL, key: "k", fetchImpl: fetchImpl as never });
  assert.equal(reply, "Bonjour ! Voici nos chambres.");
  assert.match(bodies[0], /gemini/);
});

test("a saturated primary Gemini model falls back to a lighter model", async () => {
  const modelsRequested: string[] = [];
  const fetchImpl = (async (_url: unknown, init?: { body?: string }) => {
    const body = JSON.parse(String(init?.body || "{}"));
    modelsRequested.push(body.model);
    if (modelsRequested.length === 1) return new Response(JSON.stringify({ error: { code: 503, message: "high demand" } }), { status: 503, headers: { "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ choices: [{ message: { content: "Réponse de secours" } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  const reply = await callAiChat([{ role: "user", content: "Bonjour" }], { provider: "gemini", baseUrl: GEMINI_BASE, model: GEMINI_DEFAULT_MODEL, key: "k", fetchImpl: fetchImpl as never });
  assert.equal(reply, "Réponse de secours");
  assert.equal(modelsRequested[0], GEMINI_DEFAULT_MODEL);
  assert.equal(modelsRequested[1], GEMINI_FALLBACK_MODELS[0]);
});

test("quota exhaustion on every model ends with a clear error, keeping the local fallback usable", async () => {
  const fetchImpl = (async () => new Response(JSON.stringify({ error: { code: 429, message: "quota" } }), { status: 429, headers: { "Content-Type": "application/json" } })) as unknown as typeof fetch;
  await assert.rejects(() => callAiChat([{ role: "user" as const, content: "Bonjour" }], { provider: "gemini", baseUrl: GEMINI_BASE, model: GEMINI_DEFAULT_MODEL, key: "k", fetchImpl: fetchImpl as never }), /AI provider returned 429/);
});

test("an auth failure stops immediately without retrying other models", async () => {
  let calls = 0;
  const fetchImpl = (async () => { calls += 1; return new Response(JSON.stringify({ error: { code: 401, message: "bad key" } }), { status: 401, headers: { "Content-Type": "application/json" } }); }) as unknown as typeof fetch;
  const reply = await callAiChat([{ role: "user", content: "Bonjour" }], { provider: "gemini", baseUrl: GEMINI_BASE, model: GEMINI_DEFAULT_MODEL, key: "bad", fetchImpl: fetchImpl as never });
  assert.equal(reply, null);
  assert.equal(calls, 1, "a 401 must not be retried on fallback models");
});

test("model candidates keep the configured model first and only Gemini gets fallbacks", () => {
  assert.deepEqual(modelCandidates("gemini", ""), [GEMINI_DEFAULT_MODEL, ...GEMINI_FALLBACK_MODELS]);
  assert.deepEqual(modelCandidates("gemini", "gemini-3.8-flash"), ["gemini-3.8-flash", ...GEMINI_FALLBACK_MODELS]);
  assert.deepEqual(modelCandidates("openai", ""), ["gpt-4o-mini"]);
  assert.deepEqual(modelCandidates("openai", "gpt-4o"), ["gpt-4o"]);
  assert.deepEqual(modelCandidates("ollama", ""), []);
  assert.deepEqual(modelCandidates("ollama", "llama3.2"), ["llama3.2"]);
});

test("the probe verifies the first reachable Gemini model", async () => {
  let calls = 0;
  const fetchImpl = (async (_url: unknown, init?: { body?: string }) => {
    calls += 1;
    const body = JSON.parse(String(init?.body || "{}"));
    if (calls === 1 && body.model === GEMINI_DEFAULT_MODEL) return new Response(JSON.stringify({ error: { code: 503 } }), { status: 503, headers: { "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
  const result = await probeAi({ settings: { aiProvider: "gemini", aiBaseUrl: "", aiModel: "", aiApiKey: "k" }, fetchImpl });
  assert.equal(result.verified, true);
  assert.ok(calls >= 2, "the probe should fall back after the saturated primary model");
});

test("resolveAiConfig keeps the platform key priority and uses env fallback for chat", () => {
  const env = { AI_PROVIDER: "openai", AI_API_KEY: "env-key", AI_BASE_URL: "https://api.openai.com", AI_MODEL: "gpt-4o-mini" };
  const explicitPageKey = resolveAiConfig({ aiProvider: "gemini", aiBaseUrl: "", aiModel: "", aiApiKey: "page-key" }, env, "chat");
  assert.equal(explicitPageKey.key, "page-key");
  const explicitNoKey = resolveAiConfig({ aiProvider: "gemini", aiBaseUrl: "", aiModel: "", aiApiKey: "" }, env, "chat");
  assert.equal(explicitNoKey.key, "env-key", "the env key must back an explicit Gemini provider configured without a key");
  assert.equal(explicitNoKey.model, "gemini-3.8-flash");
});

test("messages stay typed as chat roles", () => {
  const messages: Msg[] = [{ role: "system", content: "a" }, { role: "user", content: "b" }];
  assert.equal(messages.length, 2);
});
