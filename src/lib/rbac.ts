export const Roles = {
  STAFF: "staff",
  SMT: "smt",
  ADMIN: "admin",
  MANAGER: "manager",
  DEVELOPER: "developer",
} as const;

export function isDeveloper(role?: string) {
  return role === Roles.DEVELOPER;
}

export function isManager(role?: string) {
  return [
    Roles.DEVELOPER,
    Roles.MANAGER,
    Roles.ADMIN,
  ].includes(role as any);
}

export function isSMT(role?: string) {
  return role === Roles.SMT;
}

export function canManageUsers(role?: string) {
  return isManager(role);
}

export function canManageAccess(role?: string) {
  return isManager(role);
}

export function canApproveLeave(role?: string) {
  return (
    isManager(role) ||
    role === Roles.SMT
  );
}

export function canApproveOT(role?: string) {
  return (
    isManager(role) ||
    role === Roles.SMT
  );
}