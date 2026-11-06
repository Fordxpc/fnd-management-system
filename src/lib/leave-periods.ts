/**
 * Read-only presentation groups for consecutive, already-approved leave.
 * Never changes a request id, roster link, approval, leave balance or database row.
 */
export const ROSTER_ORIGIN = 'Entered from Duty Roster';

export interface LeavePeriodRecord {
  id: string;
  staffId?: string | null;
  staffSN?: string | null;
  staffSn?: string | null;
  leaveType?: string | null;
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  requestedAt?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  reason?: string | null;
  days?: number | null;
}

export interface LeavePeriod<T extends LeavePeriodRecord> {
  id: string;
  startDate: string;
  endDate: string;
  days: number;
  records: T[];
  hasDifferentRecordedAccounts: boolean;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isISODate = (value: string) => {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const utcDay = (value: string) => new Date(`${value}T00:00:00Z`).getTime();
const timestamp = (value?: string | null): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const canonicalSN = (value?: string | null) => String(value || '').trim().toUpperCase();
const norm = (value?: string | null) => String(value || '').trim().toLowerCase();

const sameVerifiedEmployee = (a: LeavePeriodRecord, b: LeavePeriodRecord) => {
  const aSN = canonicalSN(a.staffSN || a.staffSn);
  const bSN = canonicalSN(b.staffSN || b.staffSn);
  if (aSN && bSN) return aSN === bSN;
  return !!a.staffId && !!b.staffId && a.staffId === b.staffId;
};
const sameApprovalContext = (a: LeavePeriodRecord, b: LeavePeriodRecord) => {
  if (norm(a.reviewedBy) === norm(b.reviewedBy)) return true;
  // A roster entry may have been *recorded* under a different signed-in account.
  // That account is not necessarily the person who authorized the leave.
  // Preserve the differing audit accounts rather than treating them as one actor.
  return a.reason === ROSTER_ORIGIN || b.reason === ROSTER_ORIGIN;
};
const decisionTime = (record: LeavePeriodRecord) => timestamp(record.reviewedAt) ?? timestamp(record.requestedAt);
const dateCount = (start: string, end: string, leaveType: string, holidayDates: Set<string>) => {
  let days = 0;
  for (let value = utcDay(start); value <= utcDay(end); value += 86400000) {
    const date = new Date(value).toISOString().slice(0, 10);
    const isAnnual = leaveType.toUpperCase() === 'ANNUAL LEAVE';
    if (!isAnnual || (new Date(value).getUTCDay() !== 5 && !holidayDates.has(date))) days++;
  }
  return days;
};

/**
 * A nearby approval window is 48 hours from the FIRST record's decision time.
 * Requests with absent/unparseable decision timestamps are never merged.
 * Only exact leave types, approved status, and verified staff IDs/SNs are merged.
 */
export function displayLeavePeriods<T extends LeavePeriodRecord>(
  records: readonly T[], holidayDates: Iterable<string> = [], approvalWindowHours = 48
): LeavePeriod<T>[] {
  const holidaySet = new Set(holidayDates);
  const ordered = [...records].sort((a, b) =>
    String(a.startDate || '').localeCompare(String(b.startDate || '')) ||
    String(a.endDate || '').localeCompare(String(b.endDate || '')) || a.id.localeCompare(b.id)
  );
  const groups: LeavePeriod<T>[] = [];
  for (const record of ordered) {
    const start = String(record.startDate || '');
    const end = String(record.endDate || '');
    const isEligible = norm(record.status) === 'approved' && isISODate(start) && isISODate(end) &&
      start <= end && !!decisionTime(record) && !!record.leaveType;
    const anchor = decisionTime(record);
    let chosen: LeavePeriod<T> | undefined;
    if (isEligible) {
      chosen = groups.find(group => {
        const first = group.records[0];
        const firstTime = decisionTime(first);
        return group.records.every(r => norm(r.status) === 'approved') &&
          norm(first.leaveType) === norm(record.leaveType) &&
          sameVerifiedEmployee(first, record) &&
          sameApprovalContext(first, record) &&
          firstTime !== null && anchor !== null &&
          Math.abs(anchor - firstTime) <= approvalWindowHours * 3600000 &&
          utcDay(start) <= utcDay(group.endDate) + 86400000 &&
          utcDay(end) >= utcDay(group.startDate) - 86400000;
      });
    }
    if (chosen) {
      chosen.records.push(record);
      if (start < chosen.startDate) chosen.startDate = start;
      if (end > chosen.endDate) chosen.endDate = end;
      chosen.days = dateCount(chosen.startDate, chosen.endDate, String(record.leaveType), holidaySet);
    } else {
      groups.push({
        id: record.id,
        startDate: start,
        endDate: end,
        days: Number(record.days ?? 0),
        records: [record],
        hasDifferentRecordedAccounts: false,
      });
    }
  }
  for (const group of groups) {
    group.records.sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)) || a.id.localeCompare(b.id));
    group.hasDifferentRecordedAccounts = new Set(group.records.map(r => norm(r.reviewedBy)).filter(Boolean)).size > 1;
  }
  return groups.sort((a, b) => b.startDate.localeCompare(a.startDate) || b.endDate.localeCompare(a.endDate));
}
