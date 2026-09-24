import type { SelectedItem } from "@/db/schema";
import { daysBetween } from "@/lib/format";

export type QuoteLineLike = Pick<SelectedItem, "type" | "price" | "quantity" | "nights" | "check_in" | "check_out" | "dates" | "order_date" | "order_dates" | "meal_types">;

export function normalizeDates(dates?: string[], fallback?: string) {
  return [...new Set([...(dates || []), ...(fallback ? [fallback] : [])].filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort();
}

export function normalizeMealTypes(mealTypes?: string[]) {
  return [...new Set((mealTypes || []).map((meal) => meal.trim().toLowerCase()).filter(Boolean))].sort();
}

export function lineQuantity(quantity: unknown) {
  const value = Number(quantity);
  return Number.isFinite(value) && value > 0 ? Math.max(1, Math.floor(value)) : 1;
}

export function lineUnits(item: QuoteLineLike) {
  const dates = normalizeDates(item.order_dates || item.dates, item.order_date || item.check_in);
  if (item.type === "restaurant") return Math.max(1, dates.length);
  if (item.type === "accommodation") {
    if (item.nights && item.nights > 0) return Math.max(1, Math.floor(item.nights));
    if (item.check_in && item.check_out) return Math.max(1, daysBetween(item.check_in, item.check_out));
  }
  if (item.type === "conference_room" || item.type === "event_hall") {
    if (dates.length > 0) return dates.length;
    if (item.check_in && item.check_out) return Math.max(1, daysBetween(item.check_in, item.check_out));
  }
  return 1;
}

export function lineMealUnits(item: QuoteLineLike) {
  return item.type === "restaurant" ? Math.max(1, normalizeMealTypes(item.meal_types).length) : 1;
}

export function quoteLineTotal(item: QuoteLineLike) {
  const price = Number(item.price);
  const safePrice = Number.isFinite(price) && price >= 0 ? Math.floor(price) : 0;
  return safePrice * lineQuantity(item.quantity) * lineUnits(item) * lineMealUnits(item);
}

export function quoteTotal(items: QuoteLineLike[]) {
  return items.reduce((total, item) => total + quoteLineTotal(item), 0);
}

export function resolvePersistedTotal(explicitTotal: unknown, items: QuoteLineLike[]) {
  const explicit = Number(explicitTotal);
  return Number.isFinite(explicit) && explicit > 0 ? Math.floor(explicit) : quoteTotal(items);
}

export function restaurantLineIdentity(item: Pick<SelectedItem, "property_id" | "meal_types" | "dates" | "order_date" | "order_dates" | "check_in" | "order_time" | "parent_item_name">) {
  const meals = normalizeMealTypes(item.meal_types).join("|");
  const dates = normalizeDates(item.order_dates || item.dates, item.order_date || item.check_in).join("|");
  return `${item.property_id}::${meals}::${dates}::${item.order_time || ""}::${item.parent_item_name || ""}`;
}

export function mergeRestaurantLine<T extends SelectedItem>(lines: T[], incoming: T) {
  const incomingIdentity = restaurantLineIdentity(incoming);
  const index = lines.findIndex((line) => restaurantLineIdentity(line) === incomingIdentity);
  if (index < 0) return [...lines, incoming];
  return lines.map((line, lineIndex) => lineIndex === index ? { ...line, quantity: lineQuantity(line.quantity) + lineQuantity(incoming.quantity) } : line);
}
