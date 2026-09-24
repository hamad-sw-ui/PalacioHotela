export type QuoteDraftLine = {
  id: string;
  property_id: number;
  type: "accommodation" | "room" | "service" | "restaurant";
  quantity: number;
  name_fr?: string;
  name_en?: string;
  price?: number;
  image?: string;
  description_fr?: string;
  description_en?: string;
  check_in?: string;
  check_out?: string;
  nights?: number;
  dates?: string[];
  meal_types?: string[];
  order_date?: string;
  order_dates?: string[];
  order_time?: string;
  parent_id?: number;
  parent_item_name?: string;
};

export type QuoteDraftRestaurantLine = QuoteDraftLine & {
  type: "restaurant";
  meal_types: string[];
  order_dates: string[];
  order_time: string;
};

export type QuoteDraft = {
  accommodationLines: QuoteDraftLine[];
  roomLines: QuoteDraftLine[];
  serviceLines: QuoteDraftLine[];
  restaurantLines: QuoteDraftRestaurantLine[];
  formSnapshot: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    budget?: string;
    message?: string;
    people?: number;
    checkIn?: string;
    checkOut?: string;
  };
};

export const EMPTY_QUOTE_DRAFT: QuoteDraft = {
  accommodationLines: [],
  roomLines: [],
  serviceLines: [],
  restaurantLines: [],
  formSnapshot: {},
};

const STORAGE_KEY = "quote_draft";
const CONTACT_KEY = "quote_last_contact";

export function normalizeRestaurantOrderDates(orderDates?: string[], fallback?: string) {
  return [...new Set([...(orderDates || []), ...(fallback ? [fallback] : [])].filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort();
}

export function getQuoteDraft(): QuoteDraft {
  if (typeof window === "undefined") return structuredClone(EMPTY_QUOTE_DRAFT);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(EMPTY_QUOTE_DRAFT);
    const value = JSON.parse(raw) as Partial<QuoteDraft>;
    return {
      accommodationLines: Array.isArray(value.accommodationLines) ? value.accommodationLines : [],
      roomLines: Array.isArray(value.roomLines) ? value.roomLines : [],
      serviceLines: Array.isArray(value.serviceLines) ? value.serviceLines : [],
      restaurantLines: Array.isArray(value.restaurantLines) ? value.restaurantLines : [],
      formSnapshot: value.formSnapshot && typeof value.formSnapshot === "object" ? value.formSnapshot : {},
    };
  } catch {
    return structuredClone(EMPTY_QUOTE_DRAFT);
  }
}

export function setQuoteDraft(draft: QuoteDraft) {
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function clearQuoteDraft() {
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
}

export function saveQuoteContact(contact: QuoteDraft["formSnapshot"]) {
  if (typeof window !== "undefined") window.localStorage.setItem(CONTACT_KEY, JSON.stringify(contact));
}

export function getQuoteContact(): QuoteDraft["formSnapshot"] {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(window.localStorage.getItem(CONTACT_KEY) || "{}"); } catch { return {}; }
}

export function restaurantDraftKey(line: Pick<QuoteDraftRestaurantLine, "property_id" | "meal_types" | "order_dates" | "order_time" | "parent_item_name">) {
  return `${line.property_id}::${[...(line.meal_types || [])].map((meal) => meal.toLowerCase()).sort().join("|")}::${normalizeRestaurantOrderDates(line.order_dates).join("|")}::${line.order_time || ""}::${line.parent_item_name || ""}`;
}

export function updateQuoteDraftRestaurantLines(lines: QuoteDraftRestaurantLine[]) {
  const draft = getQuoteDraft();
  setQuoteDraft({ ...draft, restaurantLines: lines });
}
