import { strict as assert } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { siteImage } from "../src/lib/site-image";

test("site imagery falls back to the built-in artwork until the admin uploads a replacement", () => {
  assert.equal(siteImage("", "/images/palacio-hero.jpg"), "/images/palacio-hero.jpg");
  assert.equal(siteImage(null, "/images/palacio-hero.jpg"), "/images/palacio-hero.jpg");
  assert.equal(siteImage(undefined, "/images/palacio-suite.jpg"), "/images/palacio-suite.jpg");
  assert.equal(siteImage("   ", "/images/palacio-suite.jpg"), "/images/palacio-suite.jpg");
  assert.equal(siteImage("/api/media/1712345678901-abcdef0123456789.jpg", "/images/palacio-hero.jpg"), "/api/media/1712345678901-abcdef0123456789.jpg");
  assert.equal(siteImage("https://cdn.example.com/hero.jpg", "/images/palacio-hero.jpg"), "https://cdn.example.com/hero.jpg");
});

test("the schema carries the four site image columns with empty defaults", () => {
  const schema = readFileSync(new URL("../src/db/schema.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  for (const [camel, snake] of [["pageHeroImage", "page_hero_image"], ["galleryImage2", "gallery_image_2"], ["galleryImage3", "gallery_image_3"], ["fallbackImage", "fallback_image"]] as const) {
    assert.ok(schema.includes(`${camel}: text("${snake}").notNull().default(""),`), `${camel} column with empty default`);
  }
  const migration = readFileSync(new URL("../src/lib/seed.ts", import.meta.url), "utf8");
  for (const column of ["page_hero_image", "gallery_image_2", "gallery_image_3", "fallback_image"]) {
    assert.ok(migration.includes(`ADD COLUMN ${column} text NOT NULL DEFAULT ''`), `idempotent migration for ${column}`);
  }
});

test("every component using siteImage imports it", () => {
  const files = readdirSync(new URL("../src/components/", import.meta.url), { recursive: true }) as string[];
  for (const name of files.filter((file) => file.endsWith(".tsx"))) {
    const source = readFileSync(new URL(`../src/components/${name}`, import.meta.url), "utf8");
    const uses = /siteImage\(/.test(source);
    const imports = /import \{ siteImage \} from "@\/lib\/site-image";/.test(source);
    assert.equal(uses, imports, `${name} must import siteImage exactly when it uses it`);
  }
});
