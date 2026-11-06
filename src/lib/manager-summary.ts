export type ManagerData = {
  roster: any[]; leaves: any[]; overtime: any[]; flights: any[];
  birds: any[]; fod: any[]; ramp: any[]; lights: any[];
};
/** Manager summaries count unique staff/date combinations, never duplicate roster rows. */
export function buildManagerSummary(data: ManagerData, from: string, to: string, department = '') {
  const matchesDepartment = (item: any) => !department || String(item.staffDepartment || '') === department;
  const roster = data.roster.filter(row => matchesDepartment(row) && row.date >= from && row.date <= to);
  const leaves = data.leaves.filter(row => matchesDepartment(row) && row.startDate <= to && row.endDate >= from);
  const overtime = data.overtime.filter(row => matchesDepartment(row) && row.date >= from && row.date <= to);
  const seenRoster = new Set<string>();
  const uniqueRoster = roster.filter(row => {
    const key = `${row.staffId}:${row.date}`;
    if (!row.staffId || !row.date || seenRoster.has(key)) return false;
    seenRoster.add(key); return true;
  });
  const scheduled = uniqueRoster.filter(row => String(row.status || '').toLowerCase() === 'scheduled');
  const approvedOT = overtime.filter(row => String(row.status || '').toLowerCase() === 'approved');
  const sumHours = approvedOT.reduce((sum: number, row: any) => sum + (Number.isFinite(Number(row.hours)) ? Math.max(0, Number(row.hours)) : 0), 0);
  const byDepartment: Record<string, { dutyShifts: number; leaveRequests: number; approvedOtHours: number }> = {};
  const get = (dept: string) => byDepartment[dept] ||= { dutyShifts: 0, leaveRequests: 0, approvedOtHours: 0 };
  scheduled.forEach(row => get(String(row.staffDepartment || 'Unassigned')).dutyShifts++);
  leaves.filter(row => String(row.status || '').toLowerCase() === 'approved').forEach(row => get(String(row.staffDepartment || 'Unassigned')).leaveRequests++);
  approvedOT.forEach(row => get(String(row.staffDepartment || 'Unassigned')).approvedOtHours += Math.max(0, Number(row.hours) || 0));
  const during = (row: any) => String(row.date || '') >= from && String(row.date || '') <= to;
  return {
    period: { from, to, department: department || 'All departments' },
    roster: { dutyShifts: scheduled.length, rosterRows: roster.length, uniqueStaffDates: uniqueRoster.length,
      duplicates: Math.max(0, roster.length - uniqueRoster.length) },
    leave: { approved: leaves.filter(row => String(row.status || '').toLowerCase() === 'approved').length,
      pending: leaves.filter(row => String(row.status || '').toLowerCase() === 'pending').length,
      rejected: leaves.filter(row => String(row.status || '').toLowerCase() === 'rejected').length },
    overtime: { approvedEntries: approvedOT.length, approvedHours: Math.round(sumHours * 100) / 100,
      pending: overtime.filter(row => String(row.status || '').toLowerCase() === 'pending').length },
    operations: { scheduledFlights: data.flights.filter(during).length, birdCounts: data.birds.filter(during).length,
      fodCollections: data.fod.filter(during).length, rampReports: data.ramp.filter(during).length,
      rwyInspections: data.lights.filter(during).length },
    byDepartment: Object.entries(byDepartment).sort(([a],[b])=> a.localeCompare(b))
      .map(([name, figures])=>({ department: name, ...figures, approvedOtHours: Math.round(figures.approvedOtHours * 100) / 100 }))
  };
}
