ALTER TABLE "quick_reply" ALTER COLUMN "content" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "quick_reply" ADD COLUMN "messages" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "quick_reply" DROP COLUMN "content_type";--> statement-breakpoint
ALTER TABLE "quick_reply" DROP COLUMN "media_url";--> statement-breakpoint
ALTER TABLE "quick_reply" DROP COLUMN "media_name";--> statement-breakpoint
ALTER TABLE "quick_reply" DROP COLUMN "media_mime_type";