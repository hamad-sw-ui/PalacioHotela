import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export function decodeSignature(value: unknown) {
  if (typeof value !== "string") throw new Error("Signature manquante.");
  const match = value.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("La signature doit être une image PNG ou JPEG.");
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length < 100 || bytes.length > 2 * 1024 * 1024) throw new Error("La signature doit faire moins de 2 Mo.");
  const valid = match[1] === "png"
    ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!valid) throw new Error("Le fichier de signature n'est pas valide.");
  return { bytes, extension: match[1] === "png" ? "png" : "jpg" };
}

export async function saveSignatureImage(value: unknown) {
  const { bytes, extension } = decodeSignature(value);
  const filename = `${Date.now()}-${randomBytes(8).toString("hex")}.${extension}`;
  const directory = join(process.cwd(), "public", "uploads", "media");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, filename), bytes, { flag: "wx" });
  return { url: `/api/media/${filename}` };
}
