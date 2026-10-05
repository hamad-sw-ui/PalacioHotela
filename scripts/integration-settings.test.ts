import assert from "node:assert/strict";
import test from "node:test";
import { settingsForBrowser } from "../src/lib/smtp";
import { isValidWhatsAppNumber, whatsappUrl } from "../src/lib/whatsapp";

const SECRETS = ["smtpPassword", "aiApiKey", "stripeSecretKey", "stripeWebhookSecret", "paypalClientId", "paypalClientSecret", "googleClientSecret"] as const;

test("every integration secret is blanked before reaching the browser", () => {
  const stored = {
    hotelName: "Palacio",
    smtpHost: "smtp.gmail.com",
    smtpUser: "desk@palacio.test",
    smtpPassword: "smtp-secret",
    aiApiKey: "ai-secret",
    stripeSecretKey: "sk_live_secret",
    stripeWebhookSecret: "whsec_secret",
    paypalClientId: "paypal-id",
    paypalClientSecret: "paypal-secret",
    googleClientId: "google-id.apps.googleusercontent.com",
    googleClientSecret: "google-secret",
  };
  const visible = settingsForBrowser(stored);
  for (const secret of SECRETS) {
    assert.equal(visible[secret], "", `${secret} must be blanked`);
  }
});

test("no secret value survives anywhere in the payload", () => {
  const stored = Object.fromEntries(SECRETS.map((key) => [key, `secret-for-${key}`]));
  const serialised = JSON.stringify(settingsForBrowser(stored));
  for (const secret of SECRETS) {
    assert.equal(serialised.includes(`secret-for-${secret}`), false, `${secret} leaked into the payload`);
  }
});

test("non-secret integration settings stay readable", () => {
  const visible = settingsForBrowser({
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    smtpSecure: false,
    smtpRequireTls: true,
    smtpUser: "desk@palacio.test",
    smtpFrom: "Palacio Hotel <bonjour@palacio.test>",
    paypalEnv: "sandbox",
    paypalXafPerEur: 655.957,
    googleClientId: "google-id.apps.googleusercontent.com",
  });
  assert.equal(visible.smtpHost, "smtp.gmail.com");
  assert.equal(visible.smtpPort, 587);
  assert.equal(visible.smtpSecure, false);
  assert.equal(visible.smtpRequireTls, true);
  assert.equal(visible.smtpUser, "desk@palacio.test");
  assert.equal(visible.smtpFrom, "Palacio Hotel <bonjour@palacio.test>");
  assert.equal(visible.paypalEnv, "sandbox");
  assert.equal(visible.paypalXafPerEur, 655.957);
  assert.equal(visible.googleClientId, "google-id.apps.googleusercontent.com");
});

test("a blanked secret is falsy, so the API keeps the stored value", () => {
  const visible = settingsForBrowser({ smtpPassword: "smtp-secret", stripeSecretKey: "sk_live_secret" });
  assert.equal(Boolean(visible.smtpPassword), false);
  assert.equal(Boolean(visible.stripeSecretKey), false);
  assert.equal(visible.smtpPassword || "kept-unchanged", "kept-unchanged");
  assert.equal(visible.stripeSecretKey || "kept-unchanged", "kept-unchanged");
});

test("WhatsApp accepts international numbers and common formatting only", () => {
  assert.equal(isValidWhatsAppNumber("+237 699 000 000"), true);
  assert.equal(isValidWhatsAppNumber("237699000000"), true);
  assert.equal(isValidWhatsAppNumber("237699"), false);
  assert.equal(isValidWhatsAppNumber("00237699000000"), false);
  assert.equal(isValidWhatsAppNumber("237+699000000"), false);
  assert.equal(isValidWhatsAppNumber("++237699000000"), false);
  assert.equal(isValidWhatsAppNumber("237699000000<script>"), false);
  assert.equal(isValidWhatsAppNumber(""), false);
});

test("WhatsApp links preserve the existing wa.me format with encoded messages", () => {
  assert.equal(whatsappUrl("+237 699-000-000", "Bonjour Palacio !"), "https://wa.me/237699000000?text=Bonjour%20Palacio%20!");
});