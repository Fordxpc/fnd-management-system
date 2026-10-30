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

  nid: text("nid"),

  joinDate: text("join_date"),

  phone: text("phone"),

  gender: text("gender"),

  department: text("department"),

  position: text("position"),

  isSMT: boolean("is_smt").default(false),

  isIncharge: boolean("is_incharge").default(false),

  balanceVisible: boolean("balance_visible").default(false),

  specialOpsAccess: boolean("special_ops_access").default(false),

  tempDeptAccess: boolean("temp_dept_access").default(false),

  rampsheetEditAccess: boolean("rampsheet_edit_access").default(false),

  rwyLightEditAccess: boolean("rwy_light_edit_access").default(false),

  birdCountEditAccess: boolean("bird_count_edit_access").default(false),

  opsBoardAccess: boolean("ops_board_access").default(false),

  tempDeptTarget: text("temp_dept_target"),

  notes: text("notes"),

  basicSalary: real("basic_salary").default(0),

  dailyAllowance: real("daily_allowance").default(0),

  holidayAllowanceRate: real("holiday_allowance_rate").default(0),

  bankAccount: text("bank_account"),

  status: text("status").default("active"),

  orderIndex: integer("order_index").default(9999),

  createdAt: timestamp("created_at"),

  updatedAt: timestamp("updated_at"),
});

export const leaveRequests = pgTable("leave_requests", {
  id: text("id").primaryKey(),

  staffId: text("staff_id"),

  staffName: text("staff_name"),

  staffDepartment: text("staff_department"),

  staffSN: text("staff_sn"),

  staffGender: text("staff_gender"),

  leaveType: text("leave_type"),

  startDate: text("start_date"),

  endDate: text("end_date"),

  days: integer("days"),

  reason: text("reason"),

  status: text("status").default("pending"),

  requestedBy: text("requested_by"),

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

  checkInTime: text("check_in_time"),

  arrivalTime: text("arrival_time"),

  departureTime: text("departure_time"),

  route: text("route"),

  originDepTime: text("origin_dep_time"),

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

export const holidays = pgTable("holidays", {
  id: text("id").primaryKey(),

  date: text("date"),

  name: text("name"),

  createdAt: timestamp("created_at"),
});

export const timesheets = pgTable("timesheets", {
  id: text("id").primaryKey(),

  staffId: text("staff_id"),

  staffName: text("staff_name"),

  staffDepartment: text("staff_department"),

  date: text("date"),

  clockIn: text("clock_in"),

  clockOut: text("clock_out"),

  status: text("status"),

  notes: text("notes"),

  createdAt: timestamp("created_at"),
});

export const birdCounts = pgTable("bird_counts", {
  id: text("id").primaryKey(),

  date: text("date"),

  refNo: text("ref_no"),

  observer: text("observer"),

  rows: text("rows"),

  createdAt: timestamp("created_at"),
});

export const rampInspections = pgTable("ramp_inspections", {
  id: text("id").primaryKey(),

  date: text("date"),

  fltNo: text("flt_no"),

  acReg: text("ac_reg"),

  payload: text("payload"),

  createdAt: timestamp("created_at"),

  updatedAt: timestamp("updated_at"),
});