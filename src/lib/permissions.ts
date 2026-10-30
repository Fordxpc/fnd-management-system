export function isDeveloper(user: any) {
  return user?.role === "developer";
}

export function isManager(user: any) {
  return ["developer", "manager", "admin"].includes(user?.role);
}

export function canEditRamp(user: any, staff: any) {
  return (
    isManager(user) ||
    staff?.rampsheetEditAccess === true
  );
}

export function canEditBirdCount(user: any, staff: any) {
  return (
    isManager(user) ||
    staff?.birdCountEditAccess === true
  );
}

export function canEditRunwayLights(user: any, staff: any) {
  return (
    isManager(user) ||
    staff?.rwyLightEditAccess === true
  );
}

export function canAccessOpsBoard(user: any, staff: any) {
  return (
    isManager(user) ||
    staff?.opsBoardAccess === true
  );
}
export const ROLE_LEVEL = {
  staff: 1,
  smt: 2,
  admin: 3,
  manager: 4,
  developer: 5,
};

export function canManageUsers(role?: string) {
  return ["developer", "manager", "admin"].includes(role || "");
}

export function canManageAccess(role?: string) {
  return ["developer", "manager", "admin"].includes(role || "");
}

export function canApproveLeave(role?: string) {
  return ["developer", "manager", "admin", "smt"].includes(role || "");
}