import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';

// Helper to format date as YYYY-MM-DD
const formatDate = (date: Date) => date.toISOString().split('T')[0];

// Helper to get the start of the week (Sunday)
const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
};

const SHIFT_OPTIONS = [
  '06:00 - 14:00',
  '08:00 - 16:00',
  '16:00 - 00:00',
  '00:00 - 08:00',
  'CUSTOM'
];

const LEAVE_OPTIONS = [
  'OFF DAY',
  'ANNUAL LEAVE',
  'SICK LEAVE',
  'SICK LEAVE / MC',
  'PATERNITY LEAVE',
  'MATERNITY LEAVE',
  'FAMILY RESPONSIBILITY LEAVE (FRL)'
];

function RosterPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));
  
  const [showForm, setShowForm] = useState(false);
  const [staffId, setStaffId] = useState('');
  const [date, setDate] = useState(formatDate(new Date()));
  const [shiftTime, setShiftTime] = useState('06:00 - 14:00');
  const [customShift, setCustomShift] = useState('');
  const [status, setStatus] = useState('scheduled'); 

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + i);
    return formatDate(d);
  });

  useEffect(() => {
    const unsubStaff = onSnapshot(collection(db, 'staff'), (snapshot) => {
      setStaff(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubRoster = onSnapshot(collection(db, 'roster_entries'), (snapshot) => {
      setEntries(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubStaff();
      unsubRoster();
    };
  }, []);

  const handleAdd = async (e: any) => {
    e.preventDefault();
    if (!staffId) {
      alert('Please select a staff member');
      return;
    }
    const staffMember = staff.find((s) => s.id === staffId);

    // Figure out what to save
    let finalShiftTime = '';
    if (status === 'scheduled') {
      finalShiftTime = shiftTime === 'CUSTOM' ? customShift : shiftTime;
      if (!finalShiftTime) {
        alert('Please enter the custom shift time');
        return;
      }
    }

    try {
      await addDoc(collection(db, 'roster_entries'), {
        staffId,
        staffName: staffMember?.name || 'Unknown',
        date,
        shiftTime: finalShiftTime,
        status: status === 'scheduled' ? 'scheduled' : status, 
        createdAt: new Date().toISOString(),
      });
      setShowForm(false);
      setCustomShift('');
      alert('Roster entry added!');
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const changeWeek = (direction: number) => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + direction * 7);
    setCurrentWeekStart(newDate);
  };

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>Duty Roster</h2>
        <button className="add-staff-btn" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Assign Shift'}
        </button>
      </div>

      {showForm && (
        <form className="staff-form" onSubmit={handleAdd}>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} required>
            <option value="">Select Staff Member...</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.sn || 'No SN'})</option>
            ))}
          </select>

          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />

          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="scheduled">Scheduled Shift</option>
            {LEAVE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>

          {status === 'scheduled' && (
            <>
              <select value={shiftTime} onChange={(e) => setShiftTime(e.target.value)}>
                {SHIFT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              {shiftTime === 'CUSTOM' && (
                <input 
                  placeholder="Enter custom time (e.g. 07:00 - 15:00)" 
                  value={customShift} 
                  onChange={(e) => setCustomShift(e.target.value)} 
                  required 
                />
              )}
            </>
          )}

          <button type="submit">Save Entry</button>
        </form>
      )}

      <div className="week-nav">
        <button onClick={() => changeWeek(-1)}>← Previous Week</button>
        <span>{weekDates[0]} to {weekDates[6]}</span>
        <button onClick={() => changeWeek(1)}>Next Week →</button>
      </div>

      <div className="roster-grid-container">
        <table className="roster-grid">
          <thead>
            <tr>
              <th className="sticky-col">SN No.</th>
              <th className="sticky-col-name">NAME</th>
              {weekDates.map((d) => (
                <th key={d}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '20px' }}>
                  No staff members found. Add staff first.
                </td>
              </tr>
            ) : (
              staff.map((s) => (
                <tr key={s.id}>
                  <td className="sticky-col">{s.sn || '—'}</td>
                  <td className="sticky-col-name"><strong>{s.name}</strong></td>
                  {weekDates.map((d) => {
                    const entry = entries.find((e) => e.staffId === s.id && e.date === d);
                    
                    let displayValue = '—';
                    let cellClass = 'empty-cell';
                    
                    if (entry) {
                      displayValue = entry.status === 'scheduled' ? entry.shiftTime : entry.status;
                      if (entry.status === 'OFF DAY') {
                        cellClass = 'off-day-cell';
                      } else if (entry.status && entry.status !== 'scheduled') {
                        cellClass = 'leave-cell';
                      } else {
                        cellClass = 'shift-cell';
                      }
                    }

                    return (
                      <td key={d} className={cellClass}>
                        {displayValue}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RosterPage;