import nodemailer from "nodemailer";

export type SmtpEnv = {
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_SECURE?: string;
  SMTP_REQUIRE_TLS?: string;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  SMTP_FROM?: string;
};

export type SmtpSettings = {
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecure?: boolean | null;
  smtpRequireTls?: boolean | null;
  smtpUser?: string | null;
  smtpPassword?: string | null;
  smtpFrom?: string | null;
};

export function smtpEnvFromSettings(settings: SmtpSettings | null | undefined, env: SmtpEnv = process.env as unknown as SmtpEnv): SmtpEnv {
  const host = settings?.smtpHost?.trim() || "";
  if (!host) return env;
  return {
    SMTP_HOST: host,
    SMTP_PORT: String(settings?.smtpPort || 587),
    SMTP_SECURE: settings?.smtpSecure ? "true" : "false",
    SMTP_REQUIRE_TLS: settings?.smtpRequireTls === false ? "false" : "true",
    SMTP_USER: settings?.smtpUser?.trim() || "",
    SMTP_PASSWORD: settings?.smtpPassword || "",
    SMTP_FROM: settings?.smtpFrom?.trim() || "",
  };
}

export function settingsForBrowser<T extends object>(settings: T): T {
  if (!settings || typeof settings !== "object") return settings;
  if (!("smtpPassword" in settings) && !("aiApiKey" in settings) && !("stripeSecretKey" in settings) && !("stripeWebhookSecret" in settings) && !("paypalClientId" in settings) && !("paypalClientSecret" in settings) && !("googleClientSecret" in settings)) return settings;
  return {
    ...settings,
    ...("smtpPassword" in settings ? { smtpPassword: "" } : {}),
    ...("aiApiKey" in settings ? { aiApiKey: "" } : {}),
    ...("stripeSecretKey" in settings ? { stripeSecretKey: "" } : {}),
    ...("stripeWebhookSecret" in settings ? { stripeWebhookSecret: "" } : {}),
    ...("paypalClientId" in settings ? { paypalClientId: "" } : {}),
    ...("paypalClientSecret" in settings ? { paypalClientSecret: "" } : {}),
    ...("googleClientSecret" in settings ? { googleClientSecret: "" } : {}),
  };
}

export function smtpTransportOptions(env: SmtpEnv = process.env as unknown as SmtpEnv) {
  if (!env.SMTP_HOST) return null;
  const port = Number(env.SMTP_PORT || "587");
  return {
    host: env.SMTP_HOST,
    port,
    secure: env.SMTP_SECURE === "true" || port === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD || "" } : undefined,
    requireTLS: port !== 465 && env.SMTP_REQUIRE_TLS === "true",
  };
}

export function smtpFromAddress(hotelName: string, hotelEmail: string, env: SmtpEnv = process.env as unknown as SmtpEnv) {
  return env.SMTP_FROM || `"${hotelName}" <${env.SMTP_USER || hotelEmail}>`;
}

export function redactSmtpError(error: unknown, password = "") {
  const message = error instanceof Error ? error.message : "Connexion SMTP impossible.";
  const cleaned = password ? message.split(password).join("••••") : message;
  return cleaned.slice(0, 300);
}

type ProbeTransport = {
  verify: () => Promise<unknown>;
  sendMail: (message: { from: string; to: string; subject: string; html: string }) => Promise<unknown>;
};

export async function probeSmtp(input: {
  hotelName: string;
  hotelEmail: string;
  send?: boolean;
  to?: string;
  env?: SmtpEnv;
  createTransport?: (options: NonNullable<ReturnType<typeof smtpTransportOptions>>) => ProbeTransport;
}) {
  const env = input.env || (process.env as unknown as SmtpEnv);
  const options = smtpTransportOptions(env);
  if (!options) return { configured: false, verified: false, sent: false, code: "missing" as const };
  const createTransport = input.createTransport || ((transportOptions) => nodemailer.createTransport({
    ...transportOptions,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  }));
  const transport = createTransport(options);
  try {
    await transport.verify();
  } catch (error) {
    return { configured: true, verified: false, sent: false, code: "failed" as const, error: redactSmtpError(error, env.SMTP_PASSWORD || "") };
  }
  if (!input.send) return { configured: true, verified: true, sent: false, code: "verified" as const };
  const to = (input.to || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { configured: true, verified: true, sent: false, code: "no_recipient" as const };
  try {
    await transport.sendMail({
      from: smtpFromAddress(input.hotelName, input.hotelEmail, env),
      to,
      subject: `Essai SMTP · ${input.hotelName}`,
      html: `<p>Ceci est un e-mail d'essai. La connexion SMTP de ${input.hotelName} fonctionne.</p>`,
    });
    return { configured: true, verified: true, sent: true, code: "sent" as const, to };
  } catch (error) {
    return { configured: true, verified: true, sent: false, code: "send_failed" as const, error: redactSmtpError(error, env.SMTP_PASSWORD || "") };
  }
}
