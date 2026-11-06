/**
 * Canonicalize dashboard duty entries by verified identity (staff number or ID).
 * Similar names with different IDs are NOT silently treated as the same person.
 */
type StaffIdentity = {
  id?: string | null;
  sn?: string | null;
  name?: string | null;
  department?: string | null;
};
type DutyEntry = {
  staffId?: string | null;
  staffName?: string | null;
  staffDepartment?: string | null;
  staffSn?: string | null;
  shiftTime?: string | null;
  createdAt?: string | null;
  requestedAt?: string | null;
};

const normalize = (value: unknown) => String(value || '').normalize('NFKC')
  .replace(/[\u200B-\u200D\uFEFF]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
const canonicalDept = (value: unknown) => {
  const department = normalize(value);
  if (department.includes('ground') || department === 'operations') return 'ground operations';
  if (department.includes('maint')) return 'maintenance';
  if (department.includes('secur')) return 'security';
  if (department.includes('fire') || department.includes('rescue')) return 'fire & rescue';
  if (department.includes('admin')) return 'administration';
  if (department.includes('safe')) return 'safety';
  return department || 'unassigned';
};
const canonicalSn = (value: unknown) => String(value || '').trim().replace(/^sn-/i, '').toUpperCase();

export function deduplicateDutyEntries<T extends DutyEntry>(entries: T[], staff: StaffIdentity[]): T[] {
  const byId = new Map(staff.filter(member => member.id).map(member => [String(member.id), member] as const));
  const unique = new Map<string, T>();
  for (const entry of entries) {
    const linked = byId.get(String(entry.staffId || ''));
    const sn = canonicalSn(linked?.sn || entry.staffSn);
    const identity = sn ? `sn:${sn}` : linked?.id ? `id:${linked.id}` :
      entry.staffId ? `roster:${entry.staffId}` : `name:${normalize(entry.staffName)}`;
    const key = `${identity}|${canonicalDept(linked?.department || entry.staffDepartment)}`;
    const canonicalEntry: T = {
      ...entry,
      staffName: linked?.name || entry.staffName,
      staffDepartment: linked?.department || entry.staffDepartment,
    };
    const previous = unique.get(key);
    if (!previous) { unique.set(key, canonicalEntry); continue; }
    // If a staff member genuinely has two shifts, retain both distinct times.
    const shifts = [...new Set([previous.shiftTime, canonicalEntry.shiftTime]
      .flatMap(value => String(value || '').split(' | ')).map(value => value.trim()).filter(Boolean))];
    const newer = String(canonicalEntry.createdAt || canonicalEntry.requestedAt || '') >
      String(previous.createdAt || previous.requestedAt || '') ? canonicalEntry : previous;
    unique.set(key, { ...newer, shiftTime: shifts.join(' | ') || newer.shiftTime });
  }
  return [...unique.values()].sort((a, b) =>
    String(a.staffName || '').localeCompare(String(b.staffName || '')));
}
