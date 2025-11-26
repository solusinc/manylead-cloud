CREATE TABLE "quick_reply" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"shortcut" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"content_type" varchar(20) DEFAULT 'text' NOT NULL,
	"content" text NOT NULL,
	"media_url" text,
	"media_name" varchar(255),
	"media_mime_type" varchar(100),
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
CREATE INDEX "quick_reply_org_idx" ON "quick_reply" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "quick_reply_created_by_idx" ON "quick_reply" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "quick_reply_visibility_idx" ON "quick_reply" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "quick_reply_usage_idx" ON "quick_reply" USING btree ("usage_count");