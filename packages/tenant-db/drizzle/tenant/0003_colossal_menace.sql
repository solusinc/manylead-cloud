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
	"id" uuid PRIMARY KEY NOT NULL,
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
	CONSTRAINT "chat_channel_contact_unique" UNIQUE("channel_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY NOT NULL,
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
	CONSTRAINT "message_whatsapp_id_unique" UNIQUE("whatsapp_message_id")
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
ALTER TABLE "organization_settings" ADD COLUMN "chat_assignment_rules" jsonb;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "instance_code" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_channel_id_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channel"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_assigned_to_agent_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."agent"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_message_id_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_status" ADD CONSTRAINT "agent_status_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_org_idx" ON "contact" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "contact_phone_idx" ON "contact" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "contact_name_idx" ON "contact" USING btree ("name");--> statement-breakpoint
CREATE INDEX "chat_org_idx" ON "chat" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "chat_channel_idx" ON "chat" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "chat_contact_idx" ON "chat" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "chat_assigned_idx" ON "chat" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "chat_status_idx" ON "chat" USING btree ("status");--> statement-breakpoint
CREATE INDEX "chat_org_status_last_msg_idx" ON "chat" USING btree ("organization_id","status","last_message_at");--> statement-breakpoint
CREATE INDEX "chat_snoozed_until_idx" ON "chat" USING btree ("snoozed_until");--> statement-breakpoint
CREATE INDEX "message_chat_idx" ON "message" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "message_sender_idx" ON "message" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "message_status_idx" ON "message" USING btree ("status");--> statement-breakpoint
CREATE INDEX "message_chat_timestamp_idx" ON "message" USING btree ("chat_id","timestamp");--> statement-breakpoint
CREATE INDEX "agent_instance_code_idx" ON "agent" USING btree ("instance_code");--> statement-breakpoint
ALTER TABLE "agent" ADD CONSTRAINT "agent_instance_code_unique" UNIQUE("instance_code");