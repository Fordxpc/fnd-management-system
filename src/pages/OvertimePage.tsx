import { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../auth';

const WEEKLY_THRESHOLD = 48;
const DEPARTMENTS = ['Ground Operations', 'Maintenance', 'Security', 'Fire & Rescue', 'Administration'];

const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDisplay = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
};

const getDayShort = (dateStr: string): string => {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(dateStr + 'T00:00:00').getDay()];
};

const isFriday = (dateStr: string): boolean => new Date(dateStr + 'T00:00:00').getDay() === 5;

const computeHours = (start: string, end: string): number => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (minutes < 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 100) / 100;
};

const getWeekStart = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00');
  const diff = (d.getDay() + 1) % 7;
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
  const [entries, setEntries] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [myStaff, setMyStaff] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const [monthFilter, setMonthFilter] = useState<string>(formatDate(new Date()).slice(0, 7));
  const [viewMode, setViewMode] = useState<'individual' | 'department'>('individual');
  const [filterDept, setFilterDept] = useState<string>('Ground Operations');
  const [filterStaff, setFilterStaff] = useState<string>('all');
  const [showForm, setShowForm] = useState<boolean>(false);

  // Form state
  const [formDept, setFormDept] = useState<string>('Ground Operations');
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
      const mine = list.find((s: any) => (s.email || '').toLowerCase() === (user?.email || '').toLowerCase());
      setMyStaff(mine || null);
      if (mine) {
        setFormStaffId(mine.id);
        setFilterDept(mine.department);
        setFormDept(mine.department);
      }
      setLoading(false);
    });
    const unsubOT = onSnapshot(collection(db, 'overtime_entries'), (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubStaff(); unsubOT(); };
  }, [user]);

  const isManager = ['developer', 'manager', 'admin', 'smt'].includes(profile?.role || '');

  let filtered = entries.filter((e) => (e.date || '').startsWith(monthFilter));
  
  if (isManager) {
    if (viewMode === 'individual' && myStaff) {
      filtered = filtered.filter((e) => e.staffId === myStaff.id);
    } else {
      filtered = filtered.filter((e) => e.staffDepartment === filterDept);
      if (filterStaff !== 'all') {
        filtered = filtered.filter((e) => e.staffId === filterStaff);
      }
    }
  } else {
    filtered = filtered.filter((e) => myStaff && e.staffId === myStaff.id);
  }

  filtered.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const weekMap: { [key: string]: any[] } = {};
  filtered.forEach((e) => {
    const weekKey = getWeekStart(e.date);
    if (!weekMap[weekKey]) weekMap[weekKey] = [];
    weekMap[weekKey].push(e);
  });
  const weekKeys = Object.keys(weekMap).sort();

  const myMonthEntries = myStaff ? entries.filter((e) => e.staffId === myStaff.id && (e.date || '').startsWith(monthFilter)) : [];
  const myMonthHours = myMonthEntries.reduce((sum, e) => sum + (e.hours || 0), 0);

  // Filter staff options for the form
  const formStaffOptions = staff.filter(s => s.department === formDept);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!formStaffId) { alert('Please select a staff member'); return; }
    const hours = computeHours(formStart, formEnd);
    if (hours <= 0) { alert('End time must be after start time'); return; }
    const staffMember = staff.find((s) => s.id === formStaffId);
    if (!staffMember) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'overtime_entries'), {
        staffId: formStaffId, staffName: staffMember.name, staffSN: staffMember.sn || '',
        staffDepartment: staffMember.department, date: formDate, startTime: formStart, endTime: formEnd,
        hours, notes: formNotes, isFriday: isFriday(formDate), createdAt: new Date().toISOString(), createdBy: user?.email || '',
      });
      setFormNotes('');
      setShowForm(false);
      alert(`✅ Logged ${hours} hour(s).`);
    } catch (err: any) { alert('Error: ' + err.message); }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this overtime entry?')) return;
    await deleteDoc(doc(db, 'overtime_entries', id));
  };

  if (loading) return <div className="page-content"><p>Loading...</p></div>;

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>Overtime Sheet</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
          <button className="add-staff-btn" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Log OT'}</button>
        </div>
      </div>

      {isManager && (
        <div className="leave-tabs" style={{ marginBottom: '16px' }}>
          <button className={viewMode === 'individual' ? 'leave-tab active' : 'leave-tab'} onClick={() => setViewMode('individual')}>👤 My Individual OT</button>
          <button className={viewMode === 'department' ? 'leave-tab active' : 'leave-tab'} onClick={() => setViewMode('department')}>🏢 Department OT</button>
        </div>
      )}

      {isManager && viewMode === 'department' && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <select value={filterDept} onChange={(e) => { setFilterDept(e.target.value); setFilterStaff('all'); }} style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)} style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
            <option value="all">All Staff in {filterDept}</option>
            {staff.filter(s => s.department === filterDept).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      {myStaff && (
        <div className="collapsible-card" style={{ marginBottom: '16px' }}>
          <div className="collapsible-body" style={{ paddingTop: '16px' }}>
            <div className="balance-grid">
              <div className="balance-item"><span className="balance-label">My OT hours ({monthFilter})</span><span className="balance-value">{myMonthHours.toFixed(2)} hrs</span></div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <form className="staff-form" onSubmit={handleSubmit}>
          <div style={{ gridColumn: 'span 2', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>⏰ Log Overtime</div>
          
          {isManager && (
            <select value={formDept} onChange={(e) => { setFormDept(e.target.value); setFormStaffId(''); }} required>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}

          {isManager ? (
            <select value={formStaffId} onChange={(e) => setFormStaffId(e.target.value)} required>
              <option value="">Select Staff...</option>
              {formStaffOptions.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.sn})</option>)}
            </select>
          ) : (
            <input value={myStaff ? `${myStaff.name}` : 'Not linked'} disabled />
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Date</label>
            <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
             <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Start / End Time</label>
             <div style={{ display: 'flex', gap: '4px' }}>
               <input type="time" value={formStart} onChange={(e) => setFormStart(e.target.value)} required style={{ flex: 1 }} />
               <input type="time" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} required style={{ flex: 1 }} />
             </div>
          </div>
          
          <input placeholder="Notes (optional)" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} style={{ gridColumn: 'span 2' }} />
          <button type="submit" disabled={submitting} style={{ gridColumn: 'span 2' }}>{submitting ? 'Saving...' : 'Save Entry'}</button>
        </form>
      )}

      {weekKeys.length === 0 ? (
        <div className="staff-list"><div className="empty-state"><p>No OT entries for {monthFilter}.</p></div></div>
      ) : (
        weekKeys.map((weekKey) => {
          const weekEntries = weekMap[weekKey];
          const weekTotal = weekEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
          const isOver = weekTotal >= WEEKLY_THRESHOLD;
          const eligible = Math.max(0, weekTotal - WEEKLY_THRESHOLD);
          return (
            <div key={weekKey} style={{ marginBottom: '20px' }}>
              <div style={{ padding: '12px', borderTopLeftRadius: '8px', borderTopRightRadius: '8px', fontWeight: 700, fontSize: '13px', display: 'flex', justifyContent: 'space-between', backgroundColor: isOver ? '#dcfce7' : '#f1f5f9', color: isOver ? '#065f46' : '#475569' }}>
                <span>Week: {formatDisplay(weekKey)} – {formatDisplay(getWeekEnd(weekKey))}</span>
                <span>Total: {weekTotal.toFixed(2)} hrs {isOver ? `· ✅ Eligible (${eligible.toFixed(2)} OT)` : `· ${(WEEKLY_THRESHOLD - weekTotal).toFixed(2)} hrs to 48`}</span>
              </div>
              <div className="staff-list" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                <table>
                  <thead><tr><th>Date</th><th>Day</th>{isManager && viewMode === 'department' && <th>Staff</th>}<th>Time</th><th>Hours</th><th></th></tr></thead>
                  <tbody>
                    {weekEntries.map((e) => (
                      <tr key={e.id}>
                        <td>{formatDisplay(e.date)}</td>
                        <td>{getDayShort(e.date)}</td>
                        {isManager && viewMode === 'department' && <td><strong>{e.staffName}</strong></td>}
                        <td style={{ fontSize: '12px' }}>{e.startTime} – {e.endTime}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{e.hours}</td>
                        <td><button className="delete-btn" onClick={() => handleDelete(e.id)}>Delete</button></td>
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