CREATE TABLE "organization_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"working_hours" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
ALTER TABLE "department" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "agent" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
CREATE INDEX "organization_settings_org_idx" ON "organization_settings" USING btree ("organization_id");