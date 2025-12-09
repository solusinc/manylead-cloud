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
ALTER TABLE "chat" ADD COLUMN "rating_status" varchar(20);--> statement-breakpoint
CREATE INDEX "chat_rating_chat_idx" ON "chat_rating" USING btree ("chat_id","chat_created_at");--> statement-breakpoint
CREATE INDEX "chat_rating_contact_idx" ON "chat_rating" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "chat_rating_rated_at_idx" ON "chat_rating" USING btree ("rated_at");