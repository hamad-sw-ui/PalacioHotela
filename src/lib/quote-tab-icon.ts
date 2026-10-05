import { quoteTabIconUrl } from "@/lib/brand-logos";
import { readBrandImage } from "@/lib/brand-image";
import { getSettings } from "@/lib/hotel";

export async function quoteTabIconResponse() {
  const settings = await getSettings();
  const image = await readBrandImage(quoteTabIconUrl(settings));
  if (!image) return new Response(null, { status: 204 });
  return new Response(image.bytes, {
    headers: {
      "Content-Type": image.type,
      "Cache-Control": "public, max-age=300, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
