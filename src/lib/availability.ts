export type Stay = { start: string; end: string; quantity: number };

const stockQuoteStatuses = new Set(["new", "in_review", "quote_sent", "negotiating", "accepted"]);

/** A request keeps its units until it is cancelled, refused or expired. */
export function quoteOccupiesStock(status: string) {
  return stockQuoteStatuses.has(status);
}

export function nextDay(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** Highest number of units occupied at once. Checkout day is free. */
export function peakFromStays(requestStart: string, requestEnd: string, stays: Stay[]) {
  const events: { day: string; delta: number }[] = [];
  for (const stay of stays) {
    const start = stay.start > requestStart ? stay.start : requestStart;
    const end = stay.end < requestEnd ? stay.end : requestEnd;
    if (!start || !end || start >= end || stay.quantity <= 0) continue;
    events.push({ day: start, delta: stay.quantity }, { day: end, delta: -stay.quantity });
  }
  events.sort((a, b) => a.day === b.day ? a.delta - b.delta : a.day < b.day ? -1 : 1);
  let current = 0;
  let peak = 0;
  for (const event of events) {
    current += event.delta;
    if (current > peak) peak = current;
  }
  return peak;
}

/** Units still free on the busiest day of the requested stay. Checkout day is free. */
export function remainingFromStays(inventory: number, requestStart: string, requestEnd: string, stays: Stay[]) {
  return Math.max(0, inventory - peakFromStays(requestStart, requestEnd, stays));
}

/** Busiest overlap across every stay. Checkout day is free. */
export function occupiedPeak(stays: Stay[]) {
  if (!stays.length) return 0;
  const start = stays.reduce((min, stay) => stay.start < min ? stay.start : min, stays[0].start);
  const end = stays.reduce((max, stay) => stay.end > max ? stay.end : max, stays[0].end);
  return peakFromStays(start, end, stays);
}

/** True when adding every incoming stay still fits the stock, including lines of the same item. */
export function demandFits(inventory: number, incoming: Stay[], existing: Stay[] = []) {
  if (!incoming.length) return true;
  const start = incoming.reduce((min, stay) => stay.start < min ? stay.start : min, incoming[0].start);
  const end = incoming.reduce((max, stay) => stay.end > max ? stay.end : max, incoming[0].end);
  return peakFromStays(start, end, [...existing, ...incoming]) <= inventory;
}

export function demandRanges(line: { order_dates?: string[]; order_date?: string; check_in?: string; check_out?: string }, fallback?: { start?: string | null; end?: string | null }) {
  const dates = line.order_dates?.length ? line.order_dates : line.order_date ? [line.order_date] : [];
  if (dates.length) return dates.map((day) => ({ start: day, end: nextDay(day) }));
  const start = line.check_in || fallback?.start || "";
  const end = line.check_out || fallback?.end || "";
  if (start && end && start < end) return [{ start, end }];
  return [];
}
