/**
 * Phase 6: bounded, UTC-based leave validation and read-only roster integrity checks.
 * No database writes happen in this module.
 */
export const MAX_LEAVE_SPAN_DAYS = 366;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MS_DAY = 86_400_000;

function utcDate(value: string): number {
  if (!ISO.test(value)) throw new Error('Dates must use YYYY-MM-DD format.');
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid calendar date: ${value}`);
  }
  return ms;
}

export function leaveDateRange(start: string, end: string, maxDays = MAX_LEAVE_SPAN_DAYS): string[] {
  const first = utcDate(start);
  const last = utcDate(end);
  if (last < first) throw new Error('Leave end date cannot be before its start date.');
  const length = Math.round((last - first) / MS_DAY) + 1;
  if (length > maxDays) throw new Error(`A single leave period cannot exceed ${maxDays} calendar days.`);
  return Array.from({ length }, (_, i) => new Date(first + i * MS_DAY).toISOString().slice(0, 10));
}

export function countLeaveDays(leaveType: string, dates: string[], holidayDates: Iterable<string> = []): number {
  if (leaveType !== 'ANNUAL LEAVE') return dates.length;
  const holidays = new Set(holidayDates);
  return dates.filter(date => new Date(`${date}T00:00:00.000Z`).getUTCDay() !== 5 && !holidays.has(date)).length;
}

/** Reject a leave approval if another request already owns the day's roster. */
export function approvalRosterConflict(rows: Array<{ leaveRequestId?: string | null }>, requestId: string): string | null {
  if (rows.length > 1) return 'Multiple roster entries exist for this staff member/date.';
  if (rows.some(row => row.leaveRequestId && row.leaveRequestId !== requestId)) {
    return 'Another approved leave already owns this roster assignment.';
  }
  if (rows.some(row => row.leaveRequestId === requestId)) {
    return 'This pending leave already has a linked roster assignment. Review its history before approval.';
  }
  return null;
}

type RequestLike = {
  id?: string | null;
  staffId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  leaveType?: string | null;
  status?: string | null;
  days?: number | null;
};
type RosterLike = {
  id?: string | null;
  staffId?: string | null;
  staffName?: string | null;
  date?: string | null;
  status?: string | null;
  leaveRequestId?: string | null;
  previousStatus?: string | null;
  previousShiftTime?: string | null;
};
type StaffLike = { id?: string | null; sn?: string | null; name?: string | null };

export function overlappingLeaveRequest(
  existing: RequestLike[], staffId: string, start: string, end: string, excludedId?: string
): RequestLike | undefined {
  return existing.find(row =>
    row.id !== excludedId && row.staffId === staffId &&
    !['rejected', 'cancelled', 'canceled'].includes(String(row.status || '').toLowerCase()) &&
    !!row.startDate && !!row.endDate && row.startDate <= end && row.endDate >= start
  );
}

export type LeaveIntegrityIssue = {
  kind: 'duplicate_roster' | 'orphaned_roster_leave' | 'leave_link_mismatch' |
    'missing_restore_snapshot' | 'approved_leave_missing_roster' | 'leave_day_count_mismatch' |
    'overlapping_approved_leave' | 'invalid_leave_dates';
  staffName: string;
  staffSn: string;
  staffId: string;
  date: string;
  detail: string;
};

export function auditLeaveRosterIntegrity(
  leaveRows: RequestLike[], rosterRows: RosterLike[], holidays: Iterable<string>,
  staffRows: StaffLike[] = []
): { scanned: { leaves: number; roster: number }; counts: Record<string, number>; totalIssues: number; issues: LeaveIntegrityIssue[] } {
  const issues: LeaveIntegrityIssue[] = [];
  const leaveById = new Map(leaveRows.filter(l => !!l.id).map(l => [l.id!, l]));
  const staffById = new Map(staffRows.filter(s => !!s.id).map(s => [s.id!, s]));
  const rosterByStaffDate = new Map<string, RosterLike[]>();
  const recordedLeaveDates = new Map<string, Set<string>>();
  const record = (kind: LeaveIntegrityIssue['kind'], staffId: string, date: string, detail: string) => {
    const s = staffById.get(staffId);
    issues.push({ kind, staffId, staffName: String(s?.name || 'Unknown employee'),
      staffSn: String(s?.sn || 'SN missing'), date, detail });
  };

  for (const r of rosterRows) {
    const staffId = String(r.staffId || '');
    const date = String(r.date || '');
    if (!staffId || !date) continue;
    const key = JSON.stringify([staffId, date]);
    const bucket = rosterByStaffDate.get(key) || [];
    bucket.push(r);
    rosterByStaffDate.set(key, bucket);
    if (!r.leaveRequestId) continue;
    const leave = leaveById.get(r.leaveRequestId);
    if (!leave) {
      record('orphaned_roster_leave', staffId, date, `Roster ${r.id || '?'} refers to a missing leave request.`);
      continue;
    }
    if (leave.staffId !== staffId || date < String(leave.startDate || '') || date > String(leave.endDate || '') ||
        r.status !== leave.leaveType || String(leave.status || '').toLowerCase() !== 'approved') {
      record('leave_link_mismatch', staffId, date, `Roster ${r.id || '?'} does not match its linked approved leave ${leave.id || '?'}.`);
    }
    if (r.previousStatus == null) {
      record('missing_restore_snapshot', staffId, date, `Leave ${leave.id || '?'} has no original shift/OFF backup; confirm before deletion.`);
    }
    if (!recordedLeaveDates.has(leave.id!)) recordedLeaveDates.set(leave.id!, new Set());
    recordedLeaveDates.get(leave.id!)!.add(date);
  }
  for (const [key, rows] of rosterByStaffDate) {
    if (rows.length > 1) {
      const [staffId, date] = JSON.parse(key) as [string, string];
      record('duplicate_roster', staffId, date, `${rows.length} roster entries exist for the same staff ID and date.`);
    }
  }

  const approvedByStaff = new Map<string, RequestLike[]>();
  const holidaySet = new Set(holidays);
  for (const leave of leaveRows) {
    if (String(leave.status || '').toLowerCase() !== 'approved') continue;
    const staffId = String(leave.staffId || '');
    const start = String(leave.startDate || '');
    const end = String(leave.endDate || '');
    if (!staffId) continue;
    let dates: string[];
    try { dates = leaveDateRange(start, end); }
    catch {
      record('invalid_leave_dates', staffId, start, `Approved leave ${leave.id || '?'} has invalid or overlong dates.`);
      continue;
    }
    const expectedDays = countLeaveDays(String(leave.leaveType || ''), dates, holidaySet);
    if (leave.days !== expectedDays) {
      record('leave_day_count_mismatch', staffId, start, `Leave ${leave.id || '?'} shows ${leave.days ?? 'no'} days; current holiday calendar calculates ${expectedDays}. Review before changing historical balances.`);
    }
    const linked = recordedLeaveDates.get(String(leave.id || '')) || new Set();
    const missing = dates.filter(date => !linked.has(date));
    if (missing.length) {
      record('approved_leave_missing_roster', staffId, missing[0], `Approved leave ${leave.id || '?'} is missing roster links for ${missing.length} date(s) (first ${missing[0]}).`);
    }
    if (!approvedByStaff.has(staffId)) approvedByStaff.set(staffId, []);
    approvedByStaff.get(staffId)!.push(leave);
  }
  for (const [staffId, rows] of approvedByStaff) {
    const sorted = [...rows].sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
    let farthestEnd = '';
    let farthestId = '';
    for (const row of sorted) {
      if (row.startDate && row.startDate <= farthestEnd) {
        record('overlapping_approved_leave', staffId, row.startDate, `Approved leave ${row.id || '?'} overlaps with approved leave ${farthestId}.`);
      }
      if (String(row.endDate || '') > farthestEnd) {
        farthestEnd = String(row.endDate);
        farthestId = String(row.id || '');
      }
    }
  }
  const counts: Record<string, number> = {};
  for (const issue of issues) counts[issue.kind] = (counts[issue.kind] || 0) + 1;
  return { scanned: { leaves: leaveRows.length, roster: rosterRows.length },
    counts, totalIssues: issues.length, issues: issues.slice(0, 200) };
}
