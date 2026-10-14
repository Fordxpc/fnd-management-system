import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy } from 'firebase/firestore';

function RosterPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const shifts = [
    { code: 'M', name: 'Morning', time: '06:00 - 14:00' },
    { code: 'A', name: 'Afternoon', time: '14:00 - 22:00' },
    { code: 'N', name: 'Night', time: '22:00 - 06:00' },
    { code: 'OFF', name: 'Day Off', time: 'Rest Day' },
  ];

  const [showForm, setShowForm] = useState(false);
  const [staffId, setStaffId] = useState('');
  const [shiftCode, setShiftCode] = useState('M');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const unsubStaff = onSnapshot(collection(db, 'staff'), (snapshot) => {
      setStaff(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const unsubRoster = onSnapshot(
      query(collection(db, 'roster_entries'), orderBy('date', 'desc')),
      (snapshot) => {
        setEntries(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    );

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
    const shift = shifts.find((s) => s.code === shiftCode);

    try {
      await addDoc(collection(db, 'roster_entries'), {
        staffId,
        staffName: staffMember?.name || 'Unknown',
        shiftCode,
        shiftName: shift?.name || '',
        shiftTime: shift?.time || '',
        date,
        notes,
        status: 'scheduled',
        createdAt: new Date().toISOString(),
      });
      setNotes('');
      setShowForm(false);
      alert('Roster entry added!');
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this roster entry?')) return;
    await deleteDoc(doc(db, 'roster_entries', id));
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
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <select value={shiftCode} onChange={(e) => setShiftCode(e.target.value)}>
            {shifts.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name} ({s.time})
              </option>
            ))}
          </select>

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />

          <input
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <button type="submit">Save Assignment</button>
        </form>
      )}

      <div className="staff-list">
        {entries.length === 0 ? (
          <div className="empty-state">
            <p>No shifts assigned yet. Click "+ Assign Shift" to get started.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Staff</th>
                <th>Shift</th>
                <th>Time</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{e.date}</td>
                  <td><strong>{e.staffName}</strong></td>
                  <td>{e.shiftName}</td>
                  <td>{e.shiftTime}</td>
                  <td>{e.notes || '—'}</td>
                  <td>
                    <button className="delete-btn" onClick={() => handleDelete(e.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default RosterPage;