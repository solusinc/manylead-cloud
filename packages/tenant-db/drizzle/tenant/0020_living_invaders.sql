ALTER TABLE "contact" ADD COLUMN "is_group" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contact" ADD COLUMN "group_jid" varchar(50);--> statement-breakpoint
CREATE INDEX "contact_group_jid_idx" ON "contact" USING btree ("group_jid");--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_org_group_jid_unique" UNIQUE("organization_id","group_jid");