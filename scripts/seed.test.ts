import assert from "node:assert/strict";
import { test } from "node:test";

const envRecord = process.env as Record<string, string | undefined>;

function captureEnv() {
  const previous = {
    ADMIN_EMAIL: envRecord.ADMIN_EMAIL,
    ADMIN_PASSWORD: envRecord.ADMIN_PASSWORD,
    NODE_ENV: envRecord.NODE_ENV,
  };
  return {
    restore() {
      if (previous.ADMIN_EMAIL === undefined) delete envRecord.ADMIN_EMAIL;
      else envRecord.ADMIN_EMAIL = previous.ADMIN_EMAIL;
      if (previous.ADMIN_PASSWORD === undefined) delete envRecord.ADMIN_PASSWORD;
      else envRecord.ADMIN_PASSWORD = previous.ADMIN_PASSWORD;
      if (previous.NODE_ENV === undefined) delete envRecord.NODE_ENV;
      else envRecord.NODE_ENV = previous.NODE_ENV;
    },
    setAdmin(key: "ADMIN_EMAIL" | "ADMIN_PASSWORD", value: string | undefined) {
      if (value === undefined) delete envRecord[key];
      else envRecord[key] = value;
    },
    setNodeEnv(value: string | undefined) {
      if (value === undefined) delete envRecord.NODE_ENV;
      else envRecord.NODE_ENV = value;
    },
  };
}

test("ensureAdminAccount échoue en production si ADMIN_EMAIL est absent", async () => {
  const env = captureEnv();
  env.setNodeEnv("production");
  env.setAdmin("ADMIN_EMAIL", undefined);
  env.setAdmin("ADMIN_PASSWORD", "anything");
  try {
    const { ensureAdminAccount } = await import("@/lib/seed");
    await assert.rejects(() => ensureAdminAccount(), /ADMIN_EMAIL et ADMIN_PASSWORD/);
  } finally {
    env.restore();
  }
});

test("ensureAdminAccount échoue en production si ADMIN_PASSWORD est absent", async () => {
  const env = captureEnv();
  env.setNodeEnv("production");
  env.setAdmin("ADMIN_EMAIL", "admin@palaciohotel.com");
  env.setAdmin("ADMIN_PASSWORD", undefined);
  try {
    const { ensureAdminAccount } = await import("@/lib/seed");
    await assert.rejects(() => ensureAdminAccount(), /ADMIN_EMAIL et ADMIN_PASSWORD/);
  } finally {
    env.restore();
  }
});

test("ensureAdminAccount n'utilise pas Palacio2026! par défaut en production", async () => {
  const env = captureEnv();
  env.setNodeEnv("production");
  env.setAdmin("ADMIN_EMAIL", undefined);
  env.setAdmin("ADMIN_PASSWORD", undefined);
  try {
    const { ensureAdminAccount } = await import("@/lib/seed");
    await assert.rejects(() => ensureAdminAccount(), /ADMIN_EMAIL et ADMIN_PASSWORD/);
  } finally {
    env.restore();
  }
});

test("ensureAdminAccount en développement crée un compte de fallback sans échouer sur config manquante", async () => {
  const env = captureEnv();
  env.setNodeEnv("development");
  env.setAdmin("ADMIN_EMAIL", undefined);
  env.setAdmin("ADMIN_PASSWORD", undefined);
  try {
    const { ensureAdminAccount } = await import("@/lib/seed");
    await assert.doesNotReject(() => ensureAdminAccount());
  } finally {
    env.restore();
  }
});
