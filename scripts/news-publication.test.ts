import assert from "node:assert/strict";
import test from "node:test";
import { isPublicNews, newsDisplayDate, publicNewsOrder } from "../src/lib/news-publication";

const now = new Date("2026-11-06T12:00:00.000Z");

test("future-dated published news is scheduled while null dates stay public", () => {
  const scheduled = { published: true, publishedAt: new Date("2026-11-07T00:00:00.000Z"), createdAt: now };
  const laterToday = { published: true, publishedAt: new Date("2026-11-06T22:00:00.000Z"), createdAt: now };
  const legacy = { published: true, publishedAt: null, createdAt: new Date("2026-11-05T00:00:00.000Z") };
  const draft = { published: false, publishedAt: null, createdAt: now };

  assert.equal(isPublicNews(scheduled, now), false);
  assert.equal(isPublicNews(laterToday, now), true);
  assert.equal(isPublicNews(legacy, now), true);
  assert.equal(isPublicNews(draft, now), false);
  assert.equal(newsDisplayDate(legacy), legacy.createdAt);
});

test("public news sorts by publication date with createdAt as the legacy fallback", () => {
  const old = { id: 1, published: true, publishedAt: null, createdAt: new Date("2026-10-01T00:00:00.000Z") };
  const recent = { id: 2, published: true, publishedAt: new Date("2026-11-05T00:00:00.000Z"), createdAt: now };
  const scheduled = { id: 3, published: true, publishedAt: new Date("2026-11-08T00:00:00.000Z"), createdAt: now };

  assert.deepEqual(publicNewsOrder([old, scheduled, recent], now).map((item) => item.id), [2, 1]);
});

test("cached ISO date strings are normalized and retain publication behavior", () => {
  const cachedNews = {
    published: true,
    publishedAt: "2026-11-06T10:00:00.000Z",
    createdAt: "2026-11-05T10:00:00.000Z",
  };

  assert.equal(isPublicNews(cachedNews, now), true);
  assert.equal(newsDisplayDate(cachedNews).toISOString(), "2026-11-06T10:00:00.000Z");
  assert.equal(isPublicNews({ ...cachedNews, publishedAt: "2026-11-07T00:00:00.000Z" }, now), false);
  assert.throws(
    () => newsDisplayDate({ ...cachedNews, publishedAt: "not-a-date" }),
    /Invalid publishedAt date/,
  );
});
