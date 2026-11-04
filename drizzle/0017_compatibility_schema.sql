-- Migration de compatibilité : colonnes et contraintes manquantes
-- Générée à partir de src/db/schema.ts, non couvertes par les migrations 0000-0015
-- Toutes les opérations sont idempotentes (IF NOT EXISTS ou vérification conditionnelle)
-- Ne pas exécuter sur la production sans sauvegarde préalable et test sur base isolée.

-- 1. site_settings.quote_header_image_url
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "quote_header_image_url" text NOT NULL DEFAULT '';

-- 2. site_settings.smtp_host
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "smtp_host" text NOT NULL DEFAULT '';

-- 3. site_settings.smtp_port
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "smtp_port" integer NOT NULL DEFAULT 587;

-- 4. site_settings.smtp_secure
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "smtp_secure" boolean NOT NULL DEFAULT false;

-- 5. site_settings.smtp_require_tls
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "smtp_require_tls" boolean NOT NULL DEFAULT true;

-- 6. site_settings.smtp_user
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "smtp_user" text NOT NULL DEFAULT '';

-- 7. site_settings.smtp_password
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "smtp_password" text NOT NULL DEFAULT '';

-- 8. site_settings.smtp_from
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "smtp_from" text NOT NULL DEFAULT '';

-- 9. site_settings.ai_api_key
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "ai_api_key" text NOT NULL DEFAULT '';

-- 10. site_settings.stripe_secret_key
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "stripe_secret_key" text NOT NULL DEFAULT '';

-- 11. site_settings.stripe_webhook_secret
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "stripe_webhook_secret" text NOT NULL DEFAULT '';

-- 12. site_settings.paypal_client_id
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "paypal_client_id" text NOT NULL DEFAULT '';

-- 13. site_settings.paypal_client_secret
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "paypal_client_secret" text NOT NULL DEFAULT '';

-- 14. site_settings.paypal_env
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "paypal_env" varchar(16) NOT NULL DEFAULT 'sandbox';

-- 15. site_settings.paypal_xaf_per_eur
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "paypal_xaf_per_eur" double precision NOT NULL DEFAULT 655.957;

-- 16. quote_requests.header_image_url
ALTER TABLE "quote_requests" ADD COLUMN IF NOT EXISTS "header_image_url" text;

-- 17. catalog_items.features
ALTER TABLE "catalog_items" ADD COLUMN IF NOT EXISTS "features" jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 18. quote_requests.people : suppression NOT NULL et DEFAULT (si encore présents)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'quote_requests'
      AND column_name = 'people'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "quote_requests" ALTER COLUMN "people" DROP NOT NULL;
    ALTER TABLE "quote_requests" ALTER COLUMN "people" DROP DEFAULT;
  END IF;
END $$;
