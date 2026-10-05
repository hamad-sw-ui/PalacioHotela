ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "theme_colors" jsonb;
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "theme_palette_snapshot" jsonb;
