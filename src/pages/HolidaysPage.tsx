import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../auth';
import { getMaldivesHolidays } from '../data/maldivesHolidays';

const FULL_ACCESS_ROLES = ['developer', 'manager', 'owner', 'admin', 'smt'];

const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getDayName = (dateStr: string): string => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date(dateStr + 'T00:00:00').getDay()];
};

function HolidaysPage() {
  const { profile } = useAuth();
  const isAdmin = FULL_ACCESS_ROLES.includes(profile?.role || '');

  const [holidays, setHolidays] = useState<any[]>([]);
  const [date, setDate] = useState<string>(formatDate(new Date()));
  const [name, setName] = useState<string>('');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [showFridays, setShowFridays] = useState<boolean>(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'holidays'), (snap) => {
      setHolidays(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleAdd = async (e: any) => {
    e.preventDefault();
    if (!date || !name) { alert('Please enter date and name'); return; }
    if (holidays.some((h) => h.date === date)) {
      alert('A holiday already exists on that date.');
      return;
    }
    try {
      await addDoc(collection(db, 'holidays'), {
        date,
        name,
        createdAt: new Date().toISOString(),
      });
      setName('');
      alert('Holiday added!');
    } catch (err: any) { alert('Error: ' + err.message); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this holiday?')) return;
    await deleteDoc(doc(db, 'holidays', id));
  };

  const handleImportMaldives = async () => {
    const officialHolidays = getMaldivesHolidays(year);
    if (officialHolidays.length === 0) {
      alert(`The official Maldives holiday list for ${year} is not yet available in the app. Please add them manually.`);
      return;
    }

    const existingDates = new Set(holidays.map((h: any) => h.date));
    const missing = officialHolidays.filter((h) => !existingDates.has(h.date));

    if (missing.length === 0) {
      alert(`✅ All Maldives ${year} holidays are already in your list.`);
      return;
    }

    if (!window.confirm(`Import ${missing.length} Maldives public holidays for ${year}?`)) return;

    try {
      for (const h of missing) {
        await addDoc(collection(db, 'holidays'), {
          date: h.date,
          name: `🇲🇻 ${h.name}`,
          createdAt: new Date().toISOString(),
        });
      }
      alert(`✅ Imported ${missing.length} Maldives public holidays for ${year}!`);
    } catch (err: any) { alert('Error: ' + err.message); }
  };

  const fridaysOfYear: string[] = [];
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  const cur = new Date(start);
  while (cur <= end) {
    if (cur.getDay() === 5) fridaysOfYear.push(formatDate(cur));
    cur.setDate(cur.getDate() + 1);
  }

  const customHolidaysThisYear = holidays
    .filter((h) => h.date.startsWith(String(year)))
    .sort((a: any, b: any) => a.date.localeCompare(b.date));

  const customRows = customHolidaysThisYear.map((h: any) => ({
    date: h.date,
    name: h.name,
    isFriday: false,
    id: h.id,
  }));

  const fridayRows = fridaysOfYear.map((d) => ({
    date: d,
    name: 'Friday',
    isFriday: true,
    id: '',
  }));

  const displayedRows = showFridays
    ? [...fridayRows, ...customRows].sort((a, b) => a.date.localeCompare(b.date))
    : customRows;

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>
          Company Calendar Holidays
          <span style={{ fontSize: '13px', marginLeft: '10px', color: '#64748b', fontWeight: 500 }}>
            ({customHolidaysThisYear.length} custom · {fridaysOfYear.length} Fridays)
          </span>
        </h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isAdmin && (
            <button className="export-btn jpg-btn" onClick={handleImportMaldives}>
              🇲🇻 Import Maldives {year} Holidays
            </button>
          )}
          <button
            className={showFridays ? 'export-btn pdf-btn' : 'export-btn jpg-btn'}
            onClick={() => setShowFridays(!showFridays)}
          >
            {showFridays ? '🙈 Hide Fridays' : '📅 Show Fridays'}
          </button>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'inherit', fontSize: '14px' }}
          >
            {[year - 1, year, year + 1, year + 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {isAdmin && (
        <form className="staff-form" onSubmit={handleAdd}>
          <div style={{ gridColumn: 'span 2', marginBottom: '4px', fontWeight: 600, color: '#1e293b' }}>
            ➕ Add Custom Holiday
          </div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <input placeholder="Holiday name" value={name} onChange={(e) => setName(e.target.value)} required />
          <button type="submit">Add Holiday</button>
        </form>
      )}

      <div className="staff-list">
        {displayedRows.length === 0 ? (
          <div className="empty-state"><p>No holidays for {year}.</p></div>
        ) : (
          <table>
            <thead>
              <tr><th>Date</th><th>Day</th><th>Name</th><th>Type</th>{isAdmin && <th></th>}</tr>
            </thead>
            <tbody>
              {displayedRows.map((h: any) => (
                <tr key={h.date + h.name}>
                  <td>{h.date}</td>
                  <td>{getDayName(h.date)}</td>
                  <td>{h.name}</td>
                  <td>
                    {h.isFriday ? (
                      <span className="status-badge status-approved">FRIDAY (AUTO)</span>
                    ) : (
                      <span className="status-badge status-pending">CUSTOM</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td>
                      {!h.isFriday && h.id && (
                        <button className="delete-btn" onClick={() => handleDelete(h.id)}>Delete</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default HolidaysPage;