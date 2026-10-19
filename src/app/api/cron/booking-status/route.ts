import { timingSafeEqual } from "node:crypto";
import { and, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { automaticBookingStatus, hotelLocalDate } from "@/lib/booking-status";
import { getSettings, logActivity, notifyUser } from "@/lib/hotel";
import { sendBookingStateEmails } from "@/lib/mail";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const supplied = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    console.error("[Palacio] CRON_SECRET is required to run automatic booking status updates.");
    return Response.json({ error: "Automatic booking status updates are not configured." }, { status: 503 });
  }
  if (!authorized(request)) return Response.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const today = hotelLocalDate();
    const candidates = await db.select().from(bookings)
      .where(and(inArray(bookings.status, ["confirmed", "checked_in"]), lte(bookings.checkIn, today)));
    const settings = candidates.length ? await getSettings() : null;
    const origin = new URL(request.url).origin;
    const notices: Record<string, string> = {
      checked_in: "Votre séjour a commencé",
      checked_out: "Votre séjour est terminé",
    };
    let updated = 0;
    let sideEffectFailures = 0;

    for (const booking of candidates) {
      const nextStatus = automaticBookingStatus(booking.status, booking.checkIn, booking.checkOut, today);
      if (!nextStatus) continue;
      const [record] = await db.update(bookings)
        .set({ status: nextStatus, updatedAt: new Date() })
        .where(and(
          eq(bookings.id, booking.id),
          eq(bookings.status, booking.status),
          eq(bookings.checkIn, booking.checkIn),
          eq(bookings.checkOut, booking.checkOut),
        ))
        .returning();
      if (!record) continue;

      updated += 1;
      const outcomes = await Promise.allSettled([
        sendBookingStateEmails(record, settings!, nextStatus, origin),
        notifyUser(record.userId, "booking", notices[nextStatus], record.reference || "", `/reservation/confirmation?token=${record.publicToken}`),
        logActivity("automatic status bookings", "bookings", record.id, "Palacio", null, `${booking.status} → ${nextStatus}`),
      ]);
      const failures = outcomes.filter((outcome) => outcome.status === "rejected");
      sideEffectFailures += failures.length;
      for (const failure of failures) {
        if (failure.status === "rejected") console.error(`[Palacio] Automatic booking status side effect failed for booking ${record.id}:`, failure.reason);
      }
    }

    return Response.json({ ok: true, date: today, updated, sideEffectFailures });
  } catch (error) {
    console.error("[Palacio] Automatic booking status update failed:", error);
    return Response.json({ error: "Automatic booking status update failed." }, { status: 500 });
  }
}
