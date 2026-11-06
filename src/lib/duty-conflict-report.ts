// Read-only helper; keep this normalization standalone for Node/Cloudflare use.
const canonicalSn = (value: unknown) => {
  const raw = String(value || '').trim().replace(/^SN[\s-]*/i, '').toUpperCase();
  return /^\d{1,4}$/.test(raw) ? raw.padStart(4, '0') : raw;
};

type DutyIdentity = {
  id?: string | null;
  sn?: string | null;
  name?: string | null;
};

type DutyConflictRow = {
  id?: string | null;
  staffId?: string | null;
  staffSn?: string | null;
  staffName?: string | null;
  status?: string | null;
  date?: string | null;
  shiftTime?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  leaveType?: string | null;
};

type DutyConflict<T extends DutyConflictRow, U extends DutyConflictRow> = {
  entry: T;
  unavailable: U;
  reason: 'staff-id' | 'staff-number' | 'name-review';
};

/**
 * Manager-only, read-only audit details for duty/leave collisions.
 * Never merge staff, and never infer an SN from similar names.
 * Distinguish the actual record links from alias-based presentation matching.
 */
export function buildDutyConflictReport<T extends DutyConflictRow, U extends DutyConflictRow>(
  conflicts: Array<DutyConflict<T, U>>,
  directory: DutyIdentity[],
) {
  const directoryById = new Map(directory.filter(person => person.id).map(person => [String(person.id), person] as const));
  const getIdentity = (record: DutyConflictRow) => {
    const linked = directoryById.get(String(record.staffId || ''));
    const sn = canonicalSn(linked?.sn || record.staffSn);
    return {
      staffId: String(record.staffId || ''),
      staffName: String(linked?.name || record.staffName || 'Unknown staff'),
      staffSn: sn ? `SN-${sn}` : 'SN missing',
      snKey: sn,
      recordId: String(record.id || ''),
    };
  };

  return conflicts.map(({ entry, unavailable, reason }) => {
    const scheduled = getIdentity(entry);
    const blockedBy = getIdentity(unavailable);
    const sameRecordId = Boolean(scheduled.staffId && scheduled.staffId === blockedBy.staffId);
    const sameSn = Boolean(scheduled.snKey && scheduled.snKey === blockedBy.snKey &&
      directory.filter(person => canonicalSn(person.sn) === scheduled.snKey).length === 1);
    const independentlyVerified = sameRecordId || sameSn;
    const type = unavailable.leaveType ? 'Approved leave' : 'Roster status';
    const label = unavailable.leaveType || unavailable.status || 'Unavailable';
    const dateRange = unavailable.startDate
      ? `${unavailable.startDate}${unavailable.endDate && unavailable.endDate !== unavailable.startDate ? ` to ${unavailable.endDate}` : ''}`
      : String(unavailable.date || entry.date || '');
    return {
      rosterEntryId: scheduled.recordId,
      rosterStaffId: scheduled.staffId,
      rosterName: scheduled.staffName,
      rosterSn: scheduled.staffSn,
      rosterShift: String(entry.shiftTime || ''),
      rosterDate: String(entry.date || ''),
      unavailableRecordId: blockedBy.recordId,
      unavailableStaffId: blockedBy.staffId,
      unavailableName: blockedBy.staffName,
      unavailableSn: blockedBy.staffSn,
      unavailableType: type,
      unavailableLabel: String(label),
      unavailableDates: dateRange,
      evidence: independentlyVerified ? (sameRecordId ? 'Same linked staff ID' : 'Same verified SN') :
        'Name/spelling match only — verify staff IDs and SNs',
      needsIdentityReview: !independentlyVerified,
      detectionReason: reason,
    };
  });
}
