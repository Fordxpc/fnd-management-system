CREATE TABLE "chat_group_members" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"staff_id" text NOT NULL,
	"role" text DEFAULT 'member',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"department" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"sender_name" text NOT NULL,
	"message" text,
	"image_url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fod_collections" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text,
	"grams" double precision,
	"remarks" text,
	"logged_by" text,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "lights_inspectors" (
	"staff_id" text PRIMARY KEY NOT NULL,
	"staff_name" text,
	"staff_sn" text
);
--> statement-breakpoint
CREATE TABLE "ops_checks" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text,
	"time" text,
	"category" text,
	"status" text,
	"remarks" text,
	"checked_by" text,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ops_ground_history" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text,
	"time" text,
	"created_at" timestamp,
	"assignments" text
);
--> statement-breakpoint
CREATE TABLE "ops_runway_history" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text,
	"time" text,
	"created_at" timestamp,
	"rwy19" text,
	"rwy01" text,
	"lights" text
);
--> statement-breakpoint
CREATE TABLE "password_reset_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'pending',
	"requested_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ramp_live_draft" (
	"id" text PRIMARY KEY NOT NULL,
	"payload" text
);
--> statement-breakpoint
CREATE TABLE "rwy_lights" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text,
	"time" text,
	"weather" text,
	"inspector_name" text,
	"data" text,
	"remarks" text,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "saved_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"month" text,
	"date_from" text,
	"date_to" text,
	"type" text,
	"created_by" text,
	"created_at" timestamp
);
--> statement-breakpoint
DROP INDEX "account_userId_idx";--> statement-breakpoint
DROP INDEX "session_userId_idx";--> statement-breakpoint
DROP INDEX "verification_identifier_idx";--> statement-breakpoint
ALTER TABLE "flights" ADD COLUMN "eta" text;--> statement-breakpoint
ALTER TABLE "flights" ADD COLUMN "ata" text;--> statement-breakpoint
ALTER TABLE "flights" ADD COLUMN "atd" text;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "impersonated_by" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "rampsheet_view_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "rwy_light_view_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "bird_count_view_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "ops_board_view_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "ops_board_edit_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "flights_view_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "flights_edit_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "roster_view_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "roster_edit_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "leave_view_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "leave_edit_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "overtime_view_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "overtime_edit_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "reports_view_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "reports_edit_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "staff_view_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "staff_edit_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "settings_view_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "settings_edit_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "chat_group_members" ADD CONSTRAINT "chat_group_members_group_id_chat_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."chat_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_group_id_chat_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."chat_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier" text_ops);--> statement-breakpoint
ALTER TABLE "staff" DROP COLUMN "ops_board_access";