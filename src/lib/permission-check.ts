// functions/lib/permission-check.ts

import { getDb } from "../../src/lib/db";
import { staff, users } from "../../src/db/schema";
import { eq } from "drizzle-orm";

export interface CurrentUser {
  id: string;
  email: string;
  role: string;
  department?: string;
}

/**
 * Full administrators
 */
export function hasFullAccess(user: CurrentUser): boolean {
  const role = (user?.role || "").toLowerCase();

  return [
    "developer",
    "manager",
    "admin",
    "owner",
  ].includes(role);
}

/**
 * Centralized helper — Developer
 */
export function isDeveloper(currentUser: CurrentUser): boolean {
  return (currentUser?.role || "").toLowerCase() === "developer";
}

/**
 * Centralized helper — Admin or Manager
 */
export function isAdminOrManager(currentUser: CurrentUser): boolean {
  return ["admin", "manager"].includes((currentUser?.role || "").toLowerCase());
}

/**
 * Centralized helper — SMT profile (staff row)
 */
function isSMTProfile(profile: any): boolean {
  return !!(profile && (profile.isSmt === true || profile.isIncharge === true));
}

/**
 * Load staff profile connected to current user
 */
export async function getStaffProfile(
  env: any,
  email: string
) {
  const db = getDb(env);

  const result = await db
    .select()
    .from(staff)
    .where(eq(staff.email, email.toLowerCase()))
    .limit(1);

  return result[0] || null;
}

/**
 * Generic permission checker
 */
export async function requirePermission(
  env: any,
  currentUser: CurrentUser,
  permissionField: string
) {
  if (hasFullAccess(currentUser)) {
    return true;
  }

  const staffProfile = await getStaffProfile(
    env,
    currentUser.email
  );

  if (!staffProfile) {
    const err: any = new Error(
      "No staff profile found"
    );
    err.status = 403;
    throw err;
  }

  const hasDirectPermission =
    (staffProfile as any)[permissionField] === true;
  const editField = permissionField.endsWith("ViewAccess")
    ? permissionField.replace("ViewAccess", "EditAccess")
    : "";
  const hasEditPermission =
    editField !== "" && (staffProfile as any)[editField] === true;

  if (!hasDirectPermission && !hasEditPermission) {
    const err: any = new Error(
      "Access denied"
    );
    err.status = 403;
    throw err;
  }

  return true;
}

/**
 * Shared module access checker.
 *
 * Rules:
 *   - Full access roles (developer / admin / manager / owner) → allowed
 *   - Explicit permission field === true                        → allowed
 *   - specialOpsAccess === true                                → allowed
 *   - SMT (isSmt / isIncharge) and allowSMT === true           → allowed
 *     (SMT is auto-granted on VIEW actions only; EDIT actions
 *      require an explicit permission field)
 */
async function checkModuleAccess(
  env: any,
  currentUser: CurrentUser,
  permissionField: string,
  allowSMT: boolean
) {
  if (hasFullAccess(currentUser)) return true;

  const profile = await getStaffProfile(
    env,
    currentUser.email
  );

  if (!profile) {
    const err: any = new Error("No staff profile found");
    err.status = 403;
    throw err;
  }

  if ((profile as any)[permissionField] === true) return true;
  if (permissionField.endsWith("ViewAccess")) {
    const editField = permissionField.replace("ViewAccess", "EditAccess");
    if ((profile as any)[editField] === true) return true;
  }
  if ((profile as any).specialOpsAccess === true) return true;
  if (permissionField === "opsBoardEditAccess" && profile.isSmt === true && String(profile.department || "").toLowerCase() === "ground operations") return true;
  if (allowSMT && isSMTProfile(profile)) return true;

  const err: any = new Error("Access denied");
  err.status = 403;
  throw err;
}

/* ===================================================
   RAMP SHEET
=================================================== */

export async function requireRampView(
  env: any,
  currentUser: CurrentUser
) {
  return checkModuleAccess(env, currentUser, "rampsheetViewAccess", true);
}

export async function requireRampEdit(
  env: any,
  currentUser: CurrentUser
) {
  return checkModuleAccess(env, currentUser, "rampsheetEditAccess", false);
}

/* ===================================================
   RWY LIGHTS
=================================================== */

export async function requireRWYView(
  env: any,
  currentUser: CurrentUser
) {
  // View → SMT allowed, explicit view access, special ops
  return checkModuleAccess(
    env,
    currentUser,
    "rwyLightViewAccess",
    true
  );
}

export async function requireRWYEdit(
  env: any,
  currentUser: CurrentUser
) {
  // Edit → SMT NOT auto-allowed, needs explicit edit access or special ops
  return checkModuleAccess(
    env,
    currentUser,
    "rwyLightEditAccess",
    false
  );
}

/* ===================================================
   BIRD COUNTS
=================================================== */

export async function requireBirdView(
  env: any,
  currentUser: CurrentUser
) {
  // View → SMT allowed, explicit view access, special ops
  return checkModuleAccess(
    env,
    currentUser,
    "birdCountViewAccess",
    true
  );
}

export async function requireBirdEdit(
  env: any,
  currentUser: CurrentUser
) {
  // Edit → SMT NOT auto-allowed, needs explicit edit access or special ops
  return checkModuleAccess(
    env,
    currentUser,
    "birdCountEditAccess",
    false
  );
}

/* ===================================================
   OPS BOARD
=================================================== */

export async function requireOpsBoardView(
  env: any,
  currentUser: CurrentUser
) {
  // View → SMT allowed, explicit view access, special ops
  return checkModuleAccess(
    env,
    currentUser,
    "opsBoardViewAccess",
    true
  );
}

export async function requireOpsBoardEdit(
  env: any,
  currentUser: CurrentUser
) {
  // Edit → SMT NOT auto-allowed, needs explicit edit access or special ops
  return checkModuleAccess(
    env,
    currentUser,
    "opsBoardEditAccess",
    false
  );
}

/* ===================================================
   FLIGHTS
=================================================== */

export async function requireFlightsView(
  env: any,
  currentUser: CurrentUser
) {
  return checkModuleAccess(env, currentUser, "flightsViewAccess", true);
}

export async function requireFlightsEdit(
  env: any,
  currentUser: CurrentUser
) {
  return checkModuleAccess(env, currentUser, "flightsEditAccess", false);
}

/* ===================================================
   ROSTER
=================================================== */

export async function requireRosterView(
  env: any,
  currentUser: CurrentUser
) {
  return checkModuleAccess(env, currentUser, "rosterViewAccess", true);
}

export async function requireRosterEdit(
  env: any,
  currentUser: CurrentUser
) {
  return requirePermission(
    env,
    currentUser,
    "rosterEditAccess"
  );
}

/* ===================================================
   LEAVE
=================================================== */

export async function requireLeaveView(
  env: any,
  currentUser: CurrentUser
) {
  return checkModuleAccess(env, currentUser, "leaveViewAccess", true);
}

export async function requireLeaveEdit(
  env: any,
  currentUser: CurrentUser
) {
  return requirePermission(
    env,
    currentUser,
    "leaveEditAccess"
  );
}

/* ===================================================
   OVERTIME
=================================================== */

export async function requireOvertimeView(
  env: any,
  currentUser: CurrentUser
) {
  return checkModuleAccess(env, currentUser, "overtimeViewAccess", true);
}

export async function requireOvertimeEdit(
  env: any,
  currentUser: CurrentUser
) {
  return requirePermission(
    env,
    currentUser,
    "overtimeEditAccess"
  );
}

/* ===================================================
   REPORTS
=================================================== */

export async function requireReportsView(
  env: any,
  currentUser: CurrentUser
) {
  return checkModuleAccess(env, currentUser, "reportsViewAccess", true);
}

export async function requireReportsEdit(
  env: any,
  currentUser: CurrentUser
) {
  return requirePermission(
    env,
    currentUser,
    "reportsEditAccess"
  );
}

/* ===================================================
   STAFF
=================================================== */

export async function requireStaffView(
  env: any,
  currentUser: CurrentUser
) {
  return requirePermission(
    env,
    currentUser,
    "staffViewAccess"
  );
}

export async function requireStaffEdit(
  env: any,
  currentUser: CurrentUser
) {
  return requirePermission(
    env,
    currentUser,
    "staffEditAccess"
  );
}

/* ===================================================
   SETTINGS
=================================================== */

export async function requireSettingsView(
  env: any,
  currentUser: CurrentUser
) {
  return requirePermission(
    env,
    currentUser,
    "settingsViewAccess"
  );
}

export async function requireSettingsEdit(
  env: any,
  currentUser: CurrentUser
) {
  return requirePermission(
    env,
    currentUser,
    "settingsEditAccess"
  );
}

/* ===================================================
   APPROVALS
=================================================== */

export function requireSMTApproval(
  currentUser: CurrentUser
) {
  if (
    hasFullAccess(currentUser) ||
    currentUser.role === "smt"
  ) {
    return true;
  }

  const err: any = new Error(
    "SMT approval permission required"
  );

  err.status = 403;

  throw err;
}

/**
 * Shared approval check:
 *   - Developer / Admin / Manager / Owner → all departments
 *   - SMT / Incharge (staff row isSmt / isIncharge) → own department only
 *   - Anyone else                                → denied
 */
async function requireDepartmentApproval(
  env: any,
  approverEmail: string,
  targetEmail: string
) {
  const db = getDb(env);

  // 1) Approver role from users table
  const approverUserRows = await db
    .select()
    .from(users)
    .where(eq(users.email, approverEmail.toLowerCase()))
    .limit(1);
  const approverUser = approverUserRows[0];
  const role = (approverUser?.role || "").toLowerCase();

  if (["developer", "admin", "manager", "owner"].includes(role)) {
    return true;
  }

  // 2) Approver staff row
  const approverStaffRows = await db
    .select()
    .from(staff)
    .where(eq(staff.email, approverEmail.toLowerCase()))
    .limit(1);
  const approverStaff = approverStaffRows[0];

  const isSMTRole = role === "smt";
  const isSMTFlag = isSMTProfile(approverStaff);

  if (!isSMTRole && !isSMTFlag) {
    const err: any = new Error(
      "Approval permission required"
    );
    err.status = 403;
    throw err;
  }

  if (!approverStaff) {
    const err: any = new Error(
      "Approver staff profile not found"
    );
    err.status = 403;
    throw err;
  }

  // 3) Target staff row
  const targetStaffRows = await db
    .select()
    .from(staff)
    .where(eq(staff.email, targetEmail.toLowerCase()))
    .limit(1);
  const targetStaff = targetStaffRows[0];

  if (!targetStaff) {
    const err: any = new Error(
      "Target staff profile not found"
    );
    err.status = 403;
    throw err;
  }

  // 4) SMT → ONLY own department
  if (
    approverStaff.department &&
    targetStaff.department &&
    approverStaff.department === targetStaff.department
  ) {
    return true;
  }

  const err: any = new Error(
    "SMT can only approve requests within their own department"
  );
  err.status = 403;
  throw err;
}

/**
 * Leave approval — enforces own-department rule for SMT.
 */
export async function requireLeaveApproval(
  env: any,
  approverEmail: string,
  targetEmail: string
) {
  return requireDepartmentApproval(
    env,
    approverEmail,
    targetEmail
  );
}

/**
 * Overtime approval — enforces own-department rule for SMT.
 */
export async function requireOTApproval(
  env: any,
  approverEmail: string,
  targetEmail: string
) {
  return requireDepartmentApproval(
    env,
    approverEmail,
    targetEmail
  );
}