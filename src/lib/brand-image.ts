import { readFile } from "node:fs/promises";
import { join } from "node:path";

function typeFromName(name: string) {
  if (/\.png(?:\?|$)/i.test(name)) return "image/png";
  if (/\.webp(?:\?|$)/i.test(name)) return "image/webp";
  if (/\.jpe?g(?:\?|$)/i.test(name)) return "image/jpeg";
  if (/\.ico(?:\?|$)/i.test(name)) return "image/x-icon";
  return "image/png";
}

export function brandImagePath(url: string) {
  const value = String(url || "").trim().split("#")[0];
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const media = value.match(/^\/api\/media\/(\d+-[a-f0-9]{16}\.(?:jpg|png|webp))(?:\?|$)/i);
  if (media) return `/api/media/${media[1]}`;
  const local = value.split("?")[0];
  if (local.startsWith("/images/") && !local.includes("..")) return local;
  return "";
}

export async function readBrandImage(url: string) {
  const path = brandImagePath(url);
  if (!path) return null;
  try {
    if (/^https?:\/\//i.test(path)) {
      const response = await fetch(path);
      if (!response.ok) return null;
      return { bytes: Buffer.from(await response.arrayBuffer()), type: response.headers.get("content-type") || typeFromName(path) };
    }
    const media = path.match(/^\/api\/media\/(\d+-[a-f0-9]{16}\.(?:jpg|png|webp))$/i);
    const file = media
      ? join(process.cwd(), "public", "uploads", "media", media[1])
      : join(process.cwd(), "public", path);
    return { bytes: await readFile(file), type: typeFromName(path) };
  } catch {
    return null;
  }
}
