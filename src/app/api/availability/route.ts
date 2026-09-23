import { getPublicCatalog, bookingTotal, remainingAvailability, validDateRange } from "@/lib/hotel";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const start = url.searchParams.get("checkIn") || "";
  const end = url.searchParams.get("checkOut") || "";
  if (!validDateRange(start, end)) return Response.json({ error: "Dates invalides / Invalid dates" }, { status: 400 });
  const requestedId = Number(url.searchParams.get("itemId") || 0);
  const items = (await getPublicCatalog()).filter((item) => !requestedId || item.id === requestedId);
  const availability = await Promise.all(items.map(async (item) => ({ itemId: item.id, remaining: await remainingAvailability(item, start, end), price: item.price, totalForOne: bookingTotal(item, start, end, 1) })));
  return Response.json({ availability });
}
