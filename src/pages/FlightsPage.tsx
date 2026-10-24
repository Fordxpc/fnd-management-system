import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../auth';
import { toast } from 'sonner';

const AIRCRAFT_OPTIONS = ['DH-8/200', 'DH-8/300', 'ATR-42/600', 'ATR-72/600', 'CUSTOM'];
const FLIGHT_TYPES = ['Scheduled', 'Additional', 'Air Ambulance', 'Cargo', 'Private'];
const STATUS_OPTIONS = ['Scheduled', 'Delayed', 'Boarding', 'Departed', 'Landed', 'Cancelled'];

const formatDate = (date: Date) => date.toISOString().split('T')[0];
const formatDisplayDate = (dateStr: string) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${d}${months[parseInt(m) - 1]}${y}`;
};

function FlightsPage() {
  const { profile } = useAuth();
  const isManager = ['developer', 'manager', 'owner', 'admin', 'smt'].includes(profile?.role || '');
  
  const [flights, setFlights] = useState<any[]>([]);
  const [dateFilter, setDateFilter] = useState(formatDate(new Date()));
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [flightNo, setFlightNo] = useState('Q2-');
  const [type, setType] = useState('Scheduled');
  const [aircraft, setAircraft] = useState('DH-8/300');
  const [customAircraft, setCustomAircraft] = useState('');
  const [bookedFigure, setBookedFigure] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [arrival, setArrival] = useState('');
  const [departure, setDeparture] = useState('');
  const [route, setRoute] = useState('MLE/FND/MLE');
  const [originDep, setOriginDep] = useState('');
  const [status, setStatus] = useState('Scheduled'); // Changed from 'On Time'
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'flights'), (snap) => {
      setFlights(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const resetForm = () => {
    setFlightNo('Q2-'); setType('Scheduled'); setAircraft('DH-8/300');
    setCustomAircraft(''); setBookedFigure(''); setCheckIn('');
    setArrival(''); setDeparture(''); setRoute('MLE/FND/MLE');
    setOriginDep(''); setStatus('Scheduled'); setRemarks('');
    setEditingId(null);
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!flightNo || flightNo === 'Q2-') {
      toast.error('Please enter a valid Flight Number');
      return;
    }
    
    const finalAircraft = aircraft === 'CUSTOM' ? customAircraft : aircraft;
    if (!finalAircraft) {
      toast.error('Please enter the custom aircraft type');
      return;
    }

    try {
      const payload = {
        date: dateFilter, flightNo, type, aircraft: finalAircraft,
        bookedFigure, checkInTime: checkIn, arrivalTime: arrival, 
        departureTime: departure, route, originDepTime: originDep, 
        status, remarks, updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await updateDoc(doc(db, 'flights', editingId), payload);
        toast.success('Flight updated successfully');
      } else {
        await addDoc(collection(db, 'flights'), { ...payload, createdAt: new Date().toISOString() });
        toast.success('Flight added successfully');
      }
      setShowForm(false);
      resetForm();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleEdit = (f: any) => {
    setEditingId(f.id);
    setFlightNo(f.flightNo || 'Q2-');
    setType(f.type || 'Scheduled');
    setDateFilter(f.date || formatDate(new Date()));
    
    if (AIRCRAFT_OPTIONS.includes(f.aircraft)) {
      setAircraft(f.aircraft);
      setCustomAircraft('');
    } else {
      setAircraft('CUSTOM');
      setCustomAircraft(f.aircraft || '');
    }
    
    setBookedFigure(f.bookedFigure || '');
    setCheckIn(f.checkInTime || '');
    setArrival(f.arrivalTime || '');
    setDeparture(f.departureTime || '');
    setRoute(f.route || '');
    setOriginDep(f.originDepTime || '');
    setStatus(f.status || 'Scheduled');
    setRemarks(f.remarks || '');
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this flight?')) {
      try {
        await deleteDoc(doc(db, 'flights', id));
        toast.success('Flight deleted');
      } catch (err: any) { toast.error(err.message); }
    }
  };

  const todayStr = formatDate(new Date());
  
  const sortedFlights = [...flights].sort((a, b) => {
    const dateCompare = (a.date || '').localeCompare(b.date || '');
    if (dateCompare !== 0) return dateCompare;
    return (a.departureTime || '00:00').localeCompare(b.departureTime || '00:00');
  });

  const completedStatuses = ['Departed', 'Landed', 'Cancelled'];
  const upcomingFlights = sortedFlights.filter(f => f.date >= todayStr && !completedStatuses.includes(f.status));
  const pastFlights = sortedFlights.filter(f => f.date < todayStr || completedStatuses.includes(f.status)).reverse();

  const FlightCard = ({ f }: { f: any }) => (
    <div className="dash-card" style={{ padding: 0, overflow: 'hidden', border: '2px solid #e2e8f0' }}>
      <div style={{ background: f.type === 'Air Ambulance' ? '#fef2f2' : f.type === 'Additional' ? '#fef3c7' : '#eff6ff', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '22px', color: f.type === 'Air Ambulance' ? '#991b1b' : f.type === 'Additional' ? '#92400e' : '#1e40af' }}>{f.flightNo}</h3>
          <span style={{ background: 'white', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, border: '1px solid #cbd5e1' }}>{f.aircraft}</span>
          <span style={{ background: f.type === 'Air Ambulance' ? '#dc2626' : f.type === 'Additional' ? '#f59e0b' : '#2563eb', color: 'white', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>{f.type}</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>DATE</div>
          <div style={{ fontSize: '16px', fontWeight: 800 }}>{formatDisplayDate(f.date)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', padding: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderRight: '1px solid #e2e8f0', paddingRight: '20px' }}>
          <div><div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>CHECK-IN</div><div style={{ fontSize: '16px', fontWeight: 700 }}>{f.checkInTime || '—'}</div></div>
          <div><div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>ARRIVAL</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#065f46' }}>{f.arrivalTime || '—'}</div></div>
          <div><div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>DEPARTURE</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#1d4ed8' }}>{f.departureTime || '—'}</div></div>
        </div>

        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, marginBottom: '8px' }}>ROUTE</div>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#1e293b' }}>{f.route}</div>
        </div>

        <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>STATUS</div>
            <span className="status-badge" style={{ fontSize: '14px', padding: '6px 12px', background: f.status === 'Delayed' ? '#fef3c7' : f.status === 'Cancelled' ? '#fee2e2' : f.status === 'Departed' || f.status === 'Landed' ? '#e2e8f0' : '#dcfce7', color: f.status === 'Delayed' ? '#92400e' : f.status === 'Cancelled' ? '#991b1b' : f.status === 'Departed' || f.status === 'Landed' ? '#475569' : '#065f46' }}>{f.status}</span>
          </div>
          {isManager && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button className="edit-btn" onClick={() => handleEdit(f)}>Edit</button>
              <button className="delete-btn" onClick={() => handleDelete(f.id)}>Delete</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>Flight Operations</h2>
        {isManager && !showForm && <button className="add-staff-btn" onClick={() => { setShowForm(true); resetForm(); }}>+ Add Flight</button>}
        {showForm && <button className="export-btn pdf-btn" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</button>}
      </div>

      {showForm && (
        <form className="staff-form" onSubmit={handleSubmit} style={{ marginBottom: '24px' }}>
          <div style={{ gridColumn: 'span 2', fontWeight: 700, color: '#1e293b', fontSize: '15px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '8px' }}>
            {editingId ? '✏️ Edit Flight Details' : '➕ Add New Flight'}
          </div>

          <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Date *</label><input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} required /></div>
          <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Flight No. *</label><input placeholder="Q2-192" value={flightNo} onChange={e => setFlightNo(e.target.value.toUpperCase())} required /></div>
          
          <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Type</label>
            <select value={type} onChange={e => setType(e.target.value)}>
              {FLIGHT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Aircraft Type</label>
            <select value={aircraft} onChange={e => setAircraft(e.target.value)}>
              {AIRCRAFT_OPTIONS.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>

          {aircraft === 'CUSTOM' && <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626' }}>Custom Aircraft *</label><input placeholder="e.g. B737-800" value={customAircraft} onChange={e => setCustomAircraft(e.target.value)} required /></div>}

          <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Check-in Time</label><input type="time" value={checkIn} onChange={e => setCheckIn(e.target.value)} /></div>
          <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Arrival Time (FND)</label><input type="time" value={arrival} onChange={e => setArrival(e.target.value)} /></div>
          <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Departure Time (FND)</label><input type="time" value={departure} onChange={e => setDeparture(e.target.value)} /></div>

          <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Route</label><input placeholder="MLE/FND/MLE" value={route} onChange={e => setRoute(e.target.value.toUpperCase())} required /></div>
          
          <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <button type="submit" style={{ gridColumn: 'span 2', background: editingId ? '#2563eb' : '#16a34a' }}>
            {editingId ? 'Save Changes' : 'Save Flight'}
          </button>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <h3 style={{ color: '#2563eb', borderBottom: '2px solid #bfdbfe', paddingBottom: '8px', marginBottom: '16px' }}>🕒 Upcoming & Active Flights</h3>
          {upcomingFlights.length === 0 ? <div className="empty-state"><p>No upcoming flights.</p></div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {upcomingFlights.map(f => <FlightCard key={f.id} f={f} />)}
            </div>
          )}
        </div>

        <div>
          <h3 style={{ color: '#64748b', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px' }}>✅ Past & Departed Flights</h3>
          {pastFlights.length === 0 ? <div className="empty-state"><p>No past flights.</p></div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', opacity: 0.8 }}>
              {pastFlights.map(f => <FlightCard key={f.id} f={f} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FlightsPage;