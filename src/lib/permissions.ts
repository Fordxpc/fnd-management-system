// src/lib/permissions.ts

export interface UserProfile {
  role?: string;
}

export interface StaffRecord {
  isSmt?: boolean;
  isIncharge?: boolean;

  rampsheetViewAccess?: boolean;
  rampsheetEditAccess?: boolean;

  rwyLightViewAccess?: boolean;
  rwyLightEditAccess?: boolean;

  birdCountViewAccess?: boolean;
  birdCountEditAccess?: boolean;

  opsBoardViewAccess?: boolean;
  opsBoardEditAccess?: boolean;

  flightsViewAccess?: boolean;
  flightsEditAccess?: boolean;

  rosterViewAccess?: boolean;
  rosterEditAccess?: boolean;

  leaveViewAccess?: boolean;
  leaveEditAccess?: boolean;

  overtimeViewAccess?: boolean;
  overtimeEditAccess?: boolean;

  reportsViewAccess?: boolean;
  reportsEditAccess?: boolean;

  staffViewAccess?: boolean;
  staffEditAccess?: boolean;

  settingsViewAccess?: boolean;
  settingsEditAccess?: boolean;
}

function role(profile?: UserProfile): string {
  return (profile?.role || "").toLowerCase();
}

/**
 * Full system administrators.
 * Always allowed.
 */
export function hasFullAccess(profile?: UserProfile): boolean {
  return [
    "developer",
    "manager",
    "admin",
    "owner"
  ].includes(role(profile));
}

/**
 * SMT level users.
 */
export function isSMT(
  profile?: UserProfile,
  staff?: StaffRecord
): boolean {
  return (
    role(profile) === "smt" ||
    staff?.isSmt === true
  );
}

/* ========================================================
   RAMP SHEET
======================================================== */

export function canViewRamp(
  profile?: UserProfile,
  staff?: StaffRecord
): boolean {
  return (
    hasFullAccess(profile) ||
    staff?.rampsheetViewAccess === true ||
    staff?.rampsheetEditAccess === true
  );
}

export function canEditRamp(
  profile?: UserProfile,
  staff?: StaffRecord
): boolean {
  return (
    hasFullAccess(profile) ||
    staff?.rampsheetEditAccess === true
  );
}

/* ========================================================
   RWY LIGHTS
======================================================== */

export function canViewRWYLights(
  profile?: UserProfile,
  staff?: StaffRecord
): boolean {
  return (
    hasFullAccess(profile) ||
    staff?.rwyLightViewAccess === true ||
    staff?.rwyLightEditAccess === true
  );
}

export function canEditRWYLights(
  profile?: UserProfile,
  staff?: StaffRecord
): boolean {
  return (
    hasFullAccess(profile) ||
    staff?.rwyLightEditAccess === true
  );
}

/* ========================================================
   BIRD COUNTS
======================================================== */

export function canViewBirdCounts(
  profile?: UserProfile,
  staff?: StaffRecord
): boolean {
  return (
    hasFullAccess(profile) ||
    staff?.birdCountViewAccess === true ||
    staff?.birdCountEditAccess === true
  );
}

export function canEditBirdCounts(
  profile?: UserProfile,
  staff?: StaffRecord
): boolean {
  return (
    hasFullAccess(profile) ||
    staff?.birdCountEditAccess === true
  );
}

/* ========================================================
   OPS BOARD
======================================================== */

export function canViewOpsBoard(
  profile?: UserProfile,
  staff?: StaffRecord
): boolean {
  return (
    hasFullAccess(profile) ||
    staff?.opsBoardViewAccess === true ||
    staff?.opsBoardEditAccess === true
  );
}

export function canEditOpsBoard(
  profile?: UserProfile,
  staff?: StaffRecord
): boolean {
  return (
    hasFullAccess(profile) ||
    staff?.opsBoardEditAccess === true
  );
}

/* ========================================================
   FLIGHTS
======================================================== */

export function canViewFlights(
  profile?: UserProfile,
  staff?: StaffRecord
): boolean {
  return (
    hasFullAccess(profile) ||
    staff?.flightsViewAccess === true ||
    staff?.flightsEditAccess === true
  );
}

export function canEditFlights(
  profile?: UserProfile,
  staff?: StaffRecord
): boolean {
  return (
    hasFullAccess(profile) ||
    staff?.flightsEditAccess === true
  );
}

/* ========================================================
   ROSTER
======================================================== */

export function canViewRoster(
  profile?: UserProfile,
  staff?: StaffRecord
): boolean {
  return (
    hasFullAccess(profile) ||
    isSMT(profile, staff) ||
    staff?.rosterViewAccess === true ||
    staff?.rosterEditAccess === true
  );
}

export function canEditRoster(
  profile?: UserProfile,
  staff?: StaffRecord
): boolean {
  return (
    hasFullAccess(profile) ||
    staff?.rosterEditAccess === true ||
    staff?.isIncharge === true
  );
}

/* ========================================================
   LEAVE
======================================================== */

export function canViewLeave(
  profile?: UserProfile,
  staff?: StaffRecord
): boolean {
  return (
    hasFullAccess(profile) ||
    isSMT(profile, staff) ||
    staff?.leaveViewAccess === true ||
    staff?.leaveEditAccess === true
  );
}

export function canEditLeave(
  profile?: UserProfile,
  staff?: StaffRecord
): boolean {
  return (
    hasFullAccess(profile) ||
    isSMT(profile, staff) ||
    staff?.leaveEditAccess === true
  );
}

/* ========================================================
   OVERTIME
======================================================== */

export function canViewOvertime(
  profile?: UserProfile,
  staff?: StaffRecord
): boolean {
  return (
    hasFullAccess(profile) ||
    isSMT(profile, staff) ||
    staff?.overtimeViewAccess === true ||
    staff?.overtimeEditAccess === true
  );
}

export function canEditOvertime(
  profile?: UserProfile,
  staff?: StaffRecord
): boolean {
  return (
    hasFullAccess(profile) ||
    isSMT(profile, staff) ||
    staff?.overtimeEditAccess === true
  );
}

/* ========================================================
   REPORTS
======================================================== */

export function canViewReports(
  profile?: UserProfile,
  staff?: StaffRecord
): boolean {
  return (
    hasFullAccess(profile) ||
    staff?.reportsViewAccess === true ||
    staff?.reportsEditAccess === true
  );
}

export function canEditReports(
  profile?: UserProfile,
  staff?: StaffRecord
): boolean {
  return (
    hasFullAccess(profile) ||
    staff?.reportsEditAccess === true
  );
}

/* ========================================================
   STAFF
======================================================== */

export function canViewStaff(
  profile?: UserProfile,
  staff?: StaffRecord
): boolean {
  return (
    hasFullAccess(profile) ||
    staff?.staffViewAccess === true ||
    staff?.staffEditAccess === true
  );
}

export function canEditStaff(
  profile?: UserProfile,
  staff?: StaffRecord
): boolean {
  return (
    hasFullAccess(profile) ||
    staff?.staffEditAccess === true
  );
}

/* ========================================================
   SETTINGS
======================================================== */

export function canViewSettings(
  profile?: UserProfile,
  staff?: StaffRecord
): boolean {
  return (
    hasFullAccess(profile) ||
    staff?.settingsViewAccess === true ||
    staff?.settingsEditAccess === true
  );
}

export function canEditSettings(
  profile?: UserProfile,
  staff?: StaffRecord
): boolean {
  return (
    hasFullAccess(profile) ||
    staff?.settingsEditAccess === true
  );
}

/* ========================================================
   APPROVALS
======================================================== */

export function canApproveLeave(
  profile?: UserProfile,
  staff?: StaffRecord
): boolean {
  return (
    hasFullAccess(profile) ||
    isSMT(profile, staff)
  );
}

export function canApproveOvertime(
  profile?: UserProfile,
  staff?: StaffRecord
): boolean {
  return (
    hasFullAccess(profile) ||
    isSMT(profile, staff)
  );
}

/* ========================================================
   DASHBOARD
======================================================== */

export function canViewManagementDashboard(
  profile?: UserProfile,
  staff?: StaffRecord
): boolean {
  return (
    hasFullAccess(profile) ||
    isSMT(profile, staff)
  );
}