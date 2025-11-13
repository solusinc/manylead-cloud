ALTER TABLE "organization_settings" ADD COLUMN "welcome_message" text;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "closing_message" text;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "rating_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "include_user_name" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD COLUMN "hide_phone_digits" boolean DEFAULT false NOT NULL;