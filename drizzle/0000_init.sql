CREATE TABLE "activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"actor_name" varchar(180) DEFAULT 'Système' NOT NULL,
	"action" varchar(120) NOT NULL,
	"entity" varchar(60) NOT NULL,
	"entity_id" integer,
	"details" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference" varchar(30),
	"public_token" varchar(80) NOT NULL,
	"user_id" integer,
	"item_id" integer,
	"item_name" varchar(200) NOT NULL,
	"guest_name" varchar(180) NOT NULL,
	"guest_email" varchar(255) NOT NULL,
	"guest_phone" varchar(60) NOT NULL,
	"locale" varchar(2) DEFAULT 'fr' NOT NULL,
	"check_in" date NOT NULL,
	"check_out" date NOT NULL,
	"guests" integer DEFAULT 1 NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"payment_method" varchar(24) DEFAULT 'cash' NOT NULL,
	"payment_status" varchar(24) DEFAULT 'unpaid' NOT NULL,
	"payment_ref" text,
	"payment_amount" integer,
	"payment_currency" varchar(8),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_reference_unique" UNIQUE("reference"),
	CONSTRAINT "bookings_public_token_unique" UNIQUE("public_token")
);
--> statement-breakpoint
CREATE TABLE "catalog_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(200) NOT NULL,
	"category" varchar(30) NOT NULL,
	"name_fr" varchar(200) NOT NULL,
	"name_en" varchar(200) NOT NULL,
	"description_fr" text DEFAULT '' NOT NULL,
	"description_en" text DEFAULT '' NOT NULL,
	"image" text DEFAULT '' NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"pricing_unit" varchar(24) DEFAULT 'night' NOT NULL,
	"capacity" integer DEFAULT 2 NOT NULL,
	"inventory" integer DEFAULT 1 NOT NULL,
	"amenities_fr" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"amenities_en" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(180) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(60),
	"subject" varchar(240) NOT NULL,
	"message" text NOT NULL,
	"status" varchar(20) DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_pages" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(160) NOT NULL,
	"title_fr" varchar(200) NOT NULL,
	"title_en" varchar(200) NOT NULL,
	"body_fr" text DEFAULT '' NOT NULL,
	"body_en" text DEFAULT '' NOT NULL,
	"image" text DEFAULT '' NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"user_id" integer,
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(24) NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"href" text DEFAULT '/admin' NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference" varchar(30),
	"public_token" varchar(80) NOT NULL,
	"user_id" integer,
	"guest_name" varchar(180) NOT NULL,
	"guest_email" varchar(255) NOT NULL,
	"guest_phone" varchar(60) NOT NULL,
	"company" varchar(180),
	"locale" varchar(2) DEFAULT 'fr' NOT NULL,
	"request_kind" varchar(32) DEFAULT 'accommodation' NOT NULL,
	"selected_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"check_in" date,
	"check_out" date,
	"people" integer DEFAULT 1 NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"budget" integer,
	"amount_ttc" integer,
	"valid_until" date,
	"status" varchar(24) DEFAULT 'new' NOT NULL,
	"admin_notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_requests_reference_unique" UNIQUE("reference"),
	CONSTRAINT "quote_requests_public_token_unique" UNIQUE("public_token")
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"hotel_name" varchar(180) DEFAULT 'Palacio Hotel' NOT NULL,
	"logo_url" text DEFAULT '' NOT NULL,
	"hero_image" text DEFAULT '/images/palacio-hero.jpg' NOT NULL,
	"hero_title_fr" text DEFAULT 'Un séjour d’exception, à votre image.' NOT NULL,
	"hero_title_en" text DEFAULT 'An exceptional stay, made for you.' NOT NULL,
	"hero_subtitle_fr" text DEFAULT 'Au cœur de Douala, découvrez une adresse où l’élégance rencontre la chaleur de l’hospitalité.' NOT NULL,
	"hero_subtitle_en" text DEFAULT 'In the heart of Douala, discover a place where elegance meets the warmth of hospitality.' NOT NULL,
	"about_fr" text DEFAULT 'Plus qu’un hôtel, une destination. Chaque détail du Palacio est pensé pour faire de votre séjour un souvenir inoubliable.' NOT NULL,
	"about_en" text DEFAULT 'More than a hotel, a destination. Every detail at Palacio is designed to make your stay unforgettable.' NOT NULL,
	"about_image" text DEFAULT '/images/palacio-dining.jpg' NOT NULL,
	"theme" varchar(24) DEFAULT 'forest' NOT NULL,
	"email" varchar(255) DEFAULT 'bonjour@palaciohotel.com' NOT NULL,
	"phone" varchar(60) DEFAULT '+237 6 99 00 00 00' NOT NULL,
	"whatsapp" varchar(60) DEFAULT '237699000000' NOT NULL,
	"address_fr" text DEFAULT 'Bonanjo, Douala, Cameroun' NOT NULL,
	"address_en" text DEFAULT 'Bonanjo, Douala, Cameroon' NOT NULL,
	"latitude" double precision DEFAULT 4.0511 NOT NULL,
	"longitude" double precision DEFAULT 9.7679 NOT NULL,
	"accepting_quotes" boolean DEFAULT true NOT NULL,
	"ai_provider" varchar(24) DEFAULT 'auto' NOT NULL,
	"ai_base_url" text DEFAULT '' NOT NULL,
	"ai_model" varchar(120) DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" varchar(180) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(60),
	"country" varchar(120) DEFAULT '' NOT NULL,
	"password_hash" text,
	"role" varchar(20) DEFAULT 'guest' NOT NULL,
	"locale" varchar(2) DEFAULT 'fr' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_item_id_catalog_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."catalog_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_requests" ADD CONSTRAINT "quote_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_created_idx" ON "activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "bookings_dates_idx" ON "bookings" USING btree ("item_id","check_in","check_out");--> statement-breakpoint
CREATE INDEX "bookings_email_idx" ON "bookings" USING btree ("guest_email");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_slug_unique" ON "catalog_items" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "catalog_category_idx" ON "catalog_items" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_slug_unique" ON "content_pages" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "quotes_status_idx" ON "quote_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "quotes_email_idx" ON "quote_requests" USING btree ("guest_email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","read","created_at");
