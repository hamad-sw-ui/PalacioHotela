import assert from "node:assert/strict";
import test from "node:test";
import { availabilityHref, catalogItemHref, fitsGuestDemand, parseAvailabilityQuery, reservationHref, unitsNeeded } from "../src/lib/availability-search";

function iso(offsetDays: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

test("guest count consumes as many free units as the capacity requires", () => {
  assert.equal(unitsNeeded(2, 2), 1);
  assert.equal(unitsNeeded(2, 3), 2);
  assert.equal(unitsNeeded(60, 10), 1);
  assert.equal(fitsGuestDemand(2, 1, 2), true);
  assert.equal(fitsGuestDemand(2, 1, 3), false);
  assert.equal(fitsGuestDemand(2, 0, 2), false);
  assert.equal(fitsGuestDemand(2, 5, 10), true);
  assert.equal(fitsGuestDemand(2, 80, 100), false);
  assert.equal(fitsGuestDemand(0, 4, 2), false);
});

test("availability search keeps dates and guests on a public results page", () => {
  const stay = { checkIn: iso(10), checkOut: iso(12), guests: 4 };
  assert.equal(availabilityHref(stay), `/disponibilites?checkIn=${stay.checkIn}&checkOut=${stay.checkOut}&guests=4`);
  assert.equal(catalogItemHref("suite-junior", stay), `/hebergements/suite-junior?checkIn=${stay.checkIn}&checkOut=${stay.checkOut}&guests=4`);
  assert.equal(catalogItemHref("suite-junior"), "/hebergements/suite-junior");
  assert.equal(reservationHref(7, stay), `/reservation?itemId=7&checkIn=${stay.checkIn}&checkOut=${stay.checkOut}&guests=4`);
  assert.deepEqual(parseAvailabilityQuery({ checkIn: stay.checkIn, checkOut: stay.checkOut, guests: "4" }), stay);
  assert.equal(parseAvailabilityQuery({ checkIn: stay.checkIn, guests: "2" }), null);
  assert.equal(parseAvailabilityQuery({ checkIn: stay.checkIn, checkOut: stay.checkIn, guests: "2" }), null);
  assert.equal(parseAvailabilityQuery({ ...stay, guests: "0" }), null);
});
