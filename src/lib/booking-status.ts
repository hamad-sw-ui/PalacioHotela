export const HOTEL_TIME_ZONE = "Africa/Douala";

export type BookingStatus = "pending" | "confirmed" | "checked_in" | "checked_out" | "cancelled";

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function hotelLocalDate(now: Date = new Date(), timeZone = HOTEL_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value;
  const year = part("year");
  const month = part("month");
  const day = part("day");
  if (!year || !month || !day) throw new Error(`Unable to determine the local date for ${timeZone}.`);
  return `${year}-${month}-${day}`;
}

export function automaticBookingStatus(status: string, checkIn: string, checkOut: string, today: string): BookingStatus | null {
  if (!isIsoDate(checkIn) || !isIsoDate(checkOut) || !isIsoDate(today) || checkIn >= checkOut) return null;
  if (status === "confirmed") {
    if (checkOut <= today) return "checked_out";
    if (checkIn <= today) return "checked_in";
  }
  if (status === "checked_in" && checkOut <= today) return "checked_out";
  return null;
}
