import type { SelectedItem } from "@/db/schema";
import { normalizeDates, normalizeMealTypes } from "@/lib/quote-pricing";

const mealLabels: Record<string, [string, string]> = {
  breakfast: ["Petit-déjeuner", "Breakfast"],
  lunch: ["Déjeuner", "Lunch"],
  dinner: ["Dîner", "Dinner"],
  snacks: ["Collation", "Snacks"],
  other: ["Autre", "Other"],
};

export function formatQuoteLineDates(item: Pick<SelectedItem, "type" | "dates" | "order_date" | "order_dates" | "check_in" | "check_out" | "order_time">, locale: "fr" | "en" = "fr") {
  const dates = normalizeDates(item.order_dates || item.dates, item.order_date || item.check_in);
  const dateText = dates.length ? dates.join(" · ") : item.check_in && item.check_out ? `${item.check_in} → ${item.check_out}` : "";
  const timeText = item.order_time ? `${locale === "en" ? "Time" : "Heure"} : ${item.order_time}` : "";
  return [dateText, timeText].filter(Boolean).join(" · ");
}

export function formatQuoteLineMeals(mealTypes: string[] | undefined, locale: "fr" | "en" = "fr") {
  return normalizeMealTypes(mealTypes).map((meal) => mealLabels[meal]?.[locale === "en" ? 1 : 0] || meal).join(" · ");
}

export function formatQuoteLineMeta(item: SelectedItem, locale: "fr" | "en" = "fr") {
  const details = [
    formatQuoteLineDates(item, locale),
    item.type === "restaurant" ? formatQuoteLineMeals(item.meal_types, locale) : "",
    item.parent_item_name ? `${locale === "en" ? "For" : "Pour"} ${item.parent_item_name}` : "",
  ].filter(Boolean);
  return details.join("\n");
}
