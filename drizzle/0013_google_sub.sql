ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_sub" varchar(255);
CREATE UNIQUE INDEX IF NOT EXISTS "users_google_sub_unique" ON "users" ("google_sub");
