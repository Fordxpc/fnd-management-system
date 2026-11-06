/**
 * Canonicalize dashboard duty entries by verified identity (staff number or ID).
 * Only four user-confirmed official Staff Directory identities may override
 * outdated name/ID aliases when the unique official SN exists.
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
/** Normalize both SN-0038 and 0038 to one staff-number identity. */
export const canonicalSn = (value: unknown) => {
  const normalized = String(value || '').trim().replace(/^SN[\s-]*/i, '').toUpperCase();
  if (!normalized) return '';
  return /^\d{1,4}$/.test(normalized) ? normalized.padStart(4, '0') : normalized;
};

/** These four identities come from the app's official Staff Directory seed. */
const verifiedNames = [
  { sn: '0037', name: 'Adam Faisal', aliases: ['Adam Faisal'], department: 'ground operations' },
  { sn: '0038', name: 'Adam Shakir', aliases: ['Adam Shakir', 'Adam Skakir'], department: 'ground operations' },
  { sn: '0729', name: 'Mohamed Fuadhu', aliases: ['Mohamed Fuadhu', 'Mohamed Fuadh'], department: 'ground operations' },
  { sn: '0757', name: 'Mohamed Adam', aliases: ['Mohamed Adam'], department: 'ground operations' },
];

/**
 * Resolve a known legacy spelling/duplicate to a current, uniquely identified
 * Staff Directory member. Do not use fuzzy matching, and NEVER alter database
 * records as part of dashboard rendering.
 *
 * A confirmed alias resolves only if a unique profile with the official SN
 * exists in the matching department. Unrelated names are not reassigned.
 */
function resolveStaffEntry(entry: DutyEntry, staff: StaffIdentity[], byId: Map<string, StaffIdentity>) {
  const linked = byId.get(String(entry.staffId || ''));
  const originalName = normalize(linked?.name || entry.staffName);
  const originalDepartment = canonicalDept(linked?.department || entry.staffDepartment);
  const canonical = verifiedNames.find(person =>
    person.department === originalDepartment &&
    person.aliases.some(alias => normalize(alias) === originalName)
  );
  if (canonical) {
    const matches = staff.filter(person =>
      canonicalSn(person.sn) === canonical.sn && canonicalDept(person.department) === canonical.department
    );
    if (matches.length === 1) {
      const master = matches[0];
      return { id: String(master.id || ''), sn: canonical.sn, name: canonical.name, department: canonical.department };
    }
  }
  return {
    id: String(linked?.id || entry.staffId || ''),
    sn: canonicalSn(linked?.sn || entry.staffSn),
    name: String(linked?.name || entry.staffName || ''),
    department: canonicalDept(linked?.department || entry.staffDepartment),
  };
}

/**
 * Read-only list of obsolete / colliding profiles for the Staff Directory.
 * These are suggestions for a controlled data repair, NEVER a deletion list.
 */
export function reviewKnownStaffIdentityCollisions(directory: StaffIdentity[]): Array<{
  id: string; name: string; sn: string; correctName: string; correctSn: string;
}> {
  const reviews: Array<{ id: string; name: string; sn: string; correctName: string; correctSn: string }> = [];
  for (const canonical of verifiedNames) {
    const candidates = directory.filter(person =>
      canonicalDept(person.department) === canonical.department &&
      (canonicalSn(person.sn) === canonical.sn ||
        canonical.aliases.some(alias => normalize(alias) === normalize(person.name)))
    );
    const official = candidates.filter(person => canonicalSn(person.sn) === canonical.sn);
    // Never mark a row as disposable without a unique official record.
    if (official.length !== 1) continue;
    for (const person of candidates) {
      if (person.id === official[0].id && normalize(person.name) === normalize(canonical.name)) continue;
      if (!person.id) continue;
      reviews.push({ id: person.id, name: String(person.name || ''),
        sn: String(person.sn || ''), correctName: canonical.name, correctSn: `SN-${canonical.sn}` });
    }
  }
  return reviews;
}

/** Used by the Staff API to prevent SN-0038 and 0038 being registered twice. */
export function staffNumberConflict<T extends { id?: string | null; sn?: string | null }>(
  directory: T[], requestedSn: unknown, excludingId?: string,
): T | undefined {
  const desired = canonicalSn(requestedSn);
  if (!desired) return undefined;
  return directory.find(person =>
    String(person.id || '') !== String(excludingId || '') && canonicalSn(person.sn) === desired
  );
}

export function deduplicateDutyEntries<T extends DutyEntry>(entries: T[], staff: StaffIdentity[]): T[] {
  const byId = new Map(staff.filter(member => member.id).map(member => [String(member.id), member] as const));
  const unique = new Map<string, T>();
  for (const entry of entries) {
    const resolved = resolveStaffEntry(entry, staff, byId);
    const identity = resolved.sn ? `sn:${resolved.sn}` : resolved.id ? `id:${resolved.id}` :
      `unlinked:${normalize(entry.staffName)}`;
    const key = `${identity}|${resolved.department}`;
    const canonicalEntry: T = {
      ...entry,
      staffId: resolved.id || entry.staffId,
      staffSn: resolved.sn || entry.staffSn,
      staffName: resolved.name || entry.staffName,
      staffDepartment: resolved.department || entry.staffDepartment,
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
 * Avoid displaying a person as available for duty when a roster assignment
 * conflicts with approved leave or another unavailable roster status.
 *
 * ID/SN matches are definitive. Same-name and one-letter spelling matches in
 * the same department are provisional: those assignments are withheld from the
 * duty count and returned as conflicts for a manager to verify. Source records
 * are NEVER changed by this helper.
 */
export function reconcileDutyAvailability<T extends DutyEntry, U extends DutyEntry>(
  scheduled: T[],
  unavailable: U[],
  staff: StaffIdentity[],
): {
  visibleDutyEntries: T[];
  conflictingDutyEntries: Array<{ entry: T; unavailable: U; reason: 'staff-id' | 'staff-number' | 'name-review' }>;
} {
  const byId = new Map(staff.filter(member => member.id).map(member => [String(member.id), member] as const));
  const resolve = (entry: DutyEntry) => {
    const verified = resolveStaffEntry(entry, staff, byId);
    return {
      id: verified.id,
      sn: verified.sn,
      name: normalize(verified.name),
      department: verified.department,
    };
  };
  const unavailableResolved = unavailable.map(entry => ({ entry, identity: resolve(entry) }));
  const visibleDutyEntries: T[] = [];
  const conflictingDutyEntries: Array<{
    entry: T;
    unavailable: U;
    reason: 'staff-id' | 'staff-number' | 'name-review';
  }> = [];
  for (const entry of scheduled) {
    const identity = resolve(entry);
    const conflict = unavailableResolved.map(row => {
      if (identity.id && row.identity.id && identity.id === row.identity.id) {
        return { ...row, reason: 'staff-id' as const };
      }
      if (identity.sn && row.identity.sn && identity.sn === row.identity.sn) {
        return { ...row, reason: 'staff-number' as const };
      }
      // A possible spelling error must not make an employee appear available
      // while an approved leave entry may belong to the same person.
      if (identity.name && row.identity.name && identity.department === row.identity.department &&
        (identity.name === row.identity.name || possibleOneLetterTypo(identity.name, row.identity.name))) {
        return { ...row, reason: 'name-review' as const };
      }
      return null;
    }).find(Boolean);
    if (conflict) {
      conflictingDutyEntries.push({ entry, unavailable: conflict.entry, reason: conflict.reason });
    } else {
      visibleDutyEntries.push(entry);
    }
  }
  return { visibleDutyEntries, conflictingDutyEntries };
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
      // Different verified staff numbers are separate people, even with similar names.
      !(canonicalSn(other.staffSn) && canonicalSn(entry.staffSn) &&
        canonicalSn(other.staffSn) !== canonicalSn(entry.staffSn)) &&
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
