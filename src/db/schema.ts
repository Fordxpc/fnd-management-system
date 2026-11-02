import { pgTable, text, timestamp, unique, boolean, real, integer, index, foreignKey, serial, doublePrecision } from "drizzle-orm/pg-core"

// ==========================================
// BETTER AUTH TABLES
// ==========================================
export const user = pgTable("user", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text(),
	createdAt: timestamp("created_at", { mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'date' }).defaultNow().notNull(),
	role: text(),
	department: text(),
}, (table) => [unique("user_email_unique").on(table.email)]);

export const session = pgTable("session", {
	id: text().primaryKey().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'date' }).notNull(),
	token: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'date' }).notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id").notNull(),
	impersonatedBy: text("impersonated_by"),
}, (table) => [
	index("session_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({ columns: [table.userId], foreignColumns: [user.id], name: "session_user_id_user_id_fk" }).onDelete("cascade"),
	unique("session_token_unique").on(table.token),
]);

export const account = pgTable("account", {
	id: text().primaryKey().notNull(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id").notNull(),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: 'date' }),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: 'date' }),
	scope: text(),
	password: text(),
	createdAt: timestamp("created_at", { mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'date' }).notNull(),
}, (table) => [
	index("account_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({ columns: [table.userId], foreignColumns: [user.id], name: "account_user_id_user_id_fk" }).onDelete("cascade"),
]);

export const verification = pgTable("verification", {
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'date' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'date' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'date' }).defaultNow().notNull(),
}, (table) => [index("verification_identifier_idx").using("btree", table.identifier.asc().nullsLast().op("text_ops"))]);

// ==========================================
// APPLICATION TABLES
// ==========================================
export const birdCounts = pgTable("bird_counts", {
	id: text().primaryKey().notNull(), date: text(), refNo: text("ref_no"),
	observer: text(), rows: text(), createdAt: timestamp("created_at", { mode: 'string' }),
});

export const holidays = pgTable("holidays", {
	id: text().primaryKey().notNull(), date: text(), name: text(),
	createdAt: timestamp("created_at", { mode: 'string' }),
});

export const flights = pgTable("flights", {
	id: text().primaryKey().notNull(), date: text(), flightNo: text("flight_no"),
	type: text(), aircraft: text(), route: text(), status: text(), remarks: text(),
	createdAt: timestamp("created_at", { mode: 'string' }), bookedFigure: text("booked_figure"),
	originDepTime: text("origin_dep_time"), checkInTime: text("check_in_time"),
	arrivalTime: text("arrival_time"), departureTime: text("departure_time"),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
	eta: text(), ata: text(), atd: text(),
});

export const staff = pgTable("staff", {
	id: text().primaryKey().notNull(), sn: text(), name: text(), email: text(),
	department: text(), position: text(), isSmt: boolean("is_smt").default(false),
	balanceVisible: boolean("balance_visible").default(false), personalEmail: text("personal_email"),
	isIncharge: boolean("is_incharge").default(false), basicSalary: real("basic_salary").default(0),
	dailyAllowance: real("daily_allowance").default(0), holidayAllowanceRate: real("holiday_allowance_rate").default(0),
	status: text().default('active'), createdAt: timestamp("created_at", { mode: 'string' }),
	nid: text(), joinDate: text("join_date"), phone: text(), gender: text(),
	specialOpsAccess: boolean("special_ops_access").default(false),
	tempDeptAccess: boolean("temp_dept_access").default(false),
	// 🚨 NEW VIEW/EDIT COLUMNS
	rampsheetViewAccess: boolean("rampsheet_view_access").default(false),
	rampsheetEditAccess: boolean("rampsheet_edit_access").default(false),
	rwyLightViewAccess: boolean("rwy_light_view_access").default(false),
	rwyLightEditAccess: boolean("rwy_light_edit_access").default(false),
	birdCountViewAccess: boolean("bird_count_view_access").default(false),
	birdCountEditAccess: boolean("bird_count_edit_access").default(false),
	opsBoardViewAccess: boolean("ops_board_view_access").default(false),
	opsBoardEditAccess: boolean("ops_board_edit_access").default(false),
	
	tempDeptTarget: text("temp_dept_target"), notes: text(), bankAccount: text("bank_account"),
	orderIndex: integer("order_index").default(9999), updatedAt: timestamp("updated_at", { mode: 'string' }),
}, (table) => [unique("staff_email_unique").on(table.email)]);

export const users = pgTable("users", {
	id: text().primaryKey().notNull(), email: text(), role: text(), department: text(),
	createdAt: timestamp("created_at", { mode: 'string' }),
}, (table) => [unique("users_email_unique").on(table.email)]);

export const rampInspections = pgTable("ramp_inspections", {
	id: text().primaryKey().notNull(), date: text(), fltNo: text("flt_no"),
	acReg: text("ac_reg"), payload: text(),
	createdAt: timestamp("created_at", { mode: 'string' }), updatedAt: timestamp("updated_at", { mode: 'string' }),
});

export const timesheets = pgTable("timesheets", {
	id: text().primaryKey().notNull(), staffId: text("staff_id"), staffName: text("staff_name"),
	staffDepartment: text("staff_department"), date: text(), clockIn: text("clock_in"),
	clockOut: text("clock_out"), status: text(), notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }),
});

export const lightsInspectors = pgTable("lights_inspectors", {
	staffId: text("staff_id").primaryKey().notNull(), staffName: text("staff_name"), staffSn: text("staff_sn"),
});

export const fodCollections = pgTable("fod_collections", {
	id: text().primaryKey().notNull(), date: text(), grams: doublePrecision(),
	remarks: text(), loggedBy: text("logged_by"), createdAt: timestamp("created_at", { mode: 'string' }),
});

export const settings = pgTable("settings", {
	id: text().primaryKey().notNull(), adminHours: integer("admin_hours"),
	regularHours: integer("regular_hours"), deductLeaves: text("deduct_leaves"),
});

export const rosterEntries = pgTable("roster_entries", {
	id: text().primaryKey().notNull(), staffId: text("staff_id"), staffName: text("staff_name"),
	staffDepartment: text("staff_department"), date: text(), shiftTime: text("shift_time"),
	status: text(), leaveRequestId: text("leave_request_id"), createdAt: timestamp("created_at", { mode: 'string' }),
});

export const tempAccess = pgTable("temp_access", {
	id: text().primaryKey().notNull(), email: text(), targetDept: text("target_dept"),
	startDate: text("start_date"), endDate: text("end_date"),
});

export const overtimeEntries = pgTable("overtime_entries", {
	id: text().primaryKey().notNull(), staffId: text("staff_id"), staffName: text("staff_name"),
	staffSn: text("staff_sn"), staffDepartment: text("staff_department"), date: text(),
	startTime: text("start_time"), endTime: text("end_time"), hours: real(), notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }), createdBy: text("created_by"),
	status: text(), reviewedBy: text("reviewed_by"), reviewedAt: timestamp("reviewed_at", { mode: 'string' }),
});

export const leaveRequests = pgTable("leave_requests", {
	id: text().primaryKey().notNull(), staffId: text("staff_id"), staffName: text("staff_name"),
	leaveType: text("leave_type"), startDate: text("start_date"), endDate: text("end_date"),
	days: integer(), reason: text(), status: text().default('pending'),
	requestedAt: timestamp("requested_at", { mode: 'string' }), reviewedAt: timestamp("reviewed_at", { mode: 'string' }),
	staffDepartment: text("staff_department"), reviewedBy: text("reviewed_by"), reviewNotes: text("review_notes"),
	staffSn: text("staff_sn"), staffGender: text("staff_gender"), requestedBy: text("requested_by"),
});

export const userPresets = pgTable("user_presets", {
	id: text().primaryKey().notNull(), email: text(), role: text(), department: text(),
	name: text(), position: text(), createdAt: timestamp("created_at", { mode: 'string' }),
});

export const rampLiveDraft = pgTable("ramp_live_draft", {
	id: text().primaryKey().notNull(), payload: text(),
});

export const opsGroundHistory = pgTable("ops_ground_history", {
	id: text().primaryKey().notNull(), date: text(), time: text(),
	createdAt: timestamp("created_at", { mode: 'string' }), assignments: text(),
});

export const opsRunwayHistory = pgTable("ops_runway_history", {
	id: text().primaryKey().notNull(), date: text(), time: text(),
	createdAt: timestamp("created_at", { mode: 'string' }), rwy19: text(), rwy01: text(), lights: text(),
});

export const savedReports = pgTable("saved_reports", {
	id: text().primaryKey().notNull(), month: text(), dateFrom: text("date_from"),
	dateTo: text("date_to"), type: text(), createdBy: text("created_by"),
	createdAt: timestamp("created_at", { mode: 'string' }),
});

export const opsChecks = pgTable("ops_checks", {
	id: text().primaryKey().notNull(), date: text(), time: text(), category: text(),
	status: text(), remarks: text(), checkedBy: text("checked_by"),
	createdAt: timestamp("created_at", { mode: 'string' }),
});

export const rwyLights = pgTable("rwy_lights", {
	id: text().primaryKey().notNull(), date: text(), time: text(), weather: text(),
	inspectorName: text("inspector_name"), data: text(), remarks: text(),
	createdAt: timestamp("created_at", { mode: 'string' }),
});

export const passwordResetRequests = pgTable("password_reset_requests", {
	id: text().primaryKey().notNull(), email: text().notNull(), status: text().default('pending'),
	requestedAt: timestamp("requested_at", { mode: 'string' }).defaultNow(),
});

// ==========================================
// CHAT SYSTEM TABLES
// ==========================================
export const chatGroups = pgTable("chat_groups", {
	id: text().primaryKey().notNull(), name: text().notNull(), description: text(),
	department: text(), createdBy: text("created_by"), createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const chatGroupMembers = pgTable("chat_group_members", {
	id: text().primaryKey().notNull(), groupId: text("group_id").notNull().references(() => chatGroups.id, { onDelete: 'cascade' }),
	staffId: text("staff_id").notNull(), role: text().default('member'), createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
	id: text().primaryKey().notNull(), groupId: text("group_id").notNull().references(() => chatGroups.id, { onDelete: 'cascade' }),
	senderId: text("sender_id").notNull(), senderName: text("sender_name").notNull(),
	message: text(), imageUrl: text("image_url"), createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});