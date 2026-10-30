export function requireManager(role?: string) {

  const allowed = [
    "developer",
    "manager",
    "admin"
    "smt"
  ];

  if (!allowed.includes(role || "")) {
    throw new Error("Forbidden");
  }
}

export function requireSMT(role?: string) {

  const allowed = [
    "developer",
    "manager",
    "admin",
    "smt"
  ];

  if (!allowed.includes(role || "")) {
    throw new Error("Forbidden");
  }
}

export function requireDeveloper(role?: string) {

  if (role !== "developer") {
    throw new Error("Forbidden");
  }
}