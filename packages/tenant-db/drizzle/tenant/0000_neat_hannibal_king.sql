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
	"chat_assignment_rules" jsonb,
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
	"instance_code" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "agent_instance_code_unique" UNIQUE("instance_code")
);
--> statement-breakpoint
CREATE TABLE "channel" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"channel_type" varchar(20) NOT NULL,
	"phone_number_id" varchar(100) NOT NULL,
	"phone_number" varchar(20),
	"display_name" varchar(255),
	"profile_picture_url" text,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"sync_status" varchar(50) DEFAULT 'pending' NOT NULL,
	"sync_completed_at" timestamp,
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
CREATE TABLE "contact" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"phone_number" varchar(20) NOT NULL,
	"name" varchar(255) NOT NULL,
	"avatar" text,
	"email" varchar(255),
	"custom_fields" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contact_org_phone_unique" UNIQUE("organization_id","phone_number")
);
--> statement-breakpoint
CREATE TABLE "chat" (
	"id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"channel_id" uuid,
	"contact_id" uuid NOT NULL,
	"message_source" varchar(20) NOT NULL,
	"assigned_to" uuid,
	"department_id" uuid,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"last_message_at" timestamp,
	"last_message_content" text,
	"last_message_sender" varchar(20),
	"unread_count" integer DEFAULT 0 NOT NULL,
	"total_messages" integer DEFAULT 0 NOT NULL,
	"priority" varchar(20) DEFAULT 'normal',
	"is_archived" boolean DEFAULT false NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"snoozed_until" timestamp,
	"initiator_instance_code" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_id_created_at_pk" PRIMARY KEY("id","created_at")
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid NOT NULL,
	"chat_id" uuid NOT NULL,
	"whatsapp_message_id" varchar(255),
	"message_source" varchar(20) NOT NULL,
	"sender" varchar(20) NOT NULL,
	"sender_id" uuid,
	"message_type" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"error_code" varchar(50),
	"error_message" text,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"read_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"is_edited" boolean DEFAULT false NOT NULL,
	"visible_to" varchar(20) DEFAULT 'all',
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "message_id_timestamp_pk" PRIMARY KEY("id","timestamp")
);
--> statement-breakpoint
CREATE TABLE "attachment" (
	"id" uuid PRIMARY KEY NOT NULL,
	"message_id" uuid NOT NULL,
	"media_type" varchar(20) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"whatsapp_media_id" varchar(255),
	"storage_path" text NOT NULL,
	"storage_url" text,
	"file_name" varchar(255) NOT NULL,
	"file_size" integer,
	"width" integer,
	"height" integer,
	"duration" integer,
	"download_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"download_error" text,
	"downloaded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_status" (
	"agent_id" uuid PRIMARY KEY NOT NULL,
	"status" varchar(20) DEFAULT 'offline' NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_channel_id_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channel"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_assigned_to_agent_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."agent"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_status" ADD CONSTRAINT "agent_status_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_settings_org_idx" ON "organization_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "department_org_idx" ON "department" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "department_active_idx" ON "department" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "agent_user_idx" ON "agent" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_active_idx" ON "agent" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "agent_instance_code_idx" ON "agent" USING btree ("instance_code");--> statement-breakpoint
CREATE INDEX "channel_org_idx" ON "channel" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "channel_type_idx" ON "channel" USING btree ("channel_type");--> statement-breakpoint
CREATE INDEX "channel_status_idx" ON "channel" USING btree ("status");--> statement-breakpoint
CREATE INDEX "channel_active_idx" ON "channel" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "channel_active_status_idx" ON "channel" USING btree ("organization_id","is_active","status");--> statement-breakpoint
CREATE INDEX "contact_org_idx" ON "contact" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "contact_phone_idx" ON "contact" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "contact_name_idx" ON "contact" USING btree ("name");--> statement-breakpoint
CREATE INDEX "contact_org_created_idx" ON "contact" USING btree ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "attachment_message_idx" ON "attachment" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "attachment_download_status_idx" ON "attachment" USING btree ("download_status","created_at");--> statement-breakpoint
CREATE INDEX "attachment_media_type_idx" ON "attachment" USING btree ("media_type","created_at" DESC NULLS LAST);