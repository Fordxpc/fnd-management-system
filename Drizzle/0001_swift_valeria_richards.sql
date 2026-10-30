CREATE TABLE "flights" (
	"id" text PRIMARY KEY NOT NULL,
	"date" text,
	"flight_no" text,
	"type" text,
	"aircraft" text,
	"route" text,
	"status" text,
	"remarks" text,
	"created_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_id" text,
	"staff_name" text,
	"leave_type" text,
	"start_date" text,
	"end_date" text,
	"days" integer,
	"reason" text,
	"status" text DEFAULT 'pending',
	"requested_at" timestamp,
	"reviewed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "staff" ALTER COLUMN "is_smt" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ALTER COLUMN "balance_visible" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "personal_email" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "is_incharge" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "basic_salary" real DEFAULT 0;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "daily_allowance" real DEFAULT 0;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "holiday_allowance_rate" real DEFAULT 0;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "status" text DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "created_at" timestamp;