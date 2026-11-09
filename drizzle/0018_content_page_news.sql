ALTER TABLE "content_pages" ADD COLUMN IF NOT EXISTS "page_type" varchar(20) NOT NULL DEFAULT 'page';--> statement-breakpoint
ALTER TABLE "content_pages" ADD COLUMN IF NOT EXISTS "summary_fr" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "content_pages" ADD COLUMN IF NOT EXISTS "summary_en" text NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE "content_pages" ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone;
