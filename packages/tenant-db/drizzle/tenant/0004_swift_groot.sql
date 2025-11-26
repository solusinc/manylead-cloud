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
ALTER TABLE "chat_tag" ADD CONSTRAINT "chat_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tag_org_idx" ON "tag" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "chat_tag_chat_idx" ON "chat_tag" USING btree ("chat_id","chat_created_at");--> statement-breakpoint
CREATE INDEX "chat_tag_tag_idx" ON "chat_tag" USING btree ("tag_id");