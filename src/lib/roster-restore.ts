/**
 * Preserve the roster status being covered by approved leave.
 * NULL previous_status means an old/unknown record; the explicit EMPTY marker
 * means the day really was unassigned before leave was applied.
 */
export const EMPTY_ROSTER_BEFORE_LEAVE = '__EMPTY__';

type ExistingRosterRow = {
  status?: string | null;
  shiftTime?: string | null;
  leaveRequestId?: string | null;
};

export function snapshotRosterBeforeLeave(rows: ExistingRosterRow[]): {
  previousStatus: string;
  previousShiftTime: string | null;
} {
  if (rows.some(row => row.leaveRequestId)) {
    throw new Error('This date already contains approved leave. Remove or review that leave first.');
  }
  if (rows.length === 0) {
    return { previousStatus: EMPTY_ROSTER_BEFORE_LEAVE, previousShiftTime: null };
  }
  const originals = rows.map(row => ({
    status: String(row.status || '').trim(),
    shiftTime: String(row.status || '').trim() === 'scheduled' ? String(row.shiftTime || '').trim() : '',
  }));
  if (originals.some(row => !['scheduled', 'OFF DAY', 'ABSENT'].includes(row.status))) {
    throw new Error('A pre-existing roster leave or unrecognized status needs review before applying new leave.');
  }
  if (new Set(originals.map(row => `${row.status}\u0000${row.shiftTime}`)).size > 1) {
    throw new Error('Conflicting roster entries exist for this staff member/date. Resolve them before applying leave.');
  }
  return {
    previousStatus: originals[0].status,
    previousShiftTime: originals[0].status === 'scheduled' ? originals[0].shiftTime : null,
  };
}
