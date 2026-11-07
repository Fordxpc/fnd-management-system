/**
 * FND overtime eligibility (reporting only; never changes OT approval records).
 * Payroll periods run from the 16th of the prior calendar month to the 15th.
 * Duty weeks run Saturday to Friday, including when crossing a payroll boundary.
 * UTC date-only arithmetic avoids browser timezone/DST discrepancies.
 */
export type OTPolicy = {
  regularHours: number;
  adminHours: number;
  deductLeaves: string[];
  leaveDayHours: number;
  frlFinalDays: number;
};
export const DEFAULT_OT_POLICY: OTPolicy = {
  regularHours: 48,
  adminHours: 40,
  deductLeaves: ['SICK LEAVE', 'SICK LEAVE / MC'],
  leaveDayHours: 8,
  frlFinalDays: 6,
};
export type OTRecord = {
  id: string;
  staffId: string | null;
  date: string | null;
  hours: number | null;
  status: string | null;
};
export type RosterRecord = {
  staffId: string | null;
  date: string | null;
  status: string | null;
  shiftTime?: string | null;
};
export type LeaveRecord = {
  staffId: string | null;
  status: string | null;
  leaveType: string | null;
  startDate: string | null;
  endDate: string | null;
};
export type OTWeekResult = {
  weekStart: string;
  weekEnd: string;
  requiredDutyHours: number;
  rosterDutyHours: number;
  creditedLeaveHours: number;
  excludedLeaveHours: number;
  dutyHours: number;
  shortfallHours: number;
  approvedOtHours: number;
  pendingOtHours: number;
  eligibleOtHours: number;
  ineligibleOtHours: number;
  excludedLeaveDates: string[];
  incompleteRoster: boolean;
  allocations: { id: string; date: string; approvedHours: number; eligibleHours: number; ineligibleHours: number }[];
};

const isDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
const dateUTC = (value: string): Date => new Date(`${value}T00:00:00Z`);
const iso = (value: Date): string => value.toISOString().slice(0, 10);
export function offsetDate(day: string, offset: number): string {
  const date = dateUTC(day);
  date.setUTCDate(date.getUTCDate() + offset);
  return iso(date);
}
export function otWeekStart(date: string): string {
  const day = dateUTC(date).getUTCDay();
  return offsetDate(date, -((day + 1) % 7)); // Saturday
}
export function otPeriod(month: string): { from: string; to: string } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid payroll period');
  const [year, mm] = month.split('-').map(Number);
  const previous = new Date(Date.UTC(year, mm - 2, 16));
  return { from: iso(previous), to: `${month}-15` };
}
export function normalizeLeaveType(input: string | null | undefined): string {
  const value = String(input || '').trim().replace(/\s+/g, ' ').toUpperCase();
  if (value === 'SL') return 'SICK LEAVE';
  if (value === 'MC' || value === 'SLMC' || value === 'SICK LEAVE/MC') return 'SICK LEAVE / MC';
  if (value === 'FRL') return 'FAMILY RESPONSIBILITY LEAVE (FRL)';
  return value;
}
export function shiftDuration(shift: string | null | undefined): number | null {
  const match = String(shift || '').match(/(?:^|\s)(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})(?:\s|$)/);
  if (!match) return null;
  const [startHour, startMin, endHour, endMin] = match.slice(1).map(Number);
  if (startHour > 23 || endHour > 23 || startMin > 59 || endMin > 59) return null;
  const start = startHour * 60 + startMin;
  const end = endHour * 60 + endMin;
  const minutes = (end - start + 1440) % 1440;
  return minutes ? Math.round(minutes / 60 * 100) / 100 : null;
}
const round = (hours: number): number => Math.round((hours + Number.EPSILON) * 100) / 100;
export function normalizeOtPolicy(raw: unknown): OTPolicy {
  const p = raw && typeof raw === 'object' ? raw as Partial<OTPolicy> : {};
  const numeric = (val: unknown, fallback: number, max: number) =>
    typeof val === 'number' && Number.isFinite(val) && val >= 0 && val <= max ? val : fallback;
  return {
    regularHours: numeric(p.regularHours, DEFAULT_OT_POLICY.regularHours, 84),
    adminHours: numeric(p.adminHours, DEFAULT_OT_POLICY.adminHours, 84),
    deductLeaves: Array.isArray(p.deductLeaves)
      ? [...new Set(p.deductLeaves.filter((t): t is string => typeof t === 'string').map(normalizeLeaveType))].slice(0, 24)
      : DEFAULT_OT_POLICY.deductLeaves,
    leaveDayHours: numeric(p.leaveDayHours, DEFAULT_OT_POLICY.leaveDayHours, 16),
    frlFinalDays: Math.trunc(numeric(p.frlFinalDays, DEFAULT_OT_POLICY.frlFinalDays, 365)),
  };
}
/** Each day counted once, even when two overlapping approved requests exist. */
export function calculateOTWeek(
  staffId: string,
  weekStart: string,
  weeklyHours: number,
  entries: OTRecord[],
  roster: RosterRecord[],
  leaves: LeaveRecord[],
  policy: OTPolicy,
): OTWeekResult {
  const weekEnd = offsetDate(weekStart, 6);
  const weekRoster = roster.filter(r => r.staffId === staffId && r.date && r.date >= weekStart && r.date <= weekEnd);
  const rosterByDay = new Map<string, RosterRecord>();
  for (const r of weekRoster) if (r.date && !rosterByDay.has(r.date)) rosterByDay.set(r.date, r);
  const rosterDutyHours = round([...rosterByDay.values()].reduce((sum, r) => sum + (String(r.status || '').toLowerCase() === 'scheduled' ? shiftDuration(r.shiftTime) || 0 : 0), 0));
  const applicableLeaves = leaves.filter(l => l.staffId === staffId && String(l.status || '').toLowerCase() === 'approved' &&
    l.startDate && l.endDate && isDate(l.startDate) && isDate(l.endDate) && l.startDate <= weekEnd && l.endDate >= weekStart);
  let creditedLeaveHours = 0;
  let excludedLeaveHours = 0;
  const excludedLeaveDates: string[] = [];
  const excluded = new Set(policy.deductLeaves.map(normalizeLeaveType));
  for (let i = 0; i < 7; i++) {
    const day = offsetDate(weekStart, i);
    const rosterDay = rosterByDay.get(day);
    // A worked shift already contributes its full duration. OFF is not eligible leave duty.
    if (String(rosterDay?.status || '').toLowerCase() === 'scheduled' || String(rosterDay?.status || '').toUpperCase() === 'OFF DAY') continue;
    const leave = applicableLeaves.find(l => l.startDate! <= day && l.endDate! >= day);
    if (!leave) continue;
    const type = normalizeLeaveType(leave.leaveType);
    let excludedDay = excluded.has(type);
    if (excludedDay && type === 'FAMILY RESPONSIBILITY LEAVE (FRL)') {
      const lastExcludedStart = offsetDate(leave.endDate!, -(policy.frlFinalDays - 1));
      excludedDay = policy.frlFinalDays > 0 && day >= lastExcludedStart;
    }
    if (excludedDay) {
      excludedLeaveDates.push(`${day}: ${type}`);
      excludedLeaveHours += policy.leaveDayHours;
    } else {
      creditedLeaveHours += policy.leaveDayHours;
    }
  }
  const dutyHours = round(rosterDutyHours + creditedLeaveHours);
  const shortfallHours = round(Math.max(0, weeklyHours - dutyHours));
  const sameWeek = entries.filter(e => e.staffId === staffId && e.date && e.date >= weekStart && e.date <= weekEnd);
  const approved = sameWeek.filter(e => String(e.status || '').toLowerCase() === 'approved');
  const pendingOtHours = round(sameWeek.filter(e => String(e.status || '').toLowerCase() === 'pending').reduce((sum, e) => sum + Math.max(0, Number(e.hours || 0)), 0));
  const approvedOtHours = round(approved.reduce((sum, e) => sum + Math.max(0, Number(e.hours || 0)), 0));
  const ineligibleOtHours = Math.min(approvedOtHours, shortfallHours);
  const eligibleOtHours = round(approvedOtHours - ineligibleOtHours);
  // Distribute the weekly shortfall proportionally among approved OT entries.
  // This avoids resetting the deduction at a 15th/16th payroll boundary.
  let allocatedIneligible = 0;
  let cumulativeApproved = 0;
  const allocations = approved.sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id.localeCompare(b.id)).map((entry, index, list) => {
    const approvedHours = round(Math.max(0, Number(entry.hours || 0)));
    cumulativeApproved = round(cumulativeApproved + approvedHours);
    const cumulativeDeduction = index === list.length - 1
      ? ineligibleOtHours
      : round(approvedOtHours ? ineligibleOtHours * cumulativeApproved / approvedOtHours : 0);
    const ineligibleHours = round(Math.min(approvedHours, Math.max(0, cumulativeDeduction - allocatedIneligible)));
    allocatedIneligible = round(allocatedIneligible + ineligibleHours);
    return { id: entry.id, date: entry.date!, approvedHours, ineligibleHours, eligibleHours: round(approvedHours - ineligibleHours) };
  });
  return {
    weekStart, weekEnd, requiredDutyHours: weeklyHours, rosterDutyHours, creditedLeaveHours,
    excludedLeaveHours: round(excludedLeaveHours), dutyHours, shortfallHours, approvedOtHours,
    pendingOtHours, eligibleOtHours, ineligibleOtHours: round(ineligibleOtHours), excludedLeaveDates,
    incompleteRoster: weekRoster.length === 0,
    allocations,
  };
}
export function calculateOTPeriod(
  month: string, staffId: string, weeklyHours: number,
  entries: OTRecord[], roster: RosterRecord[], leaves: LeaveRecord[], policy: OTPolicy,
  hourlyRateMvr: number | null = null,
) {
  const { from, to } = otPeriod(month);
  const otInPeriod = entries.filter(e => e.staffId === staffId && e.date && e.date >= from && e.date <= to);
  const starts = new Set(otInPeriod.map(e => otWeekStart(e.date!)));
  const weeks = [...starts].sort().map(start => calculateOTWeek(staffId, start, weeklyHours, entries, roster, leaves, policy));
  const allocations = weeks.flatMap(w => w.allocations).filter(e => e.date >= from && e.date <= to);
  const approvedHours = round(allocations.reduce((a, e) => a + e.approvedHours, 0));
  const eligibleHours = round(allocations.reduce((a, e) => a + e.eligibleHours, 0));
  const ineligibleHours = round(allocations.reduce((a, e) => a + e.ineligibleHours, 0));
  const pendingHours = round(otInPeriod.filter(e => String(e.status || '').toLowerCase() === 'pending').reduce((sum, e) => sum + Math.max(0, Number(e.hours || 0)), 0));
  const rate = hourlyRateMvr !== null && Number.isFinite(hourlyRateMvr) && hourlyRateMvr >= 0 ? hourlyRateMvr : null;
  return {
    period: month, from, to, staffId, weeks, approvedHours, eligibleHours, ineligibleHours, pendingHours,
    hourlyRateConfigured: rate !== null,
    estimatedEligibleIncomeMvr: rate === null ? null : round(eligibleHours * rate),
    estimatedApprovedIncomeMvr: rate === null ? null : round(approvedHours * rate),
  };
}
