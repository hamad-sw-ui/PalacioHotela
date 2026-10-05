import { z } from "zod";

const name = z.string().trim().min(2).max(180);
const email = z.email().max(255).transform((v) => v.trim().toLowerCase());
const phone = z.string().trim().min(6).max(60);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalDate = z.preprocess((value) => (value === "" || value === undefined ? null : value), date.nullable());
const optionalPeople = z.preprocess((value) => (value === "" || value === undefined ? null : value), z.union([z.null(), z.coerce.number().int().min(1).max(1000)]));
const mealType = z.enum(["breakfast", "lunch", "dinner", "snacks", "other"]);

export const bookingInput = z.object({
  itemId: z.coerce.number().int().positive(),
  guestName: name,
  guestEmail: email,
  guestPhone: phone,
  checkIn: date,
  checkOut: date,
  guests: z.coerce.number().int().min(1).max(500),
  quantity: z.coerce.number().int().min(1).max(25).default(1),
  notes: z.string().trim().max(2000).default(""),
  paymentMethod: z.enum(["cash", "card", "paypal"]),
  locale: z.enum(["fr", "en"]).default("fr"),
});

const quoteItemInput = z.object({
  property_id: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().min(1).max(50).default(1),
  check_in: date.optional(),
  check_out: date.optional(),
  dates: z.array(date).max(30).optional(),
  order_date: date.optional(),
  order_dates: z.array(date).max(30).optional(),
  order_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  meal_types: z.array(mealType).max(5).optional(),
  parent_id: z.coerce.number().int().positive().optional(),
  parent_item_name: z.string().trim().max(200).optional(),
});

export const quoteInput = z.object({
  guestName: name,
  guestEmail: email,
  guestPhone: phone,
  company: z.string().trim().max(180).optional().default(""),
  locale: z.enum(["fr", "en"]).default("fr"),
  requestKind: z.enum(["accommodation", "conference_room", "event_hall", "service", "restaurant", "mixed"]),
  selectedItems: z.array(quoteItemInput).max(20).default([]),
  checkIn: optionalDate,
  checkOut: optionalDate,
  people: optionalPeople,
  message: z.string().trim().max(4000).optional().default(""),
  budget: z.coerce.number().int().min(0).max(1000000000).optional().nullable(),
});

export const contactInput = z.object({
  name,
  email,
  phone: z.string().trim().max(60).optional().default(""),
  subject: z.string().trim().min(3).max(240),
  message: z.string().trim().min(10).max(4000),
});

export function parseError(error: unknown) {
  if (error instanceof z.ZodError) return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" · ");
  return error instanceof Error ? error.message : "Une erreur est survenue.";
}
