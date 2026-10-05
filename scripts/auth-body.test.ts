import assert from "node:assert/strict";
import test from "node:test";
import { authBodySchema, normalizeAuthBody } from "../src/lib/auth-body";

test("sign-in ignores the empty profile fields sent by the account form", () => {
  const parsed = authBodySchema.parse(normalizeAuthBody({
    action: "login",
    email: " Admin@PalacioHotel.com ",
    password: "Palacio2026!",
    fullName: "",
    phone: "   ",
    country: "",
    locale: "fr",
  }));
  assert.equal(parsed.action, "login");
  assert.equal(parsed.email, "admin@palaciohotel.com");
  assert.equal(parsed.fullName, undefined);
  assert.equal(parsed.phone, undefined);
  assert.equal(parsed.country, undefined);
});
