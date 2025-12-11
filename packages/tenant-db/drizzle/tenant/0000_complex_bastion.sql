CREATE TYPE "public"."scheduled_content_type" AS ENUM('message', 'comment');--> statement-breakpoint
CREATE TYPE "public"."scheduled_status" AS ENUM('pending', 'processing', 'sent', 'failed', 'cancelled', 'expired');--> statement-breakpoint
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
	"proxy_settings" jsonb DEFAULT '{"enabled":true,"proxyType":"isp"}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_settings_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "department" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
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
	"permissions" jsonb DEFAULT '{"departments":{"type":"all"},"channels":{"type":"all"},"messages":{"canEdit":false,"canDelete":false},"accessFinishedChats":false,"notificationSoundsEnabled":true}'::jsonb NOT NULL,
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
	"phone_number" varchar(20),
	"is_group" boolean DEFAULT false NOT NULL,
	"group_jid" varchar(50),
	"name" varchar(255) NOT NULL,
	"avatar" text,
	"email" varchar(255),
	"custom_name" varchar(255),
	"notes" text,
	"custom_fields" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contact_org_phone_unique" UNIQUE("organization_id","phone_number"),
	CONSTRAINT "contact_org_group_jid_unique" UNIQUE("organization_id","group_jid")
);
--> statement-breakpoint
CREATE TABLE "chat" (
	"id" uuid NOT NULL,
	"organization_id" text NOT NULL,
	"channel_id" uuid,
	"contact_id" uuid NOT NULL,
	"message_source" varchar(20) NOT NULL,
	"initiator_agent_id" uuid,
	"assigned_to" uuid,
	"department_id" uuid,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"last_message_at" timestamp,
	"last_message_content" text,
	"last_message_sender" varchar(20),
	"last_message_status" varchar(20),
	"last_message_type" varchar(20),
	"last_message_is_deleted" boolean DEFAULT false NOT NULL,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"total_messages" integer DEFAULT 0 NOT NULL,
	"priority" varchar(20) DEFAULT 'normal',
	"is_archived" boolean DEFAULT false NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"pinned_at" timestamp,
	"snoozed_until" timestamp,
	"ending_id" uuid,
	"rating_status" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_id_created_at_pk" PRIMARY KEY("id","created_at")
);
--> statement-breakpoint
CREATE TABLE "chat_participant" (
	"chat_id" uuid NOT NULL,
	"chat_created_at" timestamp NOT NULL,
	"agent_id" uuid NOT NULL,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"last_read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_participant_chat_id_chat_created_at_agent_id_pk" PRIMARY KEY("chat_id","chat_created_at","agent_id")
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid NOT NULL,
	"chat_id" uuid NOT NULL,
	"whatsapp_message_id" varchar(255),
	"message_source" varchar(20) NOT NULL,
	"sender" varchar(20) NOT NULL,
	"sender_id" uuid,
	"sender_name" varchar(255),
	"message_type" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"replied_to_message_id" uuid,
	"metadata" jsonb,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"error_code" varchar(50),
	"error_message" text,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"read_at" timestamp,
	"edited_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"is_edited" boolean DEFAULT false NOT NULL,
	"is_starred" boolean DEFAULT false NOT NULL,
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
CREATE TABLE "tag" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(7) DEFAULT '#3b82f6' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tag_org_name_unique" UNIQUE("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "chat_tag" (
	"id" uuid PRIMARY KEY NOT NULL,
	"chat_id" uuid NOT NULL,
	"chat_created_at" timestamp NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_tag_unique" UNIQUE("chat_id","chat_created_at","tag_id")
);
--> statement-breakpoint
CREATE TABLE "quick_reply" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"shortcut" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"visibility" varchar(20) DEFAULT 'organization' NOT NULL,
	"created_by" text NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quick_reply_org_shortcut_unique" UNIQUE("organization_id","shortcut")
);
--> statement-breakpoint
CREATE TABLE "ending" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"title" varchar(100) NOT NULL,
	"ending_message" text,
	"rating_behavior" varchar(20) DEFAULT 'default' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ending_org_title_unique" UNIQUE("organization_id","title")
);
--> statement-breakpoint
CREATE TABLE "scheduled_message" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"chat_id" uuid NOT NULL,
	"chat_created_at" timestamp with time zone NOT NULL,
	"created_by_agent_id" uuid NOT NULL,
	"content_type" "scheduled_content_type" DEFAULT 'message' NOT NULL,
	"content" text NOT NULL,
	"quick_reply_id" uuid,
	"quick_reply_title" varchar(200),
	"scheduled_at" timestamp with time zone NOT NULL,
	"timezone" varchar(50) NOT NULL,
	"status" "scheduled_status" DEFAULT 'pending' NOT NULL,
	"cancel_on_contact_message" boolean DEFAULT false NOT NULL,
	"cancel_on_agent_message" boolean DEFAULT false NOT NULL,
	"cancel_on_chat_close" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{"history":[]}'::jsonb NOT NULL,
	"job_id" varchar(255),
	"sent_at" timestamp with time zone,
	"sent_message_id" uuid,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_agent_id" uuid,
	"cancellation_reason" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_rating" (
	"id" uuid PRIMARY KEY NOT NULL,
	"chat_id" uuid NOT NULL,
	"chat_created_at" timestamp NOT NULL,
	"contact_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"rated_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_channel_id_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channel"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_initiator_agent_id_agent_id_fk" FOREIGN KEY ("initiator_agent_id") REFERENCES "public"."agent"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_assigned_to_agent_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."agent"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_participant" ADD CONSTRAINT "chat_participant_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_status" ADD CONSTRAINT "agent_status_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_tag" ADD CONSTRAINT "chat_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_settings_org_idx" ON "organization_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "department_org_idx" ON "department" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "department_active_idx" ON "department" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "department_default_idx" ON "department" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX "agent_user_idx" ON "agent" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_active_idx" ON "agent" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "channel_org_idx" ON "channel" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "channel_type_idx" ON "channel" USING btree ("channel_type");--> statement-breakpoint
CREATE INDEX "channel_status_idx" ON "channel" USING btree ("status");--> statement-breakpoint
CREATE INDEX "channel_active_idx" ON "channel" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "channel_active_status_idx" ON "channel" USING btree ("organization_id","is_active","status");--> statement-breakpoint
CREATE INDEX "contact_org_idx" ON "contact" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "contact_phone_idx" ON "contact" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "contact_group_jid_idx" ON "contact" USING btree ("group_jid");--> statement-breakpoint
CREATE INDEX "contact_name_idx" ON "contact" USING btree ("name");--> statement-breakpoint
CREATE INDEX "contact_org_created_idx" ON "contact" USING btree ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "attachment_message_idx" ON "attachment" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "attachment_download_status_idx" ON "attachment" USING btree ("download_status","created_at");--> statement-breakpoint
CREATE INDEX "attachment_media_type_idx" ON "attachment" USING btree ("media_type","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "tag_org_idx" ON "tag" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "chat_tag_chat_idx" ON "chat_tag" USING btree ("chat_id","chat_created_at");--> statement-breakpoint
CREATE INDEX "chat_tag_tag_idx" ON "chat_tag" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "quick_reply_org_idx" ON "quick_reply" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "quick_reply_created_by_idx" ON "quick_reply" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "quick_reply_visibility_idx" ON "quick_reply" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "quick_reply_usage_idx" ON "quick_reply" USING btree ("usage_count");--> statement-breakpoint
CREATE INDEX "ending_org_idx" ON "ending" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "scheduled_message_pending_idx" ON "scheduled_message" USING btree ("scheduled_at","status");--> statement-breakpoint
CREATE INDEX "scheduled_message_chat_idx" ON "scheduled_message" USING btree ("chat_id","chat_created_at","status");--> statement-breakpoint
CREATE INDEX "scheduled_message_org_idx" ON "scheduled_message" USING btree ("organization_id","status","scheduled_at");--> statement-breakpoint
CREATE INDEX "scheduled_message_job_idx" ON "scheduled_message" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "chat_rating_chat_idx" ON "chat_rating" USING btree ("chat_id","chat_created_at");--> statement-breakpoint
CREATE INDEX "chat_rating_contact_idx" ON "chat_rating" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "chat_rating_rated_at_idx" ON "chat_rating" USING btree ("rated_at");