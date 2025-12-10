CREATE TABLE "proxy_zone" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(20) NOT NULL,
	"country" varchar(5) NOT NULL,
	"customer_id" varchar(100) NOT NULL,
	"zone" varchar(100) NOT NULL,
	"host" varchar(255) DEFAULT 'brd.superproxy.io' NOT NULL,
	"port" integer NOT NULL,
	"password_encrypted" text NOT NULL,
	"password_iv" varchar(64) NOT NULL,
	"password_tag" varchar(64) NOT NULL,
	"pool_size" integer,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "proxy_zone_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE INDEX "proxy_zone_type_idx" ON "proxy_zone" USING btree ("type");--> statement-breakpoint
CREATE INDEX "proxy_zone_country_idx" ON "proxy_zone" USING btree ("country");--> statement-breakpoint
CREATE INDEX "proxy_zone_status_idx" ON "proxy_zone" USING btree ("status");--> statement-breakpoint
CREATE INDEX "proxy_zone_type_country_idx" ON "proxy_zone" USING btree ("type","country");