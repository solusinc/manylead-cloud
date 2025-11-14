CREATE TABLE "organization_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"working_hours" jsonb,
	"welcome_message" text,
	"closing_message" text,
	"rating_enabled" boolean DEFAULT false NOT NULL,
	"include_user_name" boolean DEFAULT false NOT NULL,
	"hide_phone_digits" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
ALTER TABLE "agent" DROP CONSTRAINT "agent_department_id_department_id_fk";
--> statement-breakpoint
DROP INDEX "agent_dept_idx";--> statement-breakpoint
CREATE INDEX "organization_settings_org_idx" ON "organization_settings" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "department" DROP COLUMN "working_hours";--> statement-breakpoint
ALTER TABLE "agent" DROP COLUMN "department_id";