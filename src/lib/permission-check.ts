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

  const hasPermission =
    (staffProfile as any)[permissionField] === true;

  if (!hasPermission) {
    const err: any = new Error(
      "Access denied"
    );
    err.status = 403;
    throw err;
  }

  return true;
}

/* ===================================================
   RAMP SHEET
=================================================== */

export async function requireRampView(
  env: any,
  currentUser: CurrentUser
) {
  return requirePermission(
    env,
    currentUser,
    "rampsheetViewAccess"
  );
}

export async function requireRampEdit(
  env: any,
  currentUser: CurrentUser
) {
  return requirePermission(
    env,
    currentUser,
    "rampsheetEditAccess"
  );
}

/* ===================================================
   RWY LIGHTS
=================================================== */

export async function requireRWYView(
  env: any,
  currentUser: CurrentUser
) {
  return requirePermission(
    env,
    currentUser,
    "rwyLightViewAccess"
  );
}

export async function requireRWYEdit(
  env: any,
  currentUser: CurrentUser
) {
  return requirePermission(
    env,
    currentUser,
    "rwyLightEditAccess"
  );
}

/* ===================================================
   BIRD COUNTS
=================================================== */

export async function requireBirdView(
  env: any,
  currentUser: CurrentUser
) {
  return requirePermission(
    env,
    currentUser,
    "birdCountViewAccess"
  );
}

export async function requireBirdEdit(
  env: any,
  currentUser: CurrentUser
) {
  return requirePermission(
    env,
    currentUser,
    "birdCountEditAccess"
  );
}

/* ===================================================
   OPS BOARD
=================================================== */

export async function requireOpsBoardView(
  env: any,
  currentUser: CurrentUser
) {
  return requirePermission(
    env,
    currentUser,
    "opsBoardViewAccess"
  );
}

export async function requireOpsBoardEdit(
  env: any,
  currentUser: CurrentUser
) {
  return requirePermission(
    env,
    currentUser,
    "opsBoardEditAccess"
  );
}

/* ===================================================
   FLIGHTS
=================================================== */

export async function requireFlightsView(
  env: any,
  currentUser: CurrentUser
) {
  return requirePermission(
    env,
    currentUser,
    "flightsViewAccess"
  );
}

export async function requireFlightsEdit(
  env: any,
  currentUser: CurrentUser
) {
  return requirePermission(
    env,
    currentUser,
    "flightsEditAccess"
  );
}

/* ===================================================
   ROSTER
=================================================== */

export async function requireRosterView(
  env: any,
  currentUser: CurrentUser
) {
  return requirePermission(
    env,
    currentUser,
    "rosterViewAccess"
  );
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
  return requirePermission(
    env,
    currentUser,
    "leaveViewAccess"
  );
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
  return requirePermission(
    env,
    currentUser,
    "overtimeViewAccess"
  );
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
  return requirePermission(
    env,
    currentUser,
    "reportsViewAccess"
  );
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