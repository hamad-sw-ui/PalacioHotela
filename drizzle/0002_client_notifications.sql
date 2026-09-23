ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "user_id" integer REFERENCES "users"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "notifications_user_idx" ON "notifications" ("user_id", "read", "created_at");
