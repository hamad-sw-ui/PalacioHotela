ALTER TABLE "site_settings" ADD COLUMN "google_client_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "google_client_secret" text DEFAULT '' NOT NULL;