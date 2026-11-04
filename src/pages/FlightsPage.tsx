import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../auth';
import { ConfirmDialog } from '../components/Dialogs';
import { apiFetch } from '../lib/api';
import { canEditFlights, canViewFlights } from '../lib/permissions';

const AIRCRAFT_OPTIONS = ['DH-8/200', 'DH-8/300', 'ATR-42/600', 'ATR-72/600', 'CUSTOM'];
const FLIGHT_TYPES = ['Scheduled', 'Additional', 'Air Ambulance', 'Cargo', 'Private'];
const FLIGHT_STATUSES = ['Scheduled', 'Delayed', 'Departed (Origin)', 'Landed', 'Departed', 'Completed', 'Cancelled'];
const INITIAL_DATE = new Date().toISOString().split('T')[0];
const CLOSED_STATUSES = new Set(['departed', 'completed', 'cancelled']);

type Flight = {
  id: string;
  date?: string;
  flightNo?: string;
  type?: string;
  aircraft?: string;
  paxAdults?: number;
  paxInfants?: number;
  checkInTime?: string;
  arrivalTime?: string;
  departureTime?: string;
  originDepTime?: string;
  eta?: string;
  ata?: string;
  atd?: string;
  route?: string;
  status?: string;
  remarks?: string;
};

const displayStatus = (status?: string) => status === 'On Time' || !status ? 'Scheduled' : status;
const statusClass = (status?: string) => displayStatus(status).toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
const formatDisplayDate = (date?: string) => {
  if (!date) return 'Date not set';
  const value = new Date(`${date}T00:00:00`);
  if (Number.isNaN(value.getTime())) return date;
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(value);
};
const primaryTime = (flight: Flight) => flight.arrivalTime || flight.departureTime || '23:59';
const isClosedFlight = (flight: Flight) => Boolean(flight.atd) || (flight.date || '') < INITIAL_DATE || CLOSED_STATUSES.has(displayStatus(flight.status).toLowerCase());

function FlightCard({ flight, canEdit, onEdit, onDelete }: { flight: Flight; canEdit: boolean; onEdit: (flight: Flight) => void; onDelete: (flight: Flight) => void }) {
  return (
    <article className={`flight-schedule-card flight-schedule-card--${(flight.type || 'scheduled').toLowerCase().replace(/[^a-z]+/g, '-')}`}>
      <header className="flight-schedule-card__header">
        <div>
          <div className="flight-schedule-card__eyebrow">{flight.type || 'Scheduled'} service</div>
          <div className="flight-schedule-card__identity">
            <h3>{flight.flightNo || 'Unnumbered flight'}</h3>
            <span>{flight.aircraft || 'Aircraft TBC'}</span>
          </div>
        </div>
        <span className={`flight-status flight-status--${statusClass(flight.status)}`}>{displayStatus(flight.status)}</span>
      </header>

      <div className="flight-schedule-card__body">
        <section className="flight-schedule-route">
          <span>Route</span>
          <strong>{flight.route || 'Route TBC'}</strong>
          <small>{formatDisplayDate(flight.date)}</small>
        </section>
        <section className="flight-schedule-times" aria-label="Scheduled times">
          <div><span>Check-in</span><strong>{flight.checkInTime || '—'}</strong></div>
          <div><span>Arrival</span><strong>{flight.arrivalTime || '—'}</strong></div>
          <div><span>Departure</span><strong>{flight.departureTime || '—'}</strong></div>
        </section>
        <section className="flight-schedule-live" aria-label="Live movement times">
          <div><span>MLE departure</span><strong>{flight.originDepTime || '—'}</strong></div>
          <div><span>ETA / ATA</span><strong>{flight.eta || '—'} / {flight.ata || '—'}</strong></div>
          <div><span>ATD</span><strong>{flight.atd || '—'}</strong></div>
        </section>
        <section className="flight-schedule-pax">
          <span>Booked passengers</span>
          <strong>{flight.paxAdults || 0} <small>adult</small> · {flight.paxInfants || 0} <small>infant</small></strong>
          {flight.remarks && <p>{flight.remarks}</p>}
        </section>
      </div>

      {canEdit && (
        <footer className="flight-schedule-card__actions">
          <button type="button" className="flight-secondary-button" onClick={() => onEdit(flight)}>Edit flight</button>
          <button type="button" className="flight-danger-button" onClick={() => onDelete(flight)}>Delete</button>
        </footer>
      )}
    </article>
  );
}

function FlightsPage() {
  const { profile, user } = useAuth();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [myStaff, setMyStaff] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Flight | null>(null);
  const [view, setView] = useState<'active' | 'history'>('active');
  const [search, setSearch] = useState('');

  const [flightDate, setFlightDate] = useState(INITIAL_DATE);
  const [flightNo, setFlightNo] = useState('Q2-');
  const [type, setType] = useState('Scheduled');
  const [aircraft, setAircraft] = useState('DH-8/300');
  const [customAircraft, setCustomAircraft] = useState('');
  const [paxAdults, setPaxAdults] = useState('');
  const [paxInfants, setPaxInfants] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [arrival, setArrival] = useState('');
  const [departure, setDeparture] = useState('');
  const [route, setRoute] = useState('MLE/FND/MLE');
  const [originDep, setOriginDep] = useState('');
  const [status, setStatus] = useState('Scheduled');
  const [remarks, setRemarks] = useState('');

  const fetchFlights = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const [flightsData, staffData] = await Promise.all([
        apiFetch('/flights'),
        apiFetch('/staff').catch(() => []),
      ]);
      setFlights(Array.isArray(flightsData) ? flightsData : []);
      const myEmail = String(profile?.email || user?.email || '').toLowerCase();
      setMyStaff(Array.isArray(staffData) ? staffData.find((member: any) => String(member.email || '').toLowerCase() === myEmail) || null : null);
      setLoadError('');
    } catch (error: any) {
      setLoadError(error.message || 'Flight information could not be loaded.');
      if (!quiet) toast.error(error.message || 'Flight information could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, user]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void fetchFlights(true), 0);
    const interval = window.setInterval(() => void fetchFlights(true), 15000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [fetchFlights]);

  const canView = canViewFlights(profile, myStaff);
  const canEdit = canEditFlights(profile, myStaff);

  const resetForm = () => {
    setEditingId(null);
    setFlightDate(INITIAL_DATE);
    setFlightNo('Q2-');
    setType('Scheduled');
    setAircraft('DH-8/300');
    setCustomAircraft('');
    setPaxAdults('');
    setPaxInfants('');
    setCheckIn('');
    setArrival('');
    setDeparture('');
    setRoute('MLE/FND/MLE');
    setOriginDep('');
    setStatus('Scheduled');
    setRemarks('');
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  const handleEdit = (flight: Flight) => {
    setEditingId(flight.id);
    setFlightDate(flight.date || INITIAL_DATE);
    setFlightNo(flight.flightNo || 'Q2-');
    setType(flight.type || 'Scheduled');
    if (AIRCRAFT_OPTIONS.includes(flight.aircraft || '')) {
      setAircraft(flight.aircraft || 'DH-8/300');
      setCustomAircraft('');
    } else {
      setAircraft('CUSTOM');
      setCustomAircraft(flight.aircraft || '');
    }
    setPaxAdults(flight.paxAdults ? String(flight.paxAdults) : '');
    setPaxInfants(flight.paxInfants ? String(flight.paxInfants) : '');
    setCheckIn(flight.checkInTime || '');
    setArrival(flight.arrivalTime || '');
    setDeparture(flight.departureTime || '');
    setRoute(flight.route || '');
    setOriginDep(flight.originDepTime || '');
    setStatus(displayStatus(flight.status));
    setRemarks(flight.remarks || '');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const finalAircraft = aircraft === 'CUSTOM' ? customAircraft.trim() : aircraft;
    if (!flightNo.trim() || flightNo.trim() === 'Q2-') return toast.error('Enter a valid flight number.');
    if (!finalAircraft) return toast.error('Enter the aircraft type.');

    setSaving(true);
    try {
      const payload = {
        date: flightDate,
        flightNo: flightNo.trim().toUpperCase(),
        type,
        aircraft: finalAircraft,
        paxAdults: Number(paxAdults) || 0,
        paxInfants: Number(paxInfants) || 0,
        checkInTime: checkIn,
        arrivalTime: arrival,
        departureTime: departure,
        route: route.trim().toUpperCase(),
        originDepTime: originDep,
        status,
        remarks: remarks.trim(),
      };
      await apiFetch(editingId ? `/flights/${editingId}` : '/flights', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      toast.success(editingId ? 'Flight updated successfully.' : 'Flight added successfully.');
      closeForm();
      await fetchFlights(true);
    } catch (error: any) {
      toast.error(error.message || 'The flight could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/flights/${deleteTarget.id}`, { method: 'DELETE' });
      toast.success('Flight deleted.');
      setDeleteTarget(null);
      await fetchFlights(true);
    } catch (error: any) {
      toast.error(error.message || 'The flight could not be deleted.');
    }
  };

  const { activeFlights, historyFlights } = useMemo(() => {
    const ordered = [...flights].sort((a, b) => `${a.date || ''} ${primaryTime(a)}`.localeCompare(`${b.date || ''} ${primaryTime(b)}`));
    return {
      activeFlights: ordered.filter((flight) => !isClosedFlight(flight)),
      historyFlights: ordered.filter(isClosedFlight).reverse(),
    };
  }, [flights]);

  const displayedFlights = (view === 'active' ? activeFlights : historyFlights).filter((flight) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [flight.flightNo, flight.route, flight.aircraft, flight.type, flight.status].some((value) => String(value || '').toLowerCase().includes(query));
  });

  const todayCount = activeFlights.filter((flight) => flight.date === INITIAL_DATE).length;
  const delayedCount = activeFlights.filter((flight) => displayStatus(flight.status) === 'Delayed').length;

  if (loading) return <div className="page-content"><div className="flight-schedule-loading">Loading flight operations…</div></div>;
  if (!canView) return <div className="page-content"><div className="empty-state"><p>No access to Flight Operations.</p></div></div>;

  return (
    <div className="page-content flight-schedule-page">
      <header className="flight-schedule-hero">
        <div>
          <span className="flight-schedule-kicker">Airside operations</span>
          <h2>Flight Schedule</h2>
          <p>Plan arrivals and departures, track movement times, and keep passenger figures current.</p>
        </div>
        <div className="flight-schedule-hero__actions">
          <button type="button" className="flight-secondary-button" onClick={() => void fetchFlights()} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
          {canEdit && <button type="button" className="flight-primary-button" onClick={showForm ? closeForm : openCreate}>{showForm ? 'Close form' : 'Add flight'}</button>}
        </div>
      </header>

      {loadError && <div className="flight-schedule-alert" role="alert"><strong>Flight data may be out of date.</strong><span>{loadError}</span></div>}

      <section className="flight-schedule-summary" aria-label="Flight summary">
        <div><span>Active schedule</span><strong>{activeFlights.length}</strong><small>upcoming flights</small></div>
        <div><span>Today</span><strong>{todayCount}</strong><small>movements scheduled</small></div>
        <div><span>Attention</span><strong>{delayedCount}</strong><small>delayed flights</small></div>
        <div><span>Completed</span><strong>{historyFlights.length}</strong><small>history records</small></div>
      </section>

      {showForm && (
        <form className="flight-schedule-form" onSubmit={handleSubmit}>
          <div className="flight-schedule-form__heading">
            <div><span>{editingId ? 'Update operation' : 'New operation'}</span><h3>{editingId ? `Edit ${flightNo}` : 'Add a flight'}</h3></div>
            <button type="button" onClick={closeForm} aria-label="Close flight form">×</button>
          </div>
          <div className="flight-schedule-form__grid">
            <label>Date *<input type="date" value={flightDate} onChange={(event) => setFlightDate(event.target.value)} required /></label>
            <label>Flight number *<input value={flightNo} onChange={(event) => setFlightNo(event.target.value.toUpperCase())} placeholder="Q2-192" required /></label>
            <label>Service type<select value={type} onChange={(event) => setType(event.target.value)}>{FLIGHT_TYPES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Aircraft<select value={aircraft} onChange={(event) => setAircraft(event.target.value)}>{AIRCRAFT_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></label>
            {aircraft === 'CUSTOM' && <label>Custom aircraft *<input value={customAircraft} onChange={(event) => setCustomAircraft(event.target.value.toUpperCase())} placeholder="B737-800" required /></label>}
            <label>Route *<input value={route} onChange={(event) => setRoute(event.target.value.toUpperCase())} placeholder="MLE/FND/MLE" required /></label>
            <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}>{FLIGHT_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Adult passengers<input type="number" min="0" value={paxAdults} onChange={(event) => setPaxAdults(event.target.value)} placeholder="0" /></label>
            <label>Infant passengers<input type="number" min="0" value={paxInfants} onChange={(event) => setPaxInfants(event.target.value)} placeholder="0" /></label>
            <label>Check-in time<input type="time" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} /></label>
            <label>Scheduled arrival<input type="time" value={arrival} onChange={(event) => setArrival(event.target.value)} /></label>
            <label>Scheduled departure<input type="time" value={departure} onChange={(event) => setDeparture(event.target.value)} /></label>
            <label>MLE departure<input type="time" value={originDep} onChange={(event) => setOriginDep(event.target.value)} /></label>
            <label className="flight-schedule-form__wide">Operational remarks<textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={3} placeholder="Optional notes for the operations team" /></label>
          </div>
          <div className="flight-schedule-form__actions"><button type="button" className="flight-secondary-button" onClick={closeForm}>Cancel</button><button type="submit" className="flight-primary-button" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Save flight'}</button></div>
        </form>
      )}

      <section className="flight-schedule-workspace">
        <div className="flight-schedule-toolbar">
          <div className="flight-schedule-tabs" role="tablist" aria-label="Schedule view">
            <button type="button" role="tab" aria-selected={view === 'active'} className={view === 'active' ? 'is-active' : ''} onClick={() => setView('active')}>Active <span>{activeFlights.length}</span></button>
            <button type="button" role="tab" aria-selected={view === 'history'} className={view === 'history' ? 'is-active' : ''} onClick={() => setView('history')}>History <span>{historyFlights.length}</span></button>
          </div>
          <label className="flight-schedule-search"><span>Search schedule</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Flight, route, aircraft…" /></label>
        </div>

        {displayedFlights.length === 0 ? (
          <div className="flight-schedule-empty"><strong>{search ? 'No matching flights' : view === 'active' ? 'No active flights' : 'No flight history'}</strong><p>{search ? 'Try a different flight number, route, or status.' : 'Flight records will appear here when they are available.'}</p></div>
        ) : view === 'active' ? (
          <div className="flight-schedule-list">{displayedFlights.map((flight) => <FlightCard key={flight.id} flight={flight} canEdit={canEdit} onEdit={handleEdit} onDelete={setDeleteTarget} />)}</div>
        ) : (
          <div className="flight-schedule-table-wrap"><table className="flight-schedule-table"><thead><tr><th>Date</th><th>Flight</th><th>Route</th><th>Passengers</th><th>Scheduled</th><th>Actual</th><th>Status</th>{canEdit && <th>Actions</th>}</tr></thead><tbody>{displayedFlights.map((flight) => <tr key={flight.id}><td>{formatDisplayDate(flight.date)}</td><td><strong>{flight.flightNo || '—'}</strong><small>{flight.aircraft || '—'} · {flight.type || 'Scheduled'}</small></td><td>{flight.route || '—'}</td><td>{flight.paxAdults || 0} / {flight.paxInfants || 0}</td><td>{flight.arrivalTime || '—'} / {flight.departureTime || '—'}</td><td>{flight.ata || '—'} / {flight.atd || '—'}</td><td><span className={`flight-status flight-status--${statusClass(flight.status)}`}>{displayStatus(flight.status)}</span></td>{canEdit && <td><div className="flight-schedule-table__actions"><button type="button" onClick={() => handleEdit(flight)}>Edit</button><button type="button" className="is-danger" onClick={() => setDeleteTarget(flight)}>Delete</button></div></td>}</tr>)}</tbody></table></div>
        )}
      </section>

      <ConfirmDialog isOpen={Boolean(deleteTarget)} title="Delete flight?" message={`Delete ${deleteTarget?.flightNo || 'this flight'}? This action cannot be undone.`} confirmText="Delete" isDanger={true} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}

export default FlightsPage;
