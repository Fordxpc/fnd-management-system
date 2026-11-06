export type NotificationApprover = {
  email?: string | null;
  role?: string | null;
  department?: string | null;
  isSmt?: boolean | null;
  isIncharge?: boolean | null;
};

const normalized = (value: unknown) => String(value || '').trim().toLowerCase();

/** Match the server's full-access / own-department approval rule. */
export function canReceiveRequestNotification(
  account: NotificationApprover,
  target: { email?: string | null; department?: string | null },
  requesterEmail: string,
): boolean {
  const email = normalized(account.email);
  const targetEmail = normalized(target.email);
  const department = normalized(target.department);
  if (!email || email === targetEmail || email === normalized(requesterEmail)) return false;
  const role = normalized(account.role);
  if (['developer', 'admin', 'manager', 'owner'].includes(role)) return true;
  return Boolean(department && normalized(account.department) === department &&
    (role === 'smt' || account.isSmt === true || account.isIncharge === true));
}

export const readableNotificationTarget = (value: unknown) =>
  ['leave', 'overtime', 'settings', 'notifications', 'resignations'].includes(String(value)) ? String(value) : 'notifications';
