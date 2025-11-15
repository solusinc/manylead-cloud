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
CREATE TABLE "department" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "department_org_name_unique" UNIQUE("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "agent" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"permissions" jsonb DEFAULT '{"departments":{"type":"all"},"channels":{"type":"all"}}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "channel" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"channel_type" varchar(20) NOT NULL,
	"phone_number_id" varchar(100) NOT NULL,
	"phone_number" varchar(20),
	"display_name" varchar(255) NOT NULL,
	"profile_picture_url" text,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"evolution_instance_name" varchar(100) NOT NULL,
	"evolution_connection_state" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_connected_at" timestamp,
	"last_message_at" timestamp,
	"message_count" integer DEFAULT 0 NOT NULL,
	"connection_attempts" integer DEFAULT 0 NOT NULL,
	"verified_at" timestamp,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "channel_phone_number_id_unique" UNIQUE("phone_number_id"),
	CONSTRAINT "channel_evolution_instance_name_unique" UNIQUE("evolution_instance_name"),
	CONSTRAINT "channel_org_type_unique" UNIQUE("organization_id","channel_type"),
	CONSTRAINT "channel_org_phone_unique" UNIQUE("organization_id","phone_number_id")
);
--> statement-breakpoint
CREATE INDEX "organization_settings_org_idx" ON "organization_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "department_org_idx" ON "department" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "department_active_idx" ON "department" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "agent_user_idx" ON "agent" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_active_idx" ON "agent" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "channel_org_idx" ON "channel" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "channel_type_idx" ON "channel" USING btree ("channel_type");--> statement-breakpoint
CREATE INDEX "channel_status_idx" ON "channel" USING btree ("status");--> statement-breakpoint
CREATE INDEX "channel_active_idx" ON "channel" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "channel_active_status_idx" ON "channel" USING btree ("organization_id","is_active","status");