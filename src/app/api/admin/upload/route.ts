import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getAdminForMutation } from "@/lib/auth";
import { logActivity } from "@/lib/hotel";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const admin = await getAdminForMutation();
  if (!admin) return Response.json({ error: "Non autorisé." }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Image manquante." }, { status: 400 });
  if (file.size > 5 * 1024 * 1024 || file.size < 100) return Response.json({ error: "L'image doit faire moins de 5 Mo." }, { status: 400 });
  const types: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const extension = types[file.type];
  if (!extension) return Response.json({ error: "Formats acceptés : JPEG, PNG, WebP." }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer());
  const valid = extension === "jpg" ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff : extension === "png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
  if (!valid) return Response.json({ error: "Le fichier n'est pas une image valide." }, { status: 400 });
  const filename = `${Date.now()}-${randomBytes(8).toString("hex")}.${extension}`;
  const directory = join(process.cwd(), "public", "uploads", "media");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, filename), bytes, { flag: "wx" });
  await logActivity("Image importée", "media", null, admin.fullName, admin.id, filename);
  return Response.json({ url: `/api/media/${filename}` });
}
