/**
 * Plans safe consolidation of leave history created automatically by the roster.
 * This module does not write to the database. Manual requests are never candidates.
 */
export const ROSTER_LEAVE_REASON = 'Entered from Duty Roster';

export type GeneratedLeaveRow = {
  id: string;
  staffId: string | null;
  leaveType: string | null;
  startDate: string | null;
  endDate: string | null;
  days: number | null;
  status: string | null;
  reason: string | null;
  requestedAt?: string | null;
};

export type LinkedRosterDay = {
  staffId: string | null;
  date: string | null;
  status: string | null;
  leaveRequestId: string | null;
};

export type LeaveConsolidation = {
  keepId: string;
  removeIds: string[];
  startDate: string;
  endDate: string;
  days: number;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const validDay = (date: string): boolean => {
  if (!ISO_DATE.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
};
const nextDay = (date: string): string => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
};

export function planRosterLeaveConsolidation(
  requests: GeneratedLeaveRow[],
  roster: LinkedRosterDay[],
  holidayDates: Iterable<string> = []
): LeaveConsolidation[] {
  const holidays = new Set(holidayDates);
  const generated = new Map(
    requests.filter(row => row.id && row.staffId && row.leaveType &&
      String(row.status || '').toLowerCase() === 'approved' &&
      row.reason === ROSTER_LEAVE_REASON &&
      validDay(String(row.startDate || '')) && validDay(String(row.endDate || ''))
    ).map(row => [row.id, row])
  );
  const daysByPersonAndType = new Map<string, Map<string, Set<string>>>();
  for (const entry of roster) {
    const request = generated.get(String(entry.leaveRequestId || ''));
    if (!request || !entry.date || !validDay(entry.date) ||
        entry.staffId !== request.staffId || entry.status !== request.leaveType ||
        entry.date < String(request.startDate) || entry.date > String(request.endDate)) continue;
    const key = JSON.stringify([request.staffId, request.leaveType]);
    if (!daysByPersonAndType.has(key)) daysByPersonAndType.set(key, new Map());
    const dates = daysByPersonAndType.get(key)!;
    if (!dates.has(entry.date)) dates.set(entry.date, new Set());
    dates.get(entry.date)!.add(request.id);
  }

  const plans: LeaveConsolidation[] = [];
  for (const [key, dates] of daysByPersonAndType) {
    const [, leaveType] = JSON.parse(key) as [string, string];
    const dateKeys = [...dates.keys()].sort();
    const runs: string[][] = [];
    for (const date of dateKeys) {
      const lastRun = runs[runs.length - 1];
      if (lastRun && nextDay(lastRun[lastRun.length - 1]) === date) lastRun.push(date);
      else runs.push([date]);
    }
    for (const run of runs) {
      const startDate = run[0];
      const endDate = run[run.length - 1];
      const ids = [...new Set(run.flatMap(day => [...dates.get(day)!]))];
      const candidates = ids.map(id => generated.get(id)!).filter(Boolean);
      // Never truncate a pre-existing range or merge a request into two different runs.
      if (candidates.some(row => String(row.startDate) < startDate || String(row.endDate) > endDate)) continue;
      // Keep the original earliest request as the historical audit anchor.
      candidates.sort((a, b) => String(a.requestedAt || '').localeCompare(String(b.requestedAt || '')) ||
        String(a.startDate).localeCompare(String(b.startDate)) || a.id.localeCompare(b.id));
      const keep = candidates[0];
      if (!keep) continue;
      const days = leaveType === 'ANNUAL LEAVE'
        ? run.filter(date => new Date(`${date}T00:00:00Z`).getUTCDay() !== 5 && !holidays.has(date)).length
        : run.length;
      const removeIds = candidates.slice(1).map(row => row.id);
      if (removeIds.length || keep.startDate !== startDate || keep.endDate !== endDate || keep.days !== days) {
        plans.push({ keepId: keep.id, removeIds, startDate, endDate, days });
      }
    }
  }
  return plans;
}
