ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "reply" text;
ALTER TABLE "contact_messages" ADD COLUMN IF NOT EXISTS "replied_at" timestamp with time zone;
