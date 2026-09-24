import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { quoteRequests } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function decodeSignature(value: unknown) {
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

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    const [quote] = await db.select().from(quoteRequests).where(eq(quoteRequests.publicToken, token)).limit(1);
    if (!quote) return Response.json({ error: "Devis introuvable." }, { status: 404 });
    if (!["quote_sent", "negotiating"].includes(quote.status) || (quote.validUntil && quote.validUntil < new Date().toISOString().slice(0, 10))) return Response.json({ error: "Ce devis ne peut plus être signé." }, { status: 409 });
    const body = await request.json().catch(() => ({})) as { signature?: unknown; signerName?: unknown };
    const signerName = typeof body.signerName === "string" ? body.signerName.trim().slice(0, 180) : "";
    if (signerName.length < 2) return Response.json({ error: "Le nom du signataire est requis." }, { status: 400 });
    const { bytes, extension } = decodeSignature(body.signature);
    const filename = `${Date.now()}-${randomBytes(8).toString("hex")}.${extension}`;
    const directory = join(process.cwd(), "public", "uploads", "media");
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, filename), bytes, { flag: "wx" });
    const [updated] = await db.update(quoteRequests).set({ clientSignatureUrl: `/api/media/${filename}`, clientSignerName: signerName, updatedAt: new Date() }).where(eq(quoteRequests.id, quote.id)).returning({ id: quoteRequests.id, clientSignatureUrl: quoteRequests.clientSignatureUrl, clientSignerName: quoteRequests.clientSignerName });
    return Response.json({ ok: true, signatureUrl: updated.clientSignatureUrl, signerName: updated.clientSignerName });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Signature invalide." }, { status: 400 });
  }
}
