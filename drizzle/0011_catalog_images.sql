ALTER TABLE "catalog_items" ADD COLUMN IF NOT EXISTS "images" jsonb NOT NULL DEFAULT '[]'::jsonb;
