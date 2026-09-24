ALTER TABLE "quote_requests" ADD COLUMN "estimated_total" integer;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "pdf_template_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "admin_signature_url" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "admin_signer_name" varchar(180);--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "admin_signer_role" varchar(180);--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "admin_signed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "admin_stamp_url" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "client_signature_url" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "client_signer_name" varchar(180);--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "client_signed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "client_acceptance_ip" varchar(120);--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "client_acceptance_user_agent" text;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "terms_snapshot_fr" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD COLUMN "terms_snapshot_en" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "quote_signature_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "quote_stamp_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "quote_signer_name" varchar(180) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "quote_signer_role" varchar(180) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "quote_terms_fr" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "quote_terms_en" text DEFAULT '' NOT NULL;--> statement-breakpoint
