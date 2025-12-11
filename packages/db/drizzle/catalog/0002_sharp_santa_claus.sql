ALTER TABLE "tenant" ADD COLUMN "connection_string_encrypted" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "connection_string_iv" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant" ADD COLUMN "connection_string_tag" varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "tenant" DROP COLUMN "connection_string";