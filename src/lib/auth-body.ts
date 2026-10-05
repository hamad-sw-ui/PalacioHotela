import { z } from "zod";

const emailField = z.preprocess((value) => typeof value === "string" ? value.trim().toLowerCase() : value, z.email().max(255));

/** Blank optional fields are omitted so a sign-in form can send them without failing validation. */
export function normalizeAuthBody(body: Record<string, unknown>) {
  const text = (value: unknown) => typeof value === "string" && value.trim() ? value : undefined;
  return { ...body, fullName: text(body.fullName), phone: text(body.phone), country: text(body.country) };
}

export const authBodySchema = z.object({
  action: z.enum(["login", "register"]),
  email: emailField,
  password: z.string().min(1).max(200),
  fullName: z.string().trim().min(2).max(180).optional(),
  phone: z.string().trim().min(6).max(60).optional(),
  country: z.string().trim().min(2).max(120).optional(),
  locale: z.enum(["fr", "en"]).optional(),
});
