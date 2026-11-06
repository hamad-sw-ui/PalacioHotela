import { z } from "zod";

const reservedPageSlugs = new Set(["notre-histoire", "confidentialite"]);

export const CONTENT_SUMMARY_MAX_LENGTH = 50_000;
export const CONTENT_BODY_MAX_LENGTH = 500_000;

const imageUrl = z.string().max(2000).refine((value) => !value || value.startsWith("/") || value.startsWith("https://"), "URL d'image invalide");

export const contentPageSchema = z.object({
  slug: z.preprocess((value) => typeof value === "string" ? normalizeContentSlug(value) : value, z.string().min(2).max(160).regex(/^[a-z0-9-]+$/)),
  pageType: z.enum(["page", "news"]).default("page"),
  titleFr: z.string().min(2).max(200),
  titleEn: z.string().min(2).max(200),
  summaryFr: z.string().max(CONTENT_SUMMARY_MAX_LENGTH).default(""),
  summaryEn: z.string().max(CONTENT_SUMMARY_MAX_LENGTH).default(""),
  bodyFr: z.string().max(CONTENT_BODY_MAX_LENGTH),
  bodyEn: z.string().max(CONTENT_BODY_MAX_LENGTH),
  image: imageUrl,
  galleryImages: z.array(imageUrl).max(8).default([]),
  published: z.boolean(),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
}).strict();

export function normalizeContentSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const reservedPageMessage = "Cette page est liée au menu, à l’accueil ou au consentement des formulaires. Son lien et sa publication restent en place.";

export function reservedPageChangeBlocked(slug: string, change: { remove?: boolean; slug?: string; published?: boolean } = {}) {
  if (!reservedPageSlugs.has(slug)) return false;
  const slugChanges = change.slug !== undefined && change.slug !== slug;
  return Boolean(change.remove || slugChanges || change.published === false);
}
