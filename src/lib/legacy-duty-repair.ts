/**
 * Read-only validation for a manager-confirmed legacy duty repair.
 * Changing the database is handled separately, under server authorization.
 * Do not resolve unfamiliar spelling differences automatically.
 */
type Person = { id?: string | null; sn?: string | null; name?: string | null; department?: string | null };
type Roster = { staffId?: string | null; staffName?: string | null; staffDepartment?: string | null;
  date?: string | null; status?: string | null; shiftTime?: string | null; leaveRequestId?: string | null;
  previousStatus?: string | null; previousShiftTime?: string | null };
type Leave = { id?: string | null; staffId?: string | null; staffSn?: string | null;
  staffDepartment?: string | null; startDate?: string | null; endDate?: string | null;
  status?: string | null; leaveType?: string | null };
const norm = (v: unknown) => String(v ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const sn = (v: unknown) => {
  const value = String(v ?? '').trim().replace(/^SN[\s-]*/i, '').toUpperCase();
  return /^\d{1,4}$/.test(value) ? value.padStart(4, '0') : value;
};
export function planLegacyDutyRepair(
  duty: Roster, leave: Leave, official: Person | undefined,
  directory: Person[], existingOfficialRoster: Roster[],
): { action: 'merge' | 'relink'; originalShift: string } {
  if (!official?.id || !sn(official.sn) || directory.filter(person => sn(person.sn) === sn(official.sn)).length !== 1) {
    throw new Error('One unique official Staff Directory SN is required');
  }
  if (leave.staffId !== official.id || (leave.staffSn && sn(leave.staffSn) !== sn(official.sn))) {
    throw new Error('Approved leave is not linked to the official employee number');
  }
  if (norm(leave.status) !== 'approved' || norm(duty.status) !== 'scheduled' ||
      !duty.date || !leave.startDate || !leave.endDate ||
      duty.date < leave.startDate || duty.date > leave.endDate) {
    throw new Error('The duty does not overlap approved leave');
  }
  if (norm(duty.staffDepartment) !== norm(official.department) ||
      norm(leave.staffDepartment) !== norm(official.department)) {
    throw new Error('Staff departments do not match');
  }
  const allowedAlias = sn(official.sn) === '0038' && norm(duty.staffName) === 'adam skakir' &&
    norm(official.name) === 'adam shakir';
  if (norm(duty.staffName) !== norm(official.name) && !allowedAlias) {
    throw new Error('Roster spelling is not a user-confirmed identity alias');
  }
  // A name alone is insufficient if two numbered employees share it.
  const sameNameAndDepartment = directory.filter(person =>
    norm(person.name) === norm(official.name) &&
    norm(person.department) === norm(official.department) && sn(person.sn));
  if (sameNameAndDepartment.some(person => person.id !== official.id)) {
    throw new Error('Multiple distinct numbered employees share this name; review manually');
  }
  const linked = directory.find(person => person.id === duty.staffId);
  if (linked && sn(linked.sn) && sn(linked.sn) !== sn(official.sn)) {
    throw new Error('Roster is attached to a different numbered employee');
  }
  if (!duty.shiftTime?.trim() || duty.leaveRequestId || duty.staffId === official.id) {
    throw new Error('Not an orphaned scheduled shift with a known prior time');
  }
  if (existingOfficialRoster.length > 1) throw new Error('Duplicate official roster rows need manual review');
  const existing = existingOfficialRoster[0];
  if (existing && (existing.leaveRequestId !== leave.id || existing.status !== leave.leaveType ||
      (existing.previousStatus != null && !['__EMPTY__', 'scheduled'].includes(existing.previousStatus)) ||
      (existing.previousStatus === 'scheduled' && existing.previousShiftTime !== duty.shiftTime))) {
    throw new Error('An existing roster assignment or backed-up shift conflicts with this repair');
  }
  return { action: existing ? 'merge' : 'relink', originalShift: duty.shiftTime };
}
