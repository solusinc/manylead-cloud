CREATE TYPE "public"."scheduled_content_type" AS ENUM('message', 'comment');--> statement-breakpoint
CREATE TYPE "public"."scheduled_status" AS ENUM('pending', 'processing', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "scheduled_message" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"chat_id" uuid NOT NULL,
	"chat_created_at" timestamp with time zone NOT NULL,
	"contact_id" uuid NOT NULL,
	"created_by_agent_id" uuid NOT NULL,
	"content_type" "scheduled_content_type" DEFAULT 'message' NOT NULL,
	"content" text NOT NULL,
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
CREATE INDEX "scheduled_message_pending_idx" ON "scheduled_message" USING btree ("scheduled_at","status");--> statement-breakpoint
CREATE INDEX "scheduled_message_chat_idx" ON "scheduled_message" USING btree ("chat_id","chat_created_at","status");--> statement-breakpoint
CREATE INDEX "scheduled_message_contact_idx" ON "scheduled_message" USING btree ("contact_id","status");--> statement-breakpoint
CREATE INDEX "scheduled_message_org_idx" ON "scheduled_message" USING btree ("organization_id","status","scheduled_at");--> statement-breakpoint
CREATE INDEX "scheduled_message_job_idx" ON "scheduled_message" USING btree ("job_id");