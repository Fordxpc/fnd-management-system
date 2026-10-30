ALTER TABLE "leave_requests" ADD COLUMN "staff_sn" text;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "staff_gender" text;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "requested_by" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "nid" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "join_date" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "special_ops_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "temp_dept_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "rampsheet_edit_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "rwy_light_edit_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "bird_count_edit_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "ops_board_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "temp_dept_target" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "bank_account" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "order_index" integer DEFAULT 9999;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "updated_at" timestamp;