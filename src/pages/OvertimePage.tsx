import { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../auth';

const APPROVER_DESIGNATIONS = [
  'Airport Manager',
  'Assistant Manager',
  'Assistant Safety Officer',
  'Senior Airport Officer',
  'Operations Officer',
  'Assistant Operations Officer',
  'Assistant Security Officer',
  'Assistant Administrative Officer',
  'Leading Fireman',
];

const GLOBAL_APPROVERS = ['Airport Manager', 'Assistant Manager'];
const DEVELOPER_ROLES = ['developer'];

const WEEKLY_THRESHOLD = 48;

const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDisplay = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const getDayShort = (dateStr: string): string => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[new Date(dateStr + 'T00:00:00').getDay()];
};

const isFriday = (dateStr: string): boolean => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.getDay() === 5;
};

const computeHours = (start: string, end: string): number => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (minutes < 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 100) / 100;
};

// Get Saturday of the week containing dateStr (Sat-Fri week)
const getWeekStart = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const diff = (day + 1) % 7;
  d.setDate(d.getDate() - diff);
  return formatDate(d);
};

const getWeekEnd = (weekStartStr: string): string => {
  const d = new Date(weekStartStr + 'T00:00:00');
  d.setDate(d.getDate() + 6);
  return formatDate(d);
};

function OvertimePage() {
  const { profile, user } = useAuth();
  const isDeveloper: boolean = DEVELOPER_ROLES.includes(profile?.role || '');

  const [entries, setEntries] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [myStaff, setMyStaff] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const [monthFilter, setMonthFilter] = useState<string>(formatDate(new Date()).slice(0, 7));
  const [filterStaff, setFilterStaff] = useState<string>('all');
  const [showForm, setShowForm] = useState<boolean>(false);

  const [formStaffId, setFormStaffId] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(formatDate(new Date()));
  const [formStart, setFormStart] = useState<string>('14:00');
  const [formEnd, setFormEnd] = useState<string>('16:00');
  const [formNotes, setFormNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    const unsubStaff = onSnapshot(collection(db, 'staff'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setStaff(list);
      const mine = list.find(
        (s: any) => (s.email || '').toLowerCase() === (user?.email || '').toLowerCase()
      );
      setMyStaff(mine || null);
      if (mine) setFormStaffId(mine.id);
      setLoading(false);
    });
    const unsubOT = onSnapshot(collection(db, 'overtime_entries'), (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubStaff();
      unsubOT();
    };
  }, [user]);

  const canApproveAny: boolean =
    isDeveloper || GLOBAL_APPROVERS.includes(myStaff?.position || '');
  const isManager: boolean =
    canApproveAny || APPROVER_DESIGNATIONS.includes(myStaff?.position || '');

  // Filter entries for the current view
  let filtered = entries.filter((e) => (e.date || '').startsWith(monthFilter));
  if (isManager) {
    if (filterStaff !== 'all') {
      filtered = filtered.filter((e) => e.staffId === filterStaff);
    }
  } else {
    filtered = filtered.filter((e) => myStaff && e.staffId === myStaff.id);
  }
  filtered.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  // Group by week
  const weekMap: { [key: string]: any[] } = {};
  filtered.forEach((e) => {
    const weekKey = getWeekStart(e.date);
    if (!weekMap[weekKey]) weekMap[weekKey] = [];
    weekMap[weekKey].push(e);
  });
  const weekKeys = Object.keys(weekMap).sort();

  // My monthly total
  const myMonthEntries = myStaff
    ? entries.filter((e) => e.staffId === myStaff.id && (e.date || '').startsWith(monthFilter))
    : [];
  const myMonthHours = myMonthEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
  const myTotalHours = myStaff
    ? entries.filter((e) => e.staffId === myStaff.id).reduce((sum, e) => sum + (e.hours || 0), 0)
    : 0;

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!formStaffId) {
      alert('Please select a staff member');
      return;
    }
    const hours = computeHours(formStart, formEnd);
    if (hours <= 0) {
      alert('End time must be after start time');
      return;
    }
    const staffMember = staff.find((s) => s.id === formStaffId);
    if (!staffMember) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'overtime_entries'), {
        staffId: formStaffId,
        staffName: staffMember.name,
        staffSN: staffMember.sn || '',
        staffDepartment: staffMember.department,
        date: formDate,
        startTime: formStart,
        endTime: formEnd,
        hours,
        notes: formNotes,
        isFriday: isFriday(formDate),
        createdAt: new Date().toISOString(),
        createdBy: user?.email || '',
      });
      setFormNotes('');
      setShowForm(false);
      alert(`✅ Logged ${hours} hour(s).`);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this overtime entry?')) return;
    await deleteDoc(doc(db, 'overtime_entries', id));
  };

  const exportCSV = () => {
    const rows: string[][] = [
      ['SN', 'Name', 'Department', 'Date', 'Day', 'Start', 'End', 'Hours', 'Notes'],
    ];
    filtered.forEach((e) => {
      rows.push([
        e.staffSN || '',
        e.staffName || '',
        e.staffDepartment || '',
        e.date || '',
        getDayShort(e.date),
        e.startTime || '',
        e.endTime || '',
        String(e.hours || 0),
        e.notes || '',
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `FND-Overtime-${monthFilter}.csv`;
    link.click();
  };

  if (loading) {
    return <div className="page-content"><p>Loading...</p></div>;
  }

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>Overtime Sheet</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontFamily: 'inherit',
              fontSize: '13px',
            }}
          />
          <button className="export-btn jpg-btn" onClick={exportCSV}>
            📥 CSV
          </button>
          <button
            className="add-staff-btn"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? 'Cancel' : '+ Log OT'}
          </button>
        </div>
      </div>

      <div className="info-banner">
        <strong>ℹ️ Overtime Rule:</strong> Staff must work at least{' '}
        <strong>{WEEKLY_THRESHOLD} hours per week</strong> before OT becomes eligible. Any hours
        beyond {WEEKLY_THRESHOLD} in a week count as overtime.
      </div>

      {myStaff && (
        <div className="collapsible-card">
          <div className="collapsible-body" style={{ paddingTop: '16px' }}>
            <div className="balance-grid">
              <div className="balance-item">
                <span className="balance-label">Entries this month</span>
                <span className="balance-value">{myMonthEntries.length}</span>
              </div>
              <div className="balance-item">
                <span className="balance-label">My OT hours ({monthFilter})</span>
                <span className="balance-value">{myMonthHours.toFixed(2)} hrs</span>
              </div>
              <div className="balance-item">
                <span className="balance-label">My all-time OT hours</span>
                <span className="balance-value">{myTotalHours.toFixed(2)} hrs</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <form className="staff-form" onSubmit={handleSubmit}>
          <div
            style={{
              gridColumn: 'span 2',
              marginBottom: '4px',
              fontWeight: 600,
              color: '#1e293b',
            }}
          >
            ⏰ Log Overtime
          </div>

          {isManager ? (
            <select
              value={formStaffId}
              onChange={(e) => setFormStaffId(e.target.value)}
              required
            >
              <option value="">Select Staff Member...</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.sn || 'No SN'}) — {s.department}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={
                myStaff
                  ? `${myStaff.name} (${myStaff.sn || 'No SN'})`
                  : 'Not linked to a staff record'
              }
              disabled
            />
          )}

          <input
            type="date"
            value={formDate}
            onChange={(e) => setFormDate(e.target.value)}
            required
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
              Start Time
            </label>
            <input
              type="time"
              value={formStart}
              onChange={(e) => setFormStart(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
              End Time
            </label>
            <input
              type="time"
              value={formEnd}
              onChange={(e) => setFormEnd(e.target.value)}
              required
            />
          </div>

          <input
            placeholder="Notes (optional)"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            style={{ gridColumn: 'span 2' }}
          />

          <div
            style={{
              gridColumn: 'span 2',
              fontSize: '13px',
              color: '#475569',
              padding: '10px 12px',
              background: '#f1f5f9',
              borderRadius: '6px',
            }}
          >
            <strong>Duration:</strong> {computeHours(formStart, formEnd)} hour(s)
            {isFriday(formDate) && (
              <span style={{ marginLeft: '10px', color: '#92400e' }}>
                · Friday (holiday rate applies)
              </span>
            )}
          </div>

          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Entry'}
          </button>
        </form>
      )}

      {isManager && (
        <div
          className="leave-tabs"
          style={{ marginBottom: '16px', marginTop: '16px' }}
        >
          <label
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#475569',
              alignSelf: 'center',
              marginRight: '8px',
            }}
          >
            Filter by staff:
          </label>
          <select
            value={filterStaff}
            onChange={(e) => setFilterStaff(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontFamily: 'inherit',
              fontSize: '13px',
            }}
          >
            <option value="all">All Staff</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.sn || 'No SN'})
              </option>
            ))}
          </select>
        </div>
      )}

      {weekKeys.length === 0 ? (
        <div className="staff-list">
          <div className="empty-state">
            <p>No overtime entries for {monthFilter}.</p>
          </div>
        </div>
      ) : (
        weekKeys.map((weekKey) => {
          const weekEntries = weekMap[weekKey];
          const weekTotal = weekEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
          const isOver = weekTotal >= WEEKLY_THRESHOLD;
          const eligible = Math.max(0, weekTotal - WEEKLY_THRESHOLD);
          return (
            <div key={weekKey} style={{ marginBottom: '20px' }}>
              <div
                style={{
                  background: isOver ? '#dcfce7' : '#f1f5f9',
                  padding: '10px 16px',
                  borderRadius: '8px 8px 0 0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontWeight: 700,
                  fontSize: '13px',
                  color: isOver ? '#065f46' : '#475569',
                }}
              >
                <span>
                  Week: {formatDisplay(weekKey)} – {formatDisplay(getWeekEnd(weekKey))}
                </span>
                <span>
                  Total: {weekTotal.toFixed(2)} hrs
                  {isOver
                    ? ` · ✅ Eligible (${eligible.toFixed(2)} hrs OT)`
                    : ` · ${(WEEKLY_THRESHOLD - weekTotal).toFixed(2)} hrs to reach ${WEEKLY_THRESHOLD}`}
                </span>
              </div>
              <div className="staff-list">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Day</th>
                      {isManager && <th>Staff</th>}
                      <th>Time</th>
                      <th>Hours</th>
                      <th>Notes</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {weekEntries.map((e) => (
                      <tr key={e.id}>
                        <td>{formatDisplay(e.date)}</td>
                        <td>{getDayShort(e.date)}</td>
                        {isManager && (
                          <td>
                            <strong>{e.staffName}</strong>
                            {e.staffSN && (
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                {e.staffSN}
                              </div>
                            )}
                          </td>
                        )}
                        <td style={{ fontSize: '12px' }}>
                          {e.startTime} – {e.endTime}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>
                          {e.hours}
                        </td>
                        <td style={{ fontSize: '12px', color: '#64748b' }}>
                          {e.notes || '—'}
                        </td>
                        <td>
                          {(isManager || (myStaff && e.staffId === myStaff.id)) && (
                            <button
                              className="delete-btn"
                              onClick={() => handleDelete(e.id)}
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default OvertimePage;