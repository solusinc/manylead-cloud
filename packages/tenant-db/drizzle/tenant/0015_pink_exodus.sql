ALTER TABLE "department" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "department_default_idx" ON "department" USING btree ("is_default");