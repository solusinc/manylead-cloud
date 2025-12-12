ALTER TABLE "proxy_ip_allocation" DROP CONSTRAINT "proxy_ip_allocation_zone_ip_active_unique";--> statement-breakpoint
ALTER TABLE "proxy_ip_allocation" DROP COLUMN "ip_index";--> statement-breakpoint
ALTER TABLE "proxy_ip_allocation" ADD CONSTRAINT "proxy_ip_allocation_org_zone_active_unique" UNIQUE("organization_id","proxy_zone_id","status");