ALTER TABLE "flights" ADD COLUMN "booked_figure" text;--> statement-breakpoint
ALTER TABLE "flights" ADD COLUMN "origin_dep_time" text;--> statement-breakpoint
ALTER TABLE "flights" ADD COLUMN "check_in_time" text;--> statement-breakpoint
ALTER TABLE "flights" ADD COLUMN "arrival_time" text;--> statement-breakpoint
ALTER TABLE "flights" ADD COLUMN "departure_time" text;--> statement-breakpoint
ALTER TABLE "flights" ADD COLUMN "updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "staff_department" text;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN "review_notes" text;--> statement-breakpoint
ALTER TABLE "overtime_entries" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "overtime_entries" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "overtime_entries" ADD COLUMN "reviewed_at" timestamp;