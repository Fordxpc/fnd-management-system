/** Roster-facing rules for offboarded staff; dates are local ISO YYYY-MM-DD. */
export function isInactiveStaff(person: { status?: string | null }): boolean {
  return ['resigned', 'archived'].includes(String(person.status || 'active').toLowerCase());
}

export function resignationLastDay(person: { resignationLastDay?: string | null }): string | null {
  const value = person.resignationLastDay || '';
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

/** Retain staff on their final roster period and on historical rosters. */
export function showStaffInRosterPeriod(
  person: { status?: string | null; resignationLastDay?: string | null },
  periodStart: string,
  hasHistoryInPeriod = false,
): boolean {
  if (!isInactiveStaff(person)) return true;
  const lastDay = resignationLastDay(person);
  // An archived record without a documented departure date stays on historical
  // rosters where it has actual entries, but is not scheduled prospectively.
  // Today's ISO date comes from the browser; operational write restrictions
  // are enforced separately on the server.
  const todayMaldives = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Indian/Maldives' }).format(new Date());
  return lastDay ? lastDay >= periodStart : hasHistoryInPeriod && periodStart <= todayMaldives;
}

/** Virtual RES cells do not overwrite linked approved leave or past shifts. */
export function shouldDisplayResigned(
  person: { status?: string | null; resignationLastDay?: string | null },
  date: string,
  periodStart: string,
  periodEnd: string,
): boolean {
  if (!isInactiveStaff(person)) return false;
  const lastDay = resignationLastDay(person);
  return !!lastDay && lastDay >= periodStart && lastDay <= periodEnd && date > lastDay && date <= periodEnd;
}
