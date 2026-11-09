import assert from "node:assert/strict";
import test from "node:test";
import { CONTENT_BODY_MAX_LENGTH, CONTENT_SUMMARY_MAX_LENGTH, contentPageSchema, normalizeContentSlug } from "../src/lib/content-pages";

test("content slugs are normalized for casing, accents, punctuation and whitespace", () => {
  assert.equal(normalizeContentSlug("  L’Hôtel Palacio : Nouveautés !  "), "l-hotel-palacio-nouveautes");
  assert.equal(normalizeContentSlug("NEWS---2026"), "news-2026");
  assert.equal(normalizeContentSlug(""), "");
});

test("content editor limits support long-form pages and are explicit", () => {
  assert.equal(CONTENT_SUMMARY_MAX_LENGTH, 50_000);
  assert.equal(CONTENT_BODY_MAX_LENGTH, 500_000);
  const parsed = contentPageSchema.parse({
    slug: "  L’Hôtel Palacio : Actualités ",
    titleFr: "Actualité",
    titleEn: "News",
    summaryFr: "",
    summaryEn: "s".repeat(10_001),
    bodyFr: "b".repeat(100_001),
    bodyEn: "",
    image: "",
    galleryImages: [],
    published: true,
  });
  assert.equal(parsed.slug, "l-hotel-palacio-actualites");
  assert.equal(parsed.summaryEn.length, 10_001);
  assert.equal(parsed.bodyFr.length, 100_001);
  assert.equal(contentPageSchema.safeParse({ ...parsed, bodyFr: "b".repeat(CONTENT_BODY_MAX_LENGTH + 1) }).success, false);
});
