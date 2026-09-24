export type Stay = { start: string; end: string; quantity: number };

export function nextDay(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** Units still free on the busiest day of the requested stay. Checkout day is free. */
export function remainingFromStays(inventory: number, requestStart: string, requestEnd: string, stays: Stay[]) {
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
  return Math.max(0, inventory - peak);
}

export function demandRanges(line: { order_dates?: string[]; order_date?: string; check_in?: string; check_out?: string }, fallback?: { start?: string | null; end?: string | null }) {
  const dates = line.order_dates?.length ? line.order_dates : line.order_date ? [line.order_date] : [];
  if (dates.length) return dates.map((day) => ({ start: day, end: nextDay(day) }));
  const start = line.check_in || fallback?.start || "";
  const end = line.check_out || fallback?.end || "";
  if (start && end && start < end) return [{ start, end }];
  return [];
}
