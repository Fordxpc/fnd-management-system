import { getDb } from "../../src/lib/db.js";
import { staff } from "../../src/db/schema.js";
import { eq } from "drizzle-orm";

export async function getStaffByEmail(
  env: any,
  email: string
) {
  const db = getDb(env);

  const rows = await db
    .select()
    .from(staff)
    .where(eq(staff.email, email.toLowerCase()))
    .limit(1);

  return rows[0] || null;
}

export function isManagerRole(role?: string) {
  return [
    "developer",
    "manager",
    "admin",
    "owner"
  ].includes((role || "").toLowerCase());
}

export function canApproveLeave(
  approver: any,
  target: any
): boolean {

  if (!approver || !target) {
    return false;
  }

  if (isManagerRole(approver.role)) {
    return true;
  }

  if (
    approver.department !== target.department
  ) {
    return false;
  }

  if (approver.isIncharge === true) {
    return true;
  }

  if (
    approver.isSmt === true &&
    target.isSmt !== true &&
    target.isIncharge !== true
  ) {
    return true;
  }

  return false;
}

export function canApproveOvertime(
  approver: any,
  target: any
) {
  return canApproveLeave(
    approver,
    target
  );
}

export async function requireLeaveApproval(
  env: any,
  approverEmail: string,
  targetEmail: string
) {

  const approver = await getStaffByEmail(
    env,
    approverEmail
  );

  const target = await getStaffByEmail(
    env,
    targetEmail
  );

  if (
    !canApproveLeave(
      approver,
      target
    )
  ) {
    const err: any = new Error(
      "Leave approval permission denied"
    );

    err.status = 403;

    throw err;
  }

  return true;
}

export async function requireOTApproval(
  env: any,
  approverEmail: string,
  targetEmail: string
) {

  const approver = await getStaffByEmail(
    env,
    approverEmail
  );

  const target = await getStaffByEmail(
    env,
    targetEmail
  );

  if (
    !canApproveOvertime(
      approver,
      target
    )
  ) {
    const err: any = new Error(
      "Overtime approval permission denied"
    );

    err.status = 403;

    throw err;
  }

  return true;
}