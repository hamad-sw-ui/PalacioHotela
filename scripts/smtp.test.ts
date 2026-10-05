import assert from "node:assert/strict";
import { test } from "node:test";
import { probeSmtp, redactSmtpError, settingsForBrowser, smtpEnvFromSettings, smtpFromAddress, smtpTransportOptions } from "@/lib/smtp";

const env = {
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: "587",
  SMTP_SECURE: "false",
  SMTP_REQUIRE_TLS: "true",
  SMTP_USER: "hotel@example.com",
  SMTP_PASSWORD: "secret-pass",
  SMTP_FROM: "Palacio Hotel <hotel@example.com>",
};

test("smtp options stay the same for submission and for the connection test", () => {
  assert.equal(smtpTransportOptions({}), null);
  assert.deepEqual(smtpTransportOptions(env), {
    host: "smtp.example.com",
    port: 587,
    secure: false,
    auth: { user: "hotel@example.com", pass: "secret-pass" },
    requireTLS: true,
  });
  assert.equal(smtpTransportOptions({ ...env, SMTP_PORT: "465", SMTP_SECURE: "false" })?.secure, true);
  assert.equal(smtpTransportOptions({ ...env, SMTP_PORT: "465" })?.requireTLS, false);
  assert.equal(smtpTransportOptions({ SMTP_HOST: "smtp.example.com" })?.auth, undefined);
  assert.equal(smtpFromAddress("Palacio", "desk@palacio.test", env), "Palacio Hotel <hotel@example.com>");
  assert.equal(smtpFromAddress("Palacio", "desk@palacio.test", { SMTP_USER: "mailer@palacio.test" }), `"Palacio" <mailer@palacio.test>`);
});

test("a connection test never sends mail, and a failed password is not repeated", async () => {
  let sent = 0;
  const verified = await probeSmtp({
    hotelName: "Palacio",
    hotelEmail: "desk@palacio.test",
    env,
    createTransport: () => ({ verify: async () => true, sendMail: async () => { sent += 1; } }),
  });
  assert.equal(verified.code, "verified");
  assert.equal(verified.sent, false);
  assert.equal(sent, 0);

  const missing = await probeSmtp({ hotelName: "Palacio", hotelEmail: "desk@palacio.test", env: {}, createTransport: () => { throw new Error("should not connect"); } });
  assert.equal(missing.code, "missing");

  const failed = await probeSmtp({
    hotelName: "Palacio",
    hotelEmail: "desk@palacio.test",
    env,
    createTransport: () => ({ verify: async () => { throw new Error("Invalid login: secret-pass"); }, sendMail: async () => undefined }),
  });
  assert.equal(failed.code, "failed");
  assert.equal(failed.error?.includes("secret-pass"), false);
  assert.match(redactSmtpError(new Error("auth secret-pass refused"), "secret-pass"), /••••/);
});

test("platform SMTP replaces the server variables only when a host is saved", () => {
  const platform = { smtpHost: "mail.hotel.test", smtpPort: 465, smtpSecure: true, smtpRequireTls: false, smtpUser: "desk@hotel.test", smtpPassword: "platform-secret", smtpFrom: "Palacio <desk@hotel.test>" };
  assert.deepEqual(smtpEnvFromSettings(platform, env), {
    SMTP_HOST: "mail.hotel.test",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_REQUIRE_TLS: "false",
    SMTP_USER: "desk@hotel.test",
    SMTP_PASSWORD: "platform-secret",
    SMTP_FROM: "Palacio <desk@hotel.test>",
  });
  assert.equal(smtpEnvFromSettings({ smtpHost: "  " }, env), env);
  assert.equal(smtpEnvFromSettings(null, env), env);
  assert.deepEqual(smtpTransportOptions(smtpEnvFromSettings(platform, env)), {
    host: "mail.hotel.test",
    port: 465,
    secure: true,
    auth: { user: "desk@hotel.test", pass: "platform-secret" },
    requireTLS: false,
  });
  assert.equal(settingsForBrowser({ hotelName: "Palacio", smtpPassword: "platform-secret", aiApiKey: "platform-ai-secret" }).smtpPassword, "");
  assert.equal(settingsForBrowser({ hotelName: "Palacio", smtpPassword: "platform-secret", aiApiKey: "platform-ai-secret" }).aiApiKey, "");
  assert.equal(settingsForBrowser({ hotelName: "Palacio", stripeSecretKey: "sk_test_platform", stripeWebhookSecret: "whsec_platform" }).stripeSecretKey, "");
  assert.equal(settingsForBrowser({ hotelName: "Palacio", stripeSecretKey: "sk_test_platform", stripeWebhookSecret: "whsec_platform" }).stripeWebhookSecret, "");
  assert.equal(settingsForBrowser({ hotelName: "Palacio", paypalClientId: "client-id", paypalClientSecret: "client-secret" }).paypalClientId, "");
  assert.equal(settingsForBrowser({ hotelName: "Palacio", paypalClientId: "client-id", paypalClientSecret: "client-secret" }).paypalClientSecret, "");
  const publicSettings = { hotelName: "Palacio" };
  assert.equal(settingsForBrowser(publicSettings).hotelName, "Palacio");
});

test("a test email is sent only when requested and only to the given address", async () => {
  const messages: Array<{ to: string; from: string; subject: string }> = [];
  const transport = () => ({
    verify: async () => true,
    sendMail: async (message: { to: string; from: string; subject: string }) => { messages.push(message); },
  });
  const sent = await probeSmtp({ hotelName: "Palacio", hotelEmail: "desk@palacio.test", send: true, to: "admin@palacio.test", env, createTransport: transport });
  assert.equal(sent.code, "sent");
  assert.equal(messages.length, 1);
  assert.equal(messages[0].to, "admin@palacio.test");
  assert.equal(messages[0].from, env.SMTP_FROM);
  assert.match(messages[0].subject, /Essai SMTP/);

  const refused = await probeSmtp({ hotelName: "Palacio", hotelEmail: "desk@palacio.test", send: true, to: "not-an-email", env, createTransport: transport });
  assert.equal(refused.code, "no_recipient");
  assert.equal(messages.length, 1);
});
