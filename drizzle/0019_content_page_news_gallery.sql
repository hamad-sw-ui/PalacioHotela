ALTER TABLE "content_pages" ADD COLUMN IF NOT EXISTS "gallery_images" jsonb NOT NULL DEFAULT '[]'::jsonb;
