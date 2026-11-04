import assert from "node:assert/strict";
import { test } from "node:test";
import { automaticBookingStatus, hotelLocalDate } from "@/lib/booking-status";

test("hotel date follows the Africa/Douala calendar day", () => {
  assert.equal(hotelLocalDate(new Date("2026-10-10T22:30:00.000Z")), "2026-10-10");
  assert.equal(hotelLocalDate(new Date("2026-10-10T23:30:00.000Z")), "2026-10-11");
});

test("confirmed reservations advance only when their stay dates are reached", () => {
  assert.equal(automaticBookingStatus("confirmed", "2026-10-12", "2026-10-14", "2026-10-11"), null);
  assert.equal(automaticBookingStatus("confirmed", "2026-10-11", "2026-10-14", "2026-10-11"), "checked_in");
  assert.equal(automaticBookingStatus("confirmed", "2026-10-10", "2026-10-11", "2026-10-11"), "checked_out");
});

test("in-progress stays complete on checkout day, including after a delayed run", () => {
  assert.equal(automaticBookingStatus("checked_in", "2026-10-10", "2026-10-12", "2026-10-11"), null);
  assert.equal(automaticBookingStatus("checked_in", "2026-10-10", "2026-10-12", "2026-10-12"), "checked_out");
  assert.equal(automaticBookingStatus("checked_in", "2026-10-10", "2026-10-12", "2026-10-14"), "checked_out");
});

test("pending, cancelled, completed, and invalid-date reservations are not advanced", () => {
  for (const status of ["pending", "cancelled", "checked_out"]) {
    assert.equal(automaticBookingStatus(status, "2026-10-10", "2026-10-11", "2026-10-12"), null);
  }
  assert.equal(automaticBookingStatus("confirmed", "2026-02-30", "2026-03-02", "2026-03-01"), null);
  assert.equal(automaticBookingStatus("confirmed", "2026-10-12", "2026-10-11", "2026-10-12"), null);
});

test("the hotel date follows a configured time zone without touching the default", () => {
  const instant = new Date("2026-06-15T22:30:00.000Z");
  // Africa/Douala (UTC+1) is already the next day at 23:30.
  assert.equal(hotelLocalDate(instant, "Africa/Douala"), "2026-06-15");
  // Paris in summer (UTC+2) crosses midnight one hour earlier.
  assert.equal(hotelLocalDate(instant, "Europe/Paris"), "2026-06-16");
  assert.equal(hotelLocalDate(instant, "UTC"), "2026-06-15");
});
