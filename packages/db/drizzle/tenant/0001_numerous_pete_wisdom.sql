ALTER TABLE "department" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "agent" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "department" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "department" DROP COLUMN "auto_assignment";