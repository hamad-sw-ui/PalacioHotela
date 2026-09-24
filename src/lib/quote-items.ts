import type { CatalogItem, SelectedItem } from "@/db/schema";
import { mergeRestaurantLine, normalizeDates, normalizeMealTypes } from "@/lib/quote-pricing";

export type QuoteItemInput = {
  property_id: number;
  quantity: number;
  check_in?: string;
  check_out?: string;
  dates?: string[];
  order_date?: string;
  order_dates?: string[];
  order_time?: string;
  meal_types?: string[];
  parent_id?: number;
  parent_item_name?: string;
};

type EnrichmentOptions = {
  checkIn?: string | null;
  checkOut?: string | null;
  source: "web" | "admin";
};

/**
 * Creates the immutable catalog snapshot stored with a quote. All entry points
 * use this function so pricing, restaurant identity and PDF data stay aligned.
 */
export function enrichQuoteItems(
  lines: QuoteItemInput[],
  catalog: CatalogItem[],
  options: EnrichmentOptions,
) {
  let result: SelectedItem[] = [];

  for (const line of lines) {
    const item = catalog.find((entry) => entry.id === line.property_id);
    if (!item) throw new Error("Une prestation sélectionnée est introuvable.");

    const start = line.check_in || options.checkIn || undefined;
    const end = line.check_out || options.checkOut || undefined;
    const orderDates = normalizeDates(
      line.order_dates || line.dates,
      line.order_date || (item.category === "restaurant" ? start : undefined),
    );
    const meals = normalizeMealTypes(line.meal_types);
    const enriched: SelectedItem = {
      property_id: item.id,
      type: item.category as SelectedItem["type"],
      name_fr: item.nameFr,
      name_en: item.nameEn,
      description_fr: item.descriptionFr,
      description_en: item.descriptionEn,
      image: item.image,
      price: item.price,
      quantity: line.quantity,
      ...(item.category === "accommodation" && start && end
        ? { nights: Math.max(1, Math.round((Date.parse(end) - Date.parse(start)) / 86400000)) }
        : {}),
      ...(start ? { check_in: start } : {}),
      ...(end ? { check_out: end } : {}),
      ...(line.dates ? { dates: normalizeDates(line.dates) } : {}),
      ...(orderDates.length ? { order_dates: orderDates } : {}),
      ...(line.order_date ? { order_date: line.order_date } : {}),
      ...(line.order_time ? { order_time: line.order_time } : {}),
      ...(meals.length ? { meal_types: meals } : {}),
      ...(line.parent_id ? { parent_id: line.parent_id } : {}),
      ...(line.parent_item_name ? { parent_item_name: line.parent_item_name } : {}),
      source: options.source,
    };

    result = enriched.type === "restaurant"
      ? mergeRestaurantLine(result, enriched)
      : [...result, enriched];
  }

  return result;
}
