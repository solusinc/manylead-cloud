CREATE TABLE "department" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"auto_assignment" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "department_org_name_unique" UNIQUE("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "agent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"department_id" uuid,
	"permissions" jsonb DEFAULT '{"departments":{"type":"all"},"channels":{"type":"all"}}'::jsonb NOT NULL,
	"max_active_conversations" integer DEFAULT 10 NOT NULL,
	"current_active_conversations" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "agent" ADD CONSTRAINT "agent_department_id_department_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."department"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "department_org_idx" ON "department" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "department_active_idx" ON "department" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "agent_user_idx" ON "agent" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_dept_idx" ON "agent" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "agent_active_idx" ON "agent" USING btree ("is_active");