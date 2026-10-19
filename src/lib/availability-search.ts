import { validDateRange } from "@/lib/format";

export type AvailabilityStay = { checkIn: string; checkOut: string; guests: number };

/** Same ceiling as the booking form, so a listed space can actually be requested. */
export const BOOKING_UNIT_LIMIT = 25;

/** Units required so capacity × quantity covers the guest count. */
export function unitsNeeded(capacity: number, guests: number) {
  if (!Number.isInteger(capacity) || capacity < 1 || !Number.isInteger(guests) || guests < 1) return null;
  return Math.ceil(guests / capacity);
}

/** True when free stock can host every guest, using as many units as needed. */
export function fitsGuestDemand(capacity: number, remaining: number, guests: number) {
  const needed = unitsNeeded(capacity, guests);
  return needed !== null && Number.isInteger(remaining) && needed <= BOOKING_UNIT_LIMIT && remaining >= needed;
}

export function availabilityHref(stay: AvailabilityStay) {
  return `/disponibilites?${new URLSearchParams({ checkIn: stay.checkIn, checkOut: stay.checkOut, guests: String(stay.guests) })}`;
}

export function catalogItemHref(slug: string, stay?: AvailabilityStay) {
  const href = `/hebergements/${slug}`;
  return stay ? `${href}?${new URLSearchParams({ checkIn: stay.checkIn, checkOut: stay.checkOut, guests: String(stay.guests) })}` : href;
}

export function reservationHref(itemId: number, stay: AvailabilityStay) {
  return `/reservation?${new URLSearchParams({ itemId: String(itemId), checkIn: stay.checkIn, checkOut: stay.checkOut, guests: String(stay.guests) })}`;
}

export function parseAvailabilityQuery(query: { checkIn?: string; checkOut?: string; guests?: string }): AvailabilityStay | null {
  const checkIn = query.checkIn || "";
  const checkOut = query.checkOut || "";
  const guests = Number(query.guests);
  if (!validDateRange(checkIn, checkOut) || !Number.isInteger(guests) || guests < 1 || guests > 500) return null;
  return { checkIn, checkOut, guests };
}
