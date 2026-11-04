ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "page_hero_image" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "gallery_image_2" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "gallery_image_3" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "fallback_image" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "facebook_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "time_zone" varchar(64) DEFAULT 'Africa/Douala' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "city_fr" varchar(120) DEFAULT 'Douala' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "city_en" varchar(120) DEFAULT 'Douala' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "country_fr" varchar(120) DEFAULT 'Cameroun' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "country_en" varchar(120) DEFAULT 'Cameroon' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "tagline_fr" varchar(300) DEFAULT 'Votre parenthèse d''exception à Douala' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "tagline_en" varchar(300) DEFAULT 'Your exceptional escape in Douala' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "footer_baseline_fr" text DEFAULT 'Une adresse singulière, des instants inoubliables. Bienvenue chez vous, à Douala.' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "footer_baseline_en" text DEFAULT 'An extraordinary address, unforgettable moments. Welcome home in Douala.' NOT NULL;