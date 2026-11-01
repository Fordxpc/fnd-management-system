export function requireManager(role: string) {
  if (!["developer", "manager", "admin", "owner"].includes(role)) {
    const err: any = new Error("Forbidden: Manager access required");
    err.status = 403;
    throw err;
  }
}

export function requireSMT(role: string) {
  if (!["developer", "manager", "admin", "owner", "smt"].includes(role)) {
    const err: any = new Error("Forbidden: SMT access required");
    err.status = 403;
    throw err;
  }
}