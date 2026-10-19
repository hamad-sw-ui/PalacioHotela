import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { getSettings } from "@/lib/hotel";
import { buildBookingPdf } from "@/lib/pdf-booking";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [booking] = await db.select().from(bookings).where(eq(bookings.publicToken, token)).limit(1);
  if (!booking) return Response.json({ error: "Réservation introuvable." }, { status: 404 });
  const kind = new URL(request.url).searchParams.get("kind") === "confirmation" ? "confirmation" : "receipt";
  // The definitive confirmation PDF is only served once the hotel confirmed the stay; otherwise the receipt.
  if (kind === "confirmation" && !["confirmed", "checked_in", "checked_out"].includes(booking.status)) return Response.json({ error: "La confirmation n'est pas encore disponible." }, { status: 403 });
  const pdf = await buildBookingPdf(booking, await getSettings(), kind);
  return new Response(Buffer.from(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${booking.reference || "reservation"}-${kind}.pdf"`, "Cache-Control": "private, no-store" } });
}
