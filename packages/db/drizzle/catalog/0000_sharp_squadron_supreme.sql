CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"instance_code" varchar(50) NOT NULL,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug"),
	CONSTRAINT "organization_instance_code_unique" UNIQUE("instance_code")
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"inviter_id" text NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "database_host" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"host" varchar(255) NOT NULL,
	"port" integer DEFAULT 5432 NOT NULL,
	"region" varchar(50) NOT NULL,
	"tier" varchar(50) DEFAULT 'shared' NOT NULL,
	"max_tenants" integer DEFAULT 70 NOT NULL,
	"current_tenants" integer DEFAULT 0 NOT NULL,
	"disk_capacity_gb" integer NOT NULL,
	"disk_usage_gb" integer DEFAULT 0 NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"is_default" boolean DEFAULT false,
	"capabilities" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_health_check" timestamp,
	CONSTRAINT "database_host_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "tenant" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(255) NOT NULL,
	"database_name" varchar(100) NOT NULL,
	"connection_string" text NOT NULL,
	"database_host_id" uuid NOT NULL,
	"host" varchar(255) NOT NULL,
	"port" integer DEFAULT 5432 NOT NULL,
	"region" varchar(50),
	"tier" varchar(50) DEFAULT 'shared' NOT NULL,
	"status" varchar(50) DEFAULT 'provisioning' NOT NULL,
	"provisioned_at" timestamp,
	"provisioning_details" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "tenant_organization_id_unique" UNIQUE("organization_id"),
	CONSTRAINT "tenant_slug_unique" UNIQUE("slug"),
	CONSTRAINT "tenant_database_name_unique" UNIQUE("database_name")
);
--> statement-breakpoint
CREATE TABLE "tenant_metric" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"message_count" bigint DEFAULT 0 NOT NULL,
	"conversation_count" integer DEFAULT 0 NOT NULL,
	"contact_count" integer DEFAULT 0 NOT NULL,
	"user_count" integer DEFAULT 0 NOT NULL,
	"channel_count" integer DEFAULT 0 NOT NULL,
	"database_size_mb" integer DEFAULT 0 NOT NULL,
	"attachment_count" integer DEFAULT 0 NOT NULL,
	"attachment_size_mb" integer DEFAULT 0 NOT NULL,
	"avg_query_time_ms" integer,
	"connection_count" integer,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "migration_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"migration_name" varchar(255) NOT NULL,
	"status" varchar(50) NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error" text,
	"execution_time_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid,
	"action" varchar(100) NOT NULL,
	"category" varchar(50) NOT NULL,
	"severity" varchar(20) DEFAULT 'info' NOT NULL,
	"description" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant" ADD CONSTRAINT "tenant_database_host_id_database_host_id_fk" FOREIGN KEY ("database_host_id") REFERENCES "public"."database_host"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_metric" ADD CONSTRAINT "tenant_metric_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_log" ADD CONSTRAINT "migration_log_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_instance_code_idx" ON "organization" USING btree ("instance_code");--> statement-breakpoint
CREATE INDEX "member_user_id_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "member_organization_id_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_user_org_idx" ON "member" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "invitation_organization_id_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "invitation_org_status_idx" ON "invitation" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "database_host_name_idx" ON "database_host" USING btree ("name");--> statement-breakpoint
CREATE INDEX "database_host_region_idx" ON "database_host" USING btree ("region");--> statement-breakpoint
CREATE INDEX "database_host_status_idx" ON "database_host" USING btree ("status");--> statement-breakpoint
CREATE INDEX "database_host_tier_idx" ON "database_host" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "tenant_organization_id_idx" ON "tenant" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tenant_slug_idx" ON "tenant" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "tenant_status_idx" ON "tenant" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tenant_database_host_id_idx" ON "tenant" USING btree ("database_host_id");--> statement-breakpoint
CREATE INDEX "tenant_region_idx" ON "tenant" USING btree ("region");--> statement-breakpoint
CREATE INDEX "tenant_metric_tenant_id_idx" ON "tenant_metric" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_metric_period_idx" ON "tenant_metric" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "migration_log_tenant_id_idx" ON "migration_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "migration_log_status_idx" ON "migration_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "activity_log_tenant_id_idx" ON "activity_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "activity_log_action_idx" ON "activity_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "activity_log_category_idx" ON "activity_log" USING btree ("category");--> statement-breakpoint
CREATE INDEX "activity_log_severity_idx" ON "activity_log" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "activity_log_created_at_idx" ON "activity_log" USING btree ("created_at");