ALTER TYPE "public"."scheduled_status" ADD VALUE 'expired';--> statement-breakpoint
ALTER TABLE "scheduled_message" ADD COLUMN "quick_reply_id" uuid;--> statement-breakpoint
ALTER TABLE "scheduled_message" ADD COLUMN "quick_reply_title" varchar(200);