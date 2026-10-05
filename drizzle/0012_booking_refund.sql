ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "refund_ref" text;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "refund_error" text;
