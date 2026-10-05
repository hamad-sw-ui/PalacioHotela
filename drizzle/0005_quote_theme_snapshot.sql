ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "theme_snapshot" varchar(24);
UPDATE "quote_requests"
SET "theme_snapshot" = COALESCE((SELECT "theme" FROM "site_settings" WHERE "id" = 1), 'forest')
WHERE "theme_snapshot" IS NULL
  AND "status" IN ('quote_sent', 'negotiating', 'accepted', 'rejected', 'expired');
