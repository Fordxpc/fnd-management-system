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

/**
 * Group only the *presentation* of likely duplicate roster identities.
 * These records are never deleted/merged in the database. A flagged group
 * must be verified in the Staff Directory by official staff number before
 * combining or deleting actual staff accounts.
 */
function possibleOneLetterTypo(a: string, b: string): boolean {
  const aa = normalize(a).split(' ');
  const bb = normalize(b).split(' ');
  if (aa.length < 2 || bb.length !== aa.length || aa[0] !== bb[0]) return false;
  if (aa.slice(1, -1).join(' ') !== bb.slice(1, -1).join(' ')) return false;
  const x = aa.at(-1) || '';
  const y = bb.at(-1) || '';
  if (Math.min(x.length, y.length) < 4 || Math.abs(x.length - y.length) > 1) return false;
  let edits = 0, i = 0, j = 0;
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (x.length > y.length) i++;
    else if (y.length > x.length) j++;
    else { i++; j++; }
  }
  return edits + (x.length - i) + (y.length - j) === 1;
}

export function groupDutyDisplayEntries<T extends DutyEntry>(entries: T[]): Array<T & {
  possibleDuplicate: boolean;
  candidateNames: string[];
  sourceCount: number;
}> {
  const groups: Array<{ rows: T[] }> = [];
  for (const entry of entries) {
    const department = canonicalDept(entry.staffDepartment);
    const shift = normalize(entry.shiftTime);
    const match = groups.find(group => group.rows.some(other =>
      canonicalDept(other.staffDepartment) === department &&
      normalize(other.shiftTime) === shift &&
      (normalize(other.staffName) === normalize(entry.staffName) ||
       possibleOneLetterTypo(String(other.staffName || ''), String(entry.staffName || '')))
    ));
    if (match) match.rows.push(entry);
    else groups.push({ rows: [entry] });
  }
  return groups.map(({ rows }) => {
    const preferred = [...rows].sort((a, b) =>
      String(b.staffName || '').length - String(a.staffName || '').length)[0];
    const names = [...new Set(rows.map(r => String(r.staffName || '')))].sort();
    return {
      ...preferred,
      possibleDuplicate: rows.length > 1,
      candidateNames: names,
      sourceCount: rows.length,
    };
  }).sort((a, b) => String(a.staffName || '').localeCompare(String(b.staffName || '')));
}
