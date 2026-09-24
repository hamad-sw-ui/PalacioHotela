import { z } from "zod";

export const assistantCategory = z.enum(["accommodation", "conference_room", "event_hall", "service", "restaurant"]);

export const quoteAssistantLineSchema = z.object({
  requestedLabel: z.string().trim().min(1).max(200),
  category: assistantCategory,
  catalogItemId: z.coerce.number().int().positive().optional(),
  quantity: z.coerce.number().int().min(1).max(1000).default(1),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(60).optional(),
  mealTypes: z.array(z.string().trim().max(30)).max(5).optional(),
  orderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  parentItemName: z.string().trim().max(200).optional(),
  confidence: z.coerce.number().min(0).max(1).default(0.5),
  ambiguity: z.string().trim().max(300).optional(),
}).strict();

export const quoteAssistantModelSchema = z.object({
  lines: z.array(quoteAssistantLineSchema).max(30).default([]),
  questions: z.array(z.string().trim().min(3).max(300)).max(5).default([]),
  warnings: z.array(z.string().trim().min(3).max(300)).max(5).default([]),
  confidence: z.coerce.number().min(0).max(1).default(0.5),
}).strict();

export const quoteAssistantInputSchema = z.object({
  locale: z.enum(["fr", "en"]).default("fr"),
  message: z.string().trim().min(10).max(4000),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  people: z.coerce.number().int().min(1).max(1000).optional(),
}).strict();

export type QuoteAssistantLine = z.infer<typeof quoteAssistantLineSchema>;
export type QuoteAssistantResult = z.infer<typeof quoteAssistantModelSchema> & {
  source: "local" | "ai";
  canApply: boolean;
};
