import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../auth';
import { toast } from 'sonner';

const AIRCRAFT_OPTIONS = ['DH-8/200', 'DH-8/300', 'ATR-42/600', 'ATR-72/600', 'CUSTOM'];
const FLIGHT_TYPES = ['Scheduled', 'Additional', 'Air Ambulance', 'Cargo', 'Private'];
const STATUS_OPTIONS = ['On Time', 'Delayed', 'Boarding', 'Departed', 'Landed', 'Cancelled'];

const formatDate = (date: Date) => date.toISOString().split('T')[0];

const getDayName = (dateStr: string) => {
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return days[new Date(dateStr + 'T00:00:00').getDay()];
};

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

  // Form State
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
  const [status, setStatus] = useState('On Time');
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
    setOriginDep(''); setStatus('On Time'); setRemarks('');
    setEditingId(null);
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!flightNo || flightNo === 'Q2-') {
      toast.error('Please enter a valid Flight Number (e.g., Q2-192)');
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
    setStatus(f.status || 'On Time');
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

  const visibleFlights = flights
    .filter(f => f.date === dateFilter)
    .sort((a, b) => (a.departureTime || '00:00').localeCompare(b.departureTime || '00:00'));

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>Flight Operations</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'inherit' }} />
          {isManager && !showForm && <button className="add-staff-btn" onClick={() => { setShowForm(true); resetForm(); }}>+ Add Flight</button>}
          {showForm && <button className="export-btn pdf-btn" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</button>}
        </div>
      </div>

      {showForm && (
        <form className="staff-form" onSubmit={handleSubmit} style={{ marginBottom: '24px' }}>
          <div style={{ gridColumn: 'span 2', fontWeight: 700, color: '#1e293b', fontSize: '15px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '8px' }}>
            {editingId ? '✏️ Edit Flight Details' : '➕ Add New Flight'}
          </div>

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

          {aircraft === 'CUSTOM' ? (
            <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#dc2626' }}>Custom Aircraft *</label><input placeholder="e.g. B737-800" value={customAircraft} onChange={e => setCustomAircraft(e.target.value)} required /></div>
          ) : (
            <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Booked Figure</label><input placeholder="e.g. 29+0" value={bookedFigure} onChange={e => setBookedFigure(e.target.value)} /></div>
          )}

          <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Check-in Time</label><input type="time" value={checkIn} onChange={e => setCheckIn(e.target.value)} /></div>
          <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Arrival Time (FND)</label><input type="time" value={arrival} onChange={e => setArrival(e.target.value)} /></div>
          <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Departure Time (FND)</label><input type="time" value={departure} onChange={e => setDeparture(e.target.value)} /></div>
          <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Origin Dep. Time (e.g. MLE)</label><input type="time" value={originDep} onChange={e => setOriginDep(e.target.value)} /></div>

          <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Route (Use / for transit)</label><input placeholder="MLE/FND/MLE" value={route} onChange={e => setRoute(e.target.value.toUpperCase())} required /></div>
          
          <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <input placeholder="Remarks" value={remarks} onChange={e => setRemarks(e.target.value)} style={{ gridColumn: 'span 2' }} />
          
          <button type="submit" style={{ gridColumn: 'span 2', background: editingId ? '#2563eb' : '#16a34a' }}>
            {editingId ? 'Save Changes' : 'Save Flight'}
          </button>
        </form>
      )}

      {visibleFlights.length === 0 ? (
        <div className="empty-state">
          <p>No flights scheduled for {formatDisplayDate(dateFilter)} ({getDayName(dateFilter)}).</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div className="dash-card" style={{ padding: '16px 24px', textAlign: 'center', background: '#f8fafc' }}>
            <h3 style={{ margin: 0, color: '#1e293b' }}>FLIGHT SCHEDULE — {formatDisplayDate(dateFilter)}</h3>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px', fontWeight: 700, letterSpacing: '1px' }}>{getDayName(dateFilter)}</p>
          </div>

          {visibleFlights.map(f => (
            <div key={f.id} className="dash-card" style={{ padding: 0, overflow: 'hidden', border: '2px solid #e2e8f0' }}>
              <div style={{ background: f.type === 'Air Ambulance' ? '#fef2f2' : f.type === 'Additional' ? '#fef3c7' : '#eff6ff', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '22px', color: f.type === 'Air Ambulance' ? '#991b1b' : f.type === 'Additional' ? '#92400e' : '#1e40af' }}>{f.flightNo}</h3>
                  <span style={{ background: 'white', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, border: '1px solid #cbd5e1' }}>{f.aircraft}</span>
                  <span style={{ background: f.type === 'Air Ambulance' ? '#dc2626' : f.type === 'Additional' ? '#f59e0b' : '#2563eb', color: 'white', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>{f.type}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>BOOKED</div>
                  <div style={{ fontSize: '16px', fontWeight: 800 }}>{f.bookedFigure || '—'}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', padding: '20px' }}>
                
                {/* Times */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderRight: '1px solid #e2e8f0', paddingRight: '20px' }}>
                  <div><div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px' }}>CHECK-IN</div><div style={{ fontSize: '16px', fontWeight: 700 }}>{f.checkInTime || '—'}</div></div>
                  <div><div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px' }}>ARRIVAL</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#065f46' }}>{f.arrivalTime || '—'}</div></div>
                  <div><div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, letterSpacing: '0.5px' }}>DEPARTURE</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#1d4ed8' }}>{f.departureTime || '—'}</div></div>
                </div>

                {/* Route */}
                <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, letterSpacing: '1px', marginBottom: '8px' }}>ROUTE</div>
                  <div style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '2px', color: '#1e293b' }}>{f.route}</div>
                  {f.originDepTime && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px', fontWeight: 600 }}>Origin Dep: {f.originDepTime}</div>}
                </div>

                {/* Status & Actions */}
                <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, letterSpacing: '1px', marginBottom: '4px' }}>STATUS</div>
                    <span className="status-badge status-approved" style={{ fontSize: '14px', padding: '6px 12px', background: f.status === 'Delayed' ? '#fef3c7' : f.status === 'Cancelled' ? '#fee2e2' : '#dcfce7', color: f.status === 'Delayed' ? '#92400e' : f.status === 'Cancelled' ? '#991b1b' : '#065f46' }}>{f.status}</span>
                  </div>
                  {f.remarks && <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', textAlign: 'right' }}>{f.remarks}</div>}
                  {isManager && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <button className="edit-btn" onClick={() => handleEdit(f)}>Edit</button>
                      <button className="delete-btn" onClick={() => handleDelete(f.id)}>Delete</button>
                    </div>
                  )}
                </div>

              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export default FlightsPage;