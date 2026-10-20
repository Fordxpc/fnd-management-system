import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../auth';
import { toast } from 'sonner';

const formatDate = (date: Date) => date.toISOString().split('T')[0];

function FlightsPage() {
  const { profile } = useAuth();
  const isManager = ['developer', 'manager', 'owner', 'admin', 'smt'].includes(profile?.role || '');
  
  const [flights, setFlights] = useState<any[]>([]);
  const [dateFilter, setDateFilter] = useState(formatDate(new Date()));
  
  const [showForm, setShowForm] = useState(false);
  const [flightNo, setFlightNo] = useState('');
  const [type, setType] = useState('Scheduled');
  const [origin, setOrigin] = useState('');
  const [dest, setDest] = useState('FND');
  const [time, setTime] = useState('12:00');
  const [status, setStatus] = useState('On Time');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'flights'), (snap) => {
      setFlights(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'flights'), {
        date: dateFilter, flightNo, type, origin, dest, time, status, remarks,
        createdAt: new Date().toISOString()
      });
      toast.success('Flight added successfully');
      setShowForm(false);
      setFlightNo(''); setRemarks('');
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this flight?')) {
      await deleteDoc(doc(db, 'flights', id));
      toast.success('Flight deleted');
    }
  };

  const visibleFlights = flights.filter(f => f.date === dateFilter).sort((a,b) => a.time.localeCompare(b.time));

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>Flight Operations</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
          {isManager && <button className="add-staff-btn" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Add Flight'}</button>}
        </div>
      </div>

      {showForm && (
        <form className="staff-form" onSubmit={handleSubmit}>
          <input placeholder="Flight No (e.g. Q2-301)" value={flightNo} onChange={e => setFlightNo(e.target.value)} required />
          <select value={type} onChange={e => setType(e.target.value)}>
            <option>Scheduled</option>
            <option>Additional</option>
            <option>Air Ambulance</option>
          </select>
          <input placeholder="Origin (e.g. MLE)" value={origin} onChange={e => setOrigin(e.target.value)} required />
          <input placeholder="Destination (e.g. FND)" value={dest} onChange={e => setDest(e.target.value)} required />
          <input type="time" value={time} onChange={e => setTime(e.target.value)} required />
          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option>On Time</option>
            <option>Delayed</option>
            <option>Landed</option>
            <option>Departed</option>
            <option>Cancelled</option>
          </select>
          <input placeholder="Remarks" value={remarks} onChange={e => setRemarks(e.target.value)} style={{ gridColumn: 'span 2' }} />
          <button type="submit" style={{ gridColumn: 'span 2' }}>Save Flight</button>
        </form>
      )}

      <div className="staff-list">
        {visibleFlights.length === 0 ? <div className="empty-state"><p>No flights for {dateFilter}</p></div> : (
          <table>
            <thead><tr><th>Time</th><th>Flight</th><th>Type</th><th>Route</th><th>Status</th><th>Remarks</th><th></th></tr></thead>
            <tbody>
              {visibleFlights.map(f => (
                <tr key={f.id}>
                  <td><strong>{f.time}</strong></td>
                  <td>{f.flightNo}</td>
                  <td><span className="status-badge" style={{ background: f.type === 'Air Ambulance' ? '#fee2e2' : '#eff6ff', color: f.type === 'Air Ambulance' ? '#991b1b' : '#1e40af' }}>{f.type}</span></td>
                  <td>{f.origin} ✈️ {f.dest}</td>
                  <td><span className="status-badge status-approved">{f.status}</span></td>
                  <td>{f.remarks || '—'}</td>
                  <td>{isManager && <button className="delete-btn" onClick={() => handleDelete(f.id)}>Delete</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
export default FlightsPage;