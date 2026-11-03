(async () => {
  const base = "http://127.0.0.1:3000";
  const login = await fetch(base + "/api/auth", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "login", email: "admin@palaciohotel.com", password: "Palacio-2026" }),
  });
  console.log("login", login.status, (await login.text()).slice(0, 200));
  const cookie = login.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
  const probe = await fetch(base + "/api/admin/ai-test", {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({}),
  });
  console.log("ai-test", probe.status, (await probe.text()).slice(0, 400));
})();
