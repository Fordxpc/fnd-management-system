import {
  pgTable,
  text,
  boolean,
  timestamp,
  real,
  integer,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").unique(),
  role: text("role"),
  department: text("department"),
  createdAt: timestamp("created_at"),
});

export const staff = pgTable("staff", {
  id: text("id").primaryKey(),

  sn: text("sn"),
  name: text("name"),

  email: text("email").unique(),
  personalEmail: text("personal_email"),

  department: text("department"),
  position: text("position"),

  isSMT: boolean("is_smt").default(false),
  isIncharge: boolean("is_incharge").default(false),
  balanceVisible: boolean("balance_visible").default(false),

  basicSalary: real("basic_salary").default(0),
  dailyAllowance: real("daily_allowance").default(0),
  holidayAllowanceRate: real("holiday_allowance_rate").default(0),

  status: text("status").default("active"),

  createdAt: timestamp("created_at"),
});

export const leaveRequests = pgTable("leave_requests", {
  id: text("id").primaryKey(),

  staffId: text("staff_id"),
  staffName: text("staff_name"),
  staffDepartment: text("staff_department"),

  leaveType: text("leave_type"),

  startDate: text("start_date"),
  endDate: text("end_date"),

  days: integer("days"),

  reason: text("reason"),

  status: text("status").default("pending"),

  requestedAt: timestamp("requested_at"),

  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),

  reviewNotes: text("review_notes"),
});

export const rosterEntries = pgTable("roster_entries", {
  id: text("id").primaryKey(),

  staffId: text("staff_id"),
  staffName: text("staff_name"),
  staffDepartment: text("staff_department"),

  date: text("date"),

  shiftTime: text("shift_time"),

  status: text("status"),

  leaveRequestId: text("leave_request_id"),

  createdAt: timestamp("created_at"),
});

export const flights = pgTable("flights", {
  id: text("id").primaryKey(),

  date: text("date"),

  flightNo: text("flight_no"),

  type: text("type"),

  aircraft: text("aircraft"),

  bookedFigure: text("booked_figure"),

  route: text("route"),

  originDepTime: text("origin_dep_time"),

  checkInTime: text("check_in_time"),

  arrivalTime: text("arrival_time"),

  departureTime: text("departure_time"),

  status: text("status"),

  remarks: text("remarks"),

  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

export const overtimeEntries = pgTable("overtime_entries", {
  id: text("id").primaryKey(),

  staffId: text("staff_id"),

  staffName: text("staff_name"),

  staffSN: text("staff_sn"),

  staffDepartment: text("staff_department"),

  date: text("date"),

  startTime: text("start_time"),

  endTime: text("end_time"),

  hours: real("hours"),

  notes: text("notes"),

  status: text("status"),

  createdBy: text("created_by"),

  reviewedBy: text("reviewed_by"),

  createdAt: timestamp("created_at"),

  reviewedAt: timestamp("reviewed_at"),
});