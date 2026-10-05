import { getAdminForMutation } from "@/lib/auth";
import { geocodeAddress, nominatimPoint } from "@/lib/geo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = await getAdminForMutation();
  if (!admin) return Response.json({ error: "Non autorisé." }, { status: 401 });
  if (admin.role !== "admin") return Response.json({ error: "Droits administrateur requis." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Requête invalide." }, { status: 400 }); }
  const record = body && typeof body === "object" ? body as { addressFr?: unknown; addressEn?: unknown } : {};
  const address = geocodeAddress(record.addressFr, record.addressEn);
  if (!address) return Response.json({ error: "Indiquez d’abord l’adresse de l’hôtel." }, { status: 400 });
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "PalacioHotela/1.0 (hotel address geocoder)" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
  } catch {
    return Response.json({ error: "La recherche d’adresse est momentanément indisponible. Les coordonnées actuelles sont conservées." }, { status: 503 });
  }
  if (!response.ok) return Response.json({ error: "La recherche d’adresse est momentanément indisponible. Les coordonnées actuelles sont conservées." }, { status: 503 });
  const point = nominatimPoint(await response.json().catch(() => null));
  if (!point) return Response.json({ error: "Adresse introuvable. Les coordonnées actuelles sont conservées." }, { status: 404 });
  return Response.json(point);
}
