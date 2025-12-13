CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"target_user_id" varchar(255),
	"visible_to_roles" jsonb,
	"type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"action_url" text,
	"metadata" jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "notification_organization_id_idx" ON "notification" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "notification_target_user_idx" ON "notification" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "notification_unread_idx" ON "notification" USING btree ("read","created_at");--> statement-breakpoint
CREATE INDEX "notification_created_at_idx" ON "notification" USING btree ("created_at");