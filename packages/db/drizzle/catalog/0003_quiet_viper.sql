CREATE TABLE "proxy_ip_allocation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"proxy_zone_id" uuid NOT NULL,
	"ip_index" integer NOT NULL,
	"session_id" text NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"allocated_at" timestamp DEFAULT now() NOT NULL,
	"released_at" timestamp,
	CONSTRAINT "proxy_ip_allocation_zone_ip_active_unique" UNIQUE("proxy_zone_id","ip_index","status")
);
--> statement-breakpoint
ALTER TABLE "proxy_ip_allocation" ADD CONSTRAINT "proxy_ip_allocation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proxy_ip_allocation" ADD CONSTRAINT "proxy_ip_allocation_proxy_zone_id_proxy_zone_id_fk" FOREIGN KEY ("proxy_zone_id") REFERENCES "public"."proxy_zone"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "proxy_ip_allocation_org_idx" ON "proxy_ip_allocation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "proxy_ip_allocation_zone_idx" ON "proxy_ip_allocation" USING btree ("proxy_zone_id");--> statement-breakpoint
CREATE INDEX "proxy_ip_allocation_status_idx" ON "proxy_ip_allocation" USING btree ("status");