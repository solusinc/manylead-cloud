ALTER TABLE "database_host" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "tenant" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "tenant_metric" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "migration_log" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "activity_log" ALTER COLUMN "id" DROP DEFAULT;