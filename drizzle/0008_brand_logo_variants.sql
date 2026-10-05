ALTER TABLE "site_settings"
  ADD COLUMN IF NOT EXISTS "secondary_logo_url" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "tertiary_logo_url" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "quote_logo_variant" varchar(16) NOT NULL DEFAULT 'primary';
