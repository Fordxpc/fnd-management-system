import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import { ConfirmDialog } from '../components/Dialogs';

const AIRCRAFT_OPTIONS = ['DH-8/200', 'DH-8/300', 'ATR-42/600', 'ATR-72/600', 'CUSTOM'];
const FLIGHT_TYPES = ['Scheduled', 'Additional', 'Air Ambulance', 'Cargo', 'Private'];

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
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(formatDate(new Date()));
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

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
  const [remarks, setRemarks] = useState('');

  const fetchFlights = useCallback(async () => {
    try {
      const data = await apiFetch('/flights');
      setFlights(data);
      setLoading(false);
    } catch (err: any) {
      toast.error(err.message);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlights();
    const interval = setInterval(fetchFlights, 15000);
    return () => clearInterval(interval);
  }, [fetchFlights]);

  const resetForm = () => {
    setFlightNo('Q2-'); setType('Scheduled'); setAircraft('DH-8/300');
    setCustomAircraft(''); setBookedFigure(''); setCheckIn('');
    setArrival(''); setDeparture(''); setRoute('MLE/FND/MLE');
    setOriginDep(''); setRemarks('');
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

    // Auto-determine status if creating new. Keep existing if editing.
    const existingFlight = flights.find(f => f.id === editingId);
    const finalStatus = existingFlight ? existingFlight.status : 'Scheduled';

    const payload = {
      date: dateFilter, flightNo, type, aircraft: finalAircraft,
      bookedFigure, checkInTime: checkIn, arrivalTime: arrival, 
      departureTime: departure, route, originDepTime: originDep, 
      status: finalStatus, remarks
    };

    try {
      if (editingId) {
        await apiFetch(`/flights/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        toast.success('Flight updated successfully');
      } else {
        await apiFetch('/flights', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        toast.success('Flight added successfully');
      }
      setShowForm(false);
      resetForm();
      fetchFlights();
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
    setRemarks(f.remarks || '');
    setShowForm(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/flights/${deleteTarget.id}`, { method: 'DELETE' });
      toast.success('Flight deleted');
      setDeleteTarget(null);
      fetchFlights();
    } catch (err: any) { toast.error(err.message); }
  };

  const todayStr = formatDate(new Date());
  const displayStatus = (s: string) => s === 'On Time' ? 'Scheduled' : s;

  const sortedFlights = [...flights].sort((a, b) => {
    const dateCompare = (a.date || '').localeCompare(b.date || '');
    if (dateCompare !== 0) return dateCompare;
    return (a.departureTime || '00:00').localeCompare(b.departureTime || '00:00');
  });

  const completedStatuses = ['Departed', 'Departed (Origin)', 'Landed', 'Cancelled'];
  const upcomingFlights = sortedFlights.filter(f => f.date >= todayStr && !completedStatuses.includes(displayStatus(f.status)));
  const pastFlights = sortedFlights.filter(f => f.date < todayStr || completedStatuses.includes(displayStatus(f.status))).reverse();

  const FlightCard = ({ f }: { f: any }) => (
    <div className="dash-card" style={{ padding: 0, overflow: 'hidden', border: '2px solid #e2e8f0', marginBottom: '16px' }}>
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

      <div className="flight-card-details" style={{ gridTemplateColumns: '1.5fr 1fr 1fr' }}>
        {/* SCHEDULED TIMES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderRight: '1px solid #e2e8f0', paddingRight: '20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Scheduled</div>
          <div><div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>CHECK-IN</div><div style={{ fontSize: '16px', fontWeight: 700 }}>{f.checkInTime || '—'}</div></div>
          <div><div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>ARRIVAL (STA)</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#065f46' }}>{f.arrivalTime || '—'}</div></div>
          <div><div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>DEPARTURE (STD)</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#1d4ed8' }}>{f.departureTime || '—'}</div></div>
        </div>

        {/* ACTUAL TIMES (FROM RAMP SHEET) */}
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '10px', borderRight: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: '#d97706', textTransform: 'uppercase' }}>Live Status</div>
          <div><div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>ETA</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#8b5cf6' }}>{f.eta || '—'}</div></div>
          <div><div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>ARRIVAL (ATA)</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#16a34a' }}>{f.ata || '—'}</div></div>
          <div><div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>DEPARTURE (ATD)</div><div style={{ fontSize: '16px', fontWeight: 700, color: '#dc2626' }}>{f.atd || '—'}</div></div>
        </div>

        {/* ROUTE & STATUS */}
        <div style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>ROUTE</div>
            <div style={{ fontSize: '18px', fontWeight: 900, color: '#1e293b', marginBottom: '12px' }}>{f.route}</div>
            
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>STATUS</div>
            <span className="status-badge" style={{ 
              fontSize: '14px', padding: '6px 12px', 
              background: displayStatus(f.status) === 'Delayed' ? '#fef3c7' : displayStatus(f.status) === 'Cancelled' ? '#fee2e2' : displayStatus(f.status).includes('Departed') || displayStatus(f.status) === 'Landed' ? '#e2e8f0' : displayStatus(f.status) === 'Departed (Origin)' ? '#f3e8ff' : '#dcfce7', 
              color: displayStatus(f.status) === 'Delayed' ? '#92400e' : displayStatus(f.status) === 'Cancelled' ? '#991b1b' : displayStatus(f.status).includes('Departed') || displayStatus(f.status) === 'Landed' ? '#475569' : displayStatus(f.status) === 'Departed (Origin)' ? '#6b21a8' : '#065f46' 
            }}>
              {displayStatus(f.status)}
            </span>
          </div>
          {isManager && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
              <button className="edit-btn" onClick={() => handleEdit(f)}>Edit</button>
              <button className="delete-btn" onClick={() => setDeleteTarget(f)}>Delete</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (loading) return <div className="page-content"><p>Loading Flights...</p></div>;

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
          <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Scheduled Arrival (STA)</label><input type="time" value={arrival} onChange={e => setArrival(e.target.value)} /></div>
          <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Scheduled Departure (STD)</label><input type="time" value={departure} onChange={e => setDeparture(e.target.value)} /></div>

          <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Route</label><input placeholder="MLE/FND/MLE" value={route} onChange={e => setRoute(e.target.value.toUpperCase())} required /></div>

          <button type="submit" style={{ gridColumn: 'span 2', background: editingId ? '#2563eb' : '#16a34a' }}>
            {editingId ? 'Save Changes' : 'Save Flight'}
          </button>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <h3 style={{ color: '#2563eb', borderBottom: '2px solid #bfdbfe', paddingBottom: '8px', marginBottom: '16px' }}>🕒 Upcoming & Active Flights</h3>
          {upcomingFlights.length === 0 ? <div className="empty-state"><p>No upcoming flights.</p></div> : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {upcomingFlights.map((f, index) => {
                const prevFlight = index > 0 ? upcomingFlights[index - 1] : null;
                const showDateHeader = !prevFlight || prevFlight.date !== f.date;
                
                const fDate = new Date(f.date + 'T00:00:00');
                const tDate = new Date(todayStr + 'T00:00:00');
                const diffTime = fDate.getTime() - tDate.getTime();
                const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
                
                let dateLabel = formatDisplayDate(f.date);
                if (diffDays === 0) dateLabel = 'TODAY';
                else if (diffDays === 1) dateLabel = 'TOMORROW';

                return (
                  <div key={f.id}>
                    {showDateHeader && (
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#475569', margin: '16px 0 12px 0', paddingBottom: '4px', borderBottom: '1px dashed #cbd5e1' }}>
                        📅 {dateLabel} ({formatDisplayDate(f.date)})
                      </div>
                    )}
                    <FlightCard f={f} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h3 style={{ color: '#64748b', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px' }}>✅ Past & Departed Flights</h3>
          {pastFlights.length === 0 ? <div className="empty-state"><p>No past flights.</p></div> : (
            <div style={{ display: 'flex', flexDirection: 'column', opacity: 0.8 }}>
              {pastFlights.map((f, index) => {
                const prevFlight = index > 0 ? pastFlights[index - 1] : null;
                const showDateHeader = !prevFlight || prevFlight.date !== f.date;
                return (
                  <div key={f.id}>
                    {showDateHeader && (
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#64748b', margin: '16px 0 12px 0', paddingBottom: '4px', borderBottom: '1px dashed #cbd5e1' }}>
                        📅 {formatDisplayDate(f.date)}
                      </div>
                    )}
                    <FlightCard f={f} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Flight?"
        message={`Are you sure you want to delete flight ${deleteTarget?.flightNo}? This action cannot be undone.`}
        confirmText="Delete"
        isDanger={true}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default FlightsPage;