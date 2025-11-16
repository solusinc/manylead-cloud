ALTER TABLE "channel" ADD COLUMN "sync_status" varchar(50) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "channel" ADD COLUMN "sync_completed_at" timestamp;