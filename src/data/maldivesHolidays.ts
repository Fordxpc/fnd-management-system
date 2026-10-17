export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
}

export const MALDIVES_HOLIDAYS_2026: Holiday[] = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-02-05', name: 'Majlis Presidential Address' },
  { date: '2026-02-18', name: 'Ramadan Start (Tentative)' },
  { date: '2026-03-20', name: 'Eid-ul-Fithr (Tentative)' },
  { date: '2026-03-21', name: 'Eid-ul-Fithr Holiday' },
  { date: '2026-03-22', name: 'Eid-ul-Fithr Holiday' },
  { date: '2026-04-05', name: 'Government Holiday' },
  { date: '2026-04-06', name: 'Government Holiday' },
  { date: '2026-05-01', name: 'Labor Day' },
  { date: '2026-05-24', name: "Eid-ul Al'haa Holiday" },
  { date: '2026-05-25', name: "Eid-ul Al'haa Holiday" },
  { date: '2026-05-26', name: 'Hajj Day' },
  { date: '2026-05-27', name: "Eid-ul Al'haa" },
  { date: '2026-05-28', name: "Eid-ul Al'haa Holiday" },
  { date: '2026-05-29', name: "Eid-ul Al'haa Holiday" },
  { date: '2026-05-30', name: "Eid-ul Al'haa Holiday" },
  { date: '2026-06-16', name: 'Muharram (Islamic New Year)' },
  { date: '2026-07-26', name: 'Independence Day' },
  { date: '2026-07-27', name: 'Independence Day Holiday' },
  { date: '2026-08-14', name: 'National Day' },
  { date: '2026-08-25', name: 'Milad un Nabi' },
  { date: '2026-09-13', name: 'The Day Maldives Embraced Islam' },
  { date: '2026-09-14', name: 'The Day Maldives Embraced Islam Holiday' },
  { date: '2026-11-03', name: 'Victory Day' },
  { date: '2026-11-11', name: 'Republic Day' },
];

export const MALDIVES_HOLIDAYS_2027: Holiday[] = [
  { date: '2027-01-01', name: "New Year's Day" },
  { date: '2027-02-08', name: 'Ramadan Start (Tentative)' },
  { date: '2027-03-10', name: 'Eid-ul-Fithr (Tentative)' },
  { date: '2027-03-11', name: 'Eid-ul-Fithr Holiday' },
  { date: '2027-03-12', name: 'Eid-ul-Fithr Holiday' },
  { date: '2027-05-01', name: 'Labor Day' },
  { date: '2027-05-16', name: 'Hajj Day' },
  { date: '2027-05-17', name: "Eid-ul Al'haa (Tentative)" },
  { date: '2027-05-18', name: "Eid-ul Al'haa Holiday" },
  { date: '2027-05-19', name: "Eid-ul Al'haa Holiday" },
  { date: '2027-05-20', name: "Eid-ul Al'haa Holiday" },
  { date: '2027-06-06', name: 'Muharram (Tentative)' },
  { date: '2027-07-26', name: 'Independence Day' },
  { date: '2027-07-27', name: 'Independence Day Holiday' },
  { date: '2027-08-04', name: 'National Day (Tentative)' },
  { date: '2027-08-15', name: 'Milad un Nabi (Tentative)' },
  { date: '2027-09-03', name: 'The Day Maldives Embraced Islam (Tentative)' },
  { date: '2027-11-03', name: 'Victory Day' },
  { date: '2027-11-11', name: 'Republic Day' },
];

// Helper to get the list based on the selected year
export const getMaldivesHolidays = (year: number): Holiday[] => {
  if (year === 2026) return MALDIVES_HOLIDAYS_2026;
  if (year === 2027) return MALDIVES_HOLIDAYS_2027;
  return []; // For other years, you can add them here later
};