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
ALTER TABLE "chat" ADD COLUMN "ending_id" uuid;--> statement-breakpoint
CREATE INDEX "ending_org_idx" ON "ending" USING btree ("organization_id");