// src/db/schema.ts

import {
  pgTable,
  text,
  boolean,
  timestamp,
  real,
  integer,
  index,
} from "drizzle-orm/pg-core";

import { relations } from "drizzle-orm";

// =============================================================
// Application tables
// =============================================================

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

  eta: text("eta"),

  ata: text("ata"),

  atd: text("atd"),

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

export const userPresets = pgTable("user_presets", {
  id: text("id").primaryKey(),

  email: text("email"),

  role: text("role"),

  department: text("department"),

  name: text("name"),

  position: text("position"),

  createdAt: timestamp("created_at"),
});

export const tempAccess = pgTable("temp_access", {
  id: text("id").primaryKey(),

  email: text("email"),

  targetDept: text("target_dept"),

  startDate: text("start_date"),

  endDate: text("end_date"),
});

export const settings = pgTable("settings", {
  id: text("id").primaryKey(),

  adminHours: integer("admin_hours"),

  regularHours: integer("regular_hours"),

  deductLeaves: text("deduct_leaves"),
});

// =============================================================
// Ops Board / FOD / Lights / Reports / Ramp Draft tables
// =============================================================

export const opsGroundHistory = pgTable("ops_ground_history", {
  id: text("id").primaryKey(),
  date: text("date"),
  time: text("time"),
  createdAt: timestamp("created_at"),
  assignments: text("assignments"),
});

export const opsRunwayHistory = pgTable("ops_runway_history", {
  id: text("id").primaryKey(),
  date: text("date"),
  time: text("time"),
  createdAt: timestamp("created_at"),
  rwy19: text("rwy19"),
  rwy01: text("rwy01"),
  lights: text("lights"),
});

export const fodCollections = pgTable("fod_collections", {
  id: text("id").primaryKey(),
  date: text("date"),
  grams: real("grams"),
  remarks: text("remarks"),
  loggedBy: text("logged_by"),
  createdAt: timestamp("created_at"),
});

export const lightsInspectors = pgTable("lights_inspectors", {
  staffId: text("staff_id").primaryKey(),
  staffName: text("staff_name"),
  staffSN: text("staff_sn"),
});

export const rwyLights = pgTable("rwy_lights", {
  id: text("id").primaryKey(),
  date: text("date"),
  time: text("time"),
  weather: text("weather"),
  inspectorName: text("inspector_name"),
  data: text("data"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at"),
});

export const savedReports = pgTable("saved_reports", {
  id: text("id").primaryKey(),
  month: text("month"),
  dateFrom: text("date_from"),
  dateTo: text("date_to"),
  type: text("type"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at"),
});

export const rampLiveDraft = pgTable("ramp_live_draft", {
  id: text("id").primaryKey(),
  payload: text("payload"),
});

// =============================================================
// Better Auth tables
// =============================================================

export const user = pgTable("user", {
  id: text("id").primaryKey(),

  name: text("name").notNull(),

  email: text("email").notNull().unique(),

  emailVerified: boolean("email_verified").default(false).notNull(),

  image: text("image"),

  createdAt: timestamp("created_at").defaultNow().notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),

  role: text("role"),

  department: text("department"),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),

    expiresAt: timestamp("expires_at").notNull(),

    token: text("token").notNull().unique(),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),

    ipAddress: text("ip_address"),

    userAgent: text("user_agent"),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),

    accountId: text("account_id").notNull(),

    providerId: text("provider_id").notNull(),

    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    accessToken: text("access_token"),

    refreshToken: text("refresh_token"),

    idToken: text("id_token"),

    accessTokenExpiresAt: timestamp("access_token_expires_at"),

    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),

    scope: text("scope"),

    password: text("password"),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),

    identifier: text("identifier").notNull(),

    value: text("value").notNull(),

    expiresAt: timestamp("expires_at").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),

    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// =============================================================
// Better Auth relations
// =============================================================

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));