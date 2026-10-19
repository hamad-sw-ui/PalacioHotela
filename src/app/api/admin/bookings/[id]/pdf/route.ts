import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { getAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/hotel";
import { buildBookingPdf } from "@/lib/pdf-booking";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await getAdmin()) return Response.json({ error: "Non autorisé." }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "Identifiant invalide." }, { status: 400 });

  const [booking] = await db.select().from(bookings).where(eq(bookings.id, id)).limit(1);
  if (!booking) return Response.json({ error: "Réservation introuvable." }, { status: 404 });

  const kind = new URL(request.url).searchParams.get("kind") === "confirmation" ? "confirmation" : "receipt";
  const pdf = await buildBookingPdf(booking, await getSettings(), kind);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${booking.reference || "reservation"}-${kind}-preview.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
