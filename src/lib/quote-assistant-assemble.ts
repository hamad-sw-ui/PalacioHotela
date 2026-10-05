import type { CatalogItem } from "@/db/schema";
import { daysBetween } from "@/lib/format";
import { normalizeDates, normalizeMealTypes } from "@/lib/quote-pricing";
import {
  assistantCategory,
  quoteAssistantLineSchema,
  quoteAssistantModelSchema,
  type QuoteAssistantLine,
  type QuoteAssistantResult,
} from "@/lib/quote-assistant-schema";

const monthNumbers: Record<string, number> = {
  janvier: 1, january: 1, février: 2, fevrier: 2, february: 2, mars: 3, march: 3, avril: 4, april: 4, mai: 5, may: 5, juin: 6, june: 6, juillet: 7, july: 7, août: 8, aout: 8, august: 8, septembre: 9, september: 9, octobre: 10, october: 10, novembre: 11, november: 11, décembre: 12, decembre: 12, december: 12,
};
const numberWords: Record<string, number> = { un: 1, une: 1, deux: 2, three: 3, trois: 3, quatre: 4, four: 4, cinq: 5, five: 5, six: 6, seven: 7, sept: 7, huit: 8, eight: 8, neuf: 9, nine: 9, dix: 10 };
const mealAliases: Record<string, "breakfast" | "lunch" | "dinner" | "snacks" | "other"> = {
  breakfast: "breakfast", "petit-dejeuner": "breakfast", "petit dejeuner": "breakfast", "petit-déjeuner": "breakfast", "petit déjeuner": "breakfast",
  lunch: "lunch", dejeuner: "lunch", déjeuner: "lunch", midi: "lunch",
  dinner: "dinner", diner: "dinner", dîner: "dinner", soir: "dinner", evening: "dinner",
  snacks: "snacks", collation: "snacks", snack: "snacks", "pause-cafe": "snacks", "pause cafe": "snacks", "pause-café": "snacks", "coffee break": "snacks",
  other: "other", autre: "other",
};

function numberValue(value: string | undefined, fallback = 1) {
  if (!value) return fallback;
  return Number(value) || numberWords[value.toLowerCase()] || fallback;
}

function isoFromParts(day: string, month: string, year?: string) {
  const monthNumber = monthNumbers[month.toLowerCase()];
  if (!monthNumber) return null;
  const today = new Date();
  let resolvedYear = Number(year) || today.getFullYear();
  const make = (y: number) => `${y}-${String(monthNumber).padStart(2, "0")}-${String(Number(day)).padStart(2, "0")}`;
  let date = make(resolvedYear);
  if (!year && date < today.toISOString().slice(0, 10)) date = make(resolvedYear + 1);
  const parsed = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === date ? date : null;
}

export function isoDateValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const slashed = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slashed) return `${slashed[3]}-${slashed[2].padStart(2, "0")}-${slashed[1].padStart(2, "0")}`;
  const named = trimmed.match(/(\d{1,2})\s+([a-zéûîôà]+)(?:\s+(\d{4}))?/i);
  if (named) return isoFromParts(named[1], named[2], named[3]) || undefined;
  return undefined;
}

export function mealCode(value: string) {
  const key = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  return mealAliases[value.toLowerCase().trim()] || mealAliases[key] || (["breakfast", "lunch", "dinner", "snacks", "other"].includes(value.toLowerCase().trim()) ? value.toLowerCase().trim() : undefined);
}

export function mealCodes(values?: unknown) {
  const list = Array.isArray(values) ? values : typeof values === "string" ? values.split(/[,;/]| et | and /i) : [];
  return normalizeMealTypes(list.map((value) => mealCode(String(value)) || "").filter(Boolean));
}

export function clockValue(value: unknown) {
  if (typeof value !== "string") return undefined;
  const match = value.trim().match(/^(\d{1,2})(?:h|:)?([0-5]\d)?$/i);
  if (!match) return undefined;
  return `${String(Math.min(23, Number(match[1]))).padStart(2, "0")}:${match[2] || "00"}`;
}

export function stayNights(checkIn?: string | null, checkOut?: string | null) {
  if (!checkIn || !checkOut || checkIn >= checkOut) return [];
  return Array.from({ length: daysBetween(checkIn, checkOut) }, (_, index) => {
    const date = new Date(`${checkIn}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

export function stayFromMessage(message: string) {
  const shared = message.match(/(?:du|from)\s+(\d{1,2})\s+(?:au|à|a|to|until|-)\s+(\d{1,2})\s+([a-zéûîôà]+)(?:\s+(\d{4}))?/i);
  if (shared) {
    const start = isoFromParts(shared[1], shared[3], shared[4]);
    const end = isoFromParts(shared[2], shared[3], shared[4]);
    if (start && end && start <= end) return { start, end };
  }
  const range = message.match(/(?:du|from)\s+(\d{1,2})\s+([a-zéûîôà]+)(?:\s+(\d{4}))?\s+(?:au|à|a|to|until|-)\s+(\d{1,2})\s+([a-zéûîôà]+)(?:\s+(\d{4}))?/i);
  if (range) {
    const start = isoFromParts(range[1], range[2], range[3]);
    const end = isoFromParts(range[4], range[5], range[6] || range[3]);
    if (start && end && start <= end) return { start, end };
  }
  return { start: undefined as string | undefined, end: undefined as string | undefined };
}

export function peopleFromText(message: string, fallback?: number | null) {
  const match = message.match(/(?:pour|for|avec|with)\s+(\d+)\s+(?:personnes?|participants?|invités?|guests?|people)|\b(\d+)\s+(?:personnes?|participants?|invités?|guests?|people)\b/i);
  return numberValue(match?.[1] || match?.[2], fallback || undefined) || fallback || undefined;
}

function quantityFromLabel(label: string, category: QuoteAssistantLine["category"]) {
  const pattern = category === "accommodation"
    ? /(\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s+(?:chambres?|suites?|rooms?|bedrooms?)/i
    : category === "conference_room" || category === "event_hall"
      ? /(\d+|un|une|deux|trois)\s+(?:salles?|rooms?|halls?)/i
      : /(\d+)\s+(?:personnes?|couverts?|places?|soins?)/i;
  const match = label.match(pattern);
  return match ? numberValue(match[1]) : undefined;
}

export function lineQuantityForTable(line: QuoteAssistantLine, people?: number | null) {
  const fromLabel = quantityFromLabel(line.requestedLabel, line.category);
  if (fromLabel) return fromLabel;
  if (line.category === "restaurant" && people && (line.quantity === 1 || line.quantity === people)) return people;
  if (["accommodation", "conference_room", "event_hall"].includes(line.category) && people && line.quantity === people && people > 3) return 1;
  return line.quantity;
}

function datesFromUnknown(value: unknown) {
  const list = Array.isArray(value) ? value : value == null ? [] : [value];
  return normalizeDates(list.map((entry) => isoDateValue(entry)).filter((entry): entry is string => Boolean(entry)));
}

export function coerceAssistantLine(value: unknown): QuoteAssistantLine | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const category = assistantCategory.safeParse(raw.category);
  if (!category.success) return null;
  const meals = mealCodes(raw.mealTypes ?? raw.meal_types);
  const dates = datesFromUnknown(raw.dates ?? raw.orderDates ?? raw.order_dates);
  const parsed = quoteAssistantLineSchema.safeParse({
    requestedLabel: String(raw.requestedLabel ?? raw.label ?? raw.name ?? "").trim() || category.data,
    category: category.data,
    catalogItemId: raw.catalogItemId ?? raw.catalog_item_id ?? raw.id,
    quantity: raw.quantity ?? 1,
    checkIn: isoDateValue(raw.checkIn ?? raw.check_in),
    checkOut: isoDateValue(raw.checkOut ?? raw.check_out),
    dates: dates.length ? dates : undefined,
    mealTypes: meals.length ? meals : undefined,
    orderTime: clockValue(raw.orderTime ?? raw.order_time),
    parentItemName: typeof raw.parentItemName === "string" ? raw.parentItemName : typeof raw.parent_item_name === "string" ? raw.parent_item_name : undefined,
    confidence: raw.confidence,
    ambiguity: typeof raw.ambiguity === "string" ? raw.ambiguity : undefined,
  });
  return parsed.success ? parsed.data : null;
}

export function coerceAssistantModel(value: unknown) {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const lines = (Array.isArray(raw.lines) ? raw.lines : []).map(coerceAssistantLine).filter((line): line is QuoteAssistantLine => Boolean(line));
  const textList = (entries: unknown) => (Array.isArray(entries) ? entries : []).map((entry) => String(entry || "").trim()).filter((entry) => entry.length >= 3 && entry.length <= 300).slice(0, 5);
  return quoteAssistantModelSchema.parse({
    lines,
    questions: textList(raw.questions),
    warnings: textList(raw.warnings),
    confidence: raw.confidence,
  });
}

export function assembleQuoteAssistantTable({
  message,
  locale,
  catalog,
  model,
  checkIn: formCheckIn,
  checkOut: formCheckOut,
  people: formPeople,
  source,
}: {
  message: string;
  locale: "fr" | "en";
  catalog: CatalogItem[];
  model: { lines: QuoteAssistantLine[]; questions?: string[]; warnings?: string[]; confidence?: number };
  checkIn?: string | null;
  checkOut?: string | null;
  people?: number | null;
  source: "local" | "ai";
}): QuoteAssistantResult {
  const people = peopleFromText(message) || formPeople || undefined;
  const extracted = stayFromMessage(message);
  const lineStarts = model.lines.map((line) => isoDateValue(line.checkIn)).filter((value): value is string => Boolean(value)).sort();
  const lineEnds = model.lines.map((line) => isoDateValue(line.checkOut)).filter((value): value is string => Boolean(value)).sort();
  const checkIn = extracted.start || lineStarts[0] || isoDateValue(formCheckIn);
  const checkOut = extracted.end || lineEnds[lineEnds.length - 1] || isoDateValue(formCheckOut);
  const nights = stayNights(checkIn, checkOut);
  const lines = model.lines.map((line) => {
    const quantity = lineQuantityForTable(line, people);
    const meals = mealCodes(line.mealTypes);
    const ownDates = datesFromUnknown(line.dates);
    const mentioned = [...message.matchAll(/\ble\s+(\d{1,2})\s+([a-zéûîôà]+)(?:\s+(\d{4}))?/gi)]
      .map((match) => isoFromParts(match[1], match[2], match[3]))
      .filter((value): value is string => value != null && (!checkIn || value >= checkIn) && (!checkOut || value < checkOut || value === checkIn));
    const meetingDay = ["conference_room", "event_hall"].includes(line.category) ? [...new Set(mentioned)].filter((value) => value !== checkIn && value !== checkOut) : [];
    const dates = ownDates.length === 1
      ? ownDates
      : meetingDay.length
        ? meetingDay
        : nights.length && line.category !== "accommodation"
          ? nights
          : ownDates.length
            ? ownDates
            : undefined;
    return {
      ...line,
      quantity,
      mealTypes: meals.length ? meals : line.category === "restaurant" ? undefined : line.mealTypes,
      dates: dates?.length ? dates : undefined,
      checkIn: line.checkIn || (line.category === "accommodation" ? checkIn : undefined),
      checkOut: line.checkOut || (line.category === "accommodation" ? checkOut : undefined),
    };
  });
  const unresolved = lines.filter((line) => !line.catalogItemId || !catalog.some((item) => item.id === line.catalogItemId));
  const questions = [...new Set([
    ...unresolved.map((line) => line.ambiguity || (locale === "en" ? `Could you clarify “${line.requestedLabel}”?` : `Pouvez-vous préciser « ${line.requestedLabel} » ?`)),
    ...(unresolved.length ? model.questions || [] : []),
  ])].slice(0, 5);
  const warnings = [...(model.warnings || [])];
  if (people && !formPeople) warnings.push(locale === "en" ? `We understood ${people} guests.` : `Nous avons compris ${people} personnes.`);
  return {
    lines,
    questions,
    warnings: [...new Set(warnings)].slice(0, 5),
    confidence: model.confidence ?? 0.5,
    source,
    canApply: lines.some((line) => line.catalogItemId && catalog.some((item) => item.id === line.catalogItemId)),
    checkIn: checkIn || null,
    checkOut: checkOut || null,
    people: people || null,
  };
}
