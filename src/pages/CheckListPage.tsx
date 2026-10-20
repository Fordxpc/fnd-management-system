import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../auth';
import { toast } from 'sonner';

const CATEGORIES = ['Runway Check', 'FOD Collection', 'RWY Lights Inspection', 'Flight Ops Task'];
const formatDate = (date: Date) => date.toISOString().split('T')[0];

function ChecklistPage() {
  const { profile, user } = useAuth();
  const [checks, setChecks] = useState<any[]>([]);
  const [dateFilter, setDateFilter] = useState(formatDate(new Date()));
  
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [time, setTime] = useState('06:00');
  const [status, setStatus] = useState('Completed - OK');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'ops_checks'), (snap) => {
      setChecks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'ops_checks'), {
        date: dateFilter, category, time, status, remarks,
        checkedBy: user?.email || '',
        createdAt: new Date().toISOString()
      });
      toast.success('Check logged successfully');
      setShowForm(false);
      setRemarks('');
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'ops_checks', id));
      toast.success('Record deleted');
    } catch (err: any) { toast.error(err.message); }
  };

  const visibleChecks = checks.filter(c => c.date === dateFilter).sort((a,b) => a.time.localeCompare(b.time));

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>Daily Operations Checks</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
          <button className="add-staff-btn" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Log Check'}</button>
        </div>
      </div>

      {showForm && (
        <form className="staff-form" onSubmit={handleSubmit}>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} required />
          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option>Completed - OK</option>
            <option>Completed - Action Needed</option>
            <option>Pending</option>
          </select>
          <input placeholder="Remarks (e.g. FOD found, light broken)" value={remarks} onChange={e => setRemarks(e.target.value)} required />
          <button type="submit" style={{ gridColumn: 'span 2' }}>Save Record</button>
        </form>
      )}

      <div className="staff-list">
        {visibleChecks.length === 0 ? <div className="empty-state"><p>No checks logged for {dateFilter}</p></div> : (
          <table>
            <thead><tr><th>Time</th><th>Category</th><th>Status</th><th>Remarks</th><th>Checked By</th><th></th></tr></thead>
            <tbody>
              {visibleChecks.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.time}</strong></td>
                  <td>{c.category}</td>
                  <td><span className={`status-badge ${c.status.includes('Action') ? 'status-pending' : 'status-approved'}`}>{c.status}</span></td>
                  <td>{c.remarks}</td>
                  <td style={{ fontSize: '11px', color: '#64748b' }}>{c.checkedBy}</td>
                  <td><button className="delete-btn" onClick={() => handleDelete(c.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
export default ChecklistPage;