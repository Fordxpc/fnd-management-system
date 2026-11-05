import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import { ConfirmDialog } from '../components/Dialogs';
import { canViewRWYLights, canEditRWYLights } from '../lib/permissions';

const formatDate = (date: Date) => date.toISOString().split('T')[0];
const getCurrentTime = () => {
  const now = new Date();
  return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
};

const INITIAL_DATE = formatDate(new Date());
const INITIAL_TIME = getCurrentTime();

const WIND_DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW', 'VRB'];

export default function RWYLightsPage() {
  const { profile, user, lightsInspectors } = useAuth();

  const [records, setRecords] = useState<any[]>([]);
  const [myStaff, setMyStaff] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [viewingRecord, setViewingRecord] = useState<any>(null);

  // Form State
  const [date, setDate] = useState(INITIAL_DATE);
  const [time, setTime] = useState(INITIAL_TIME);
  
  // Weather State
  const [weatherVisCond, setWeatherVisCond] = useState('Good');
  const [weatherVisKm, setWeatherVisKm] = useState('10');
  const [weatherCloudCond, setWeatherCloudCond] = useState('Clear');
  const [weatherCloudPct, setWeatherCloudPct] = useState('0');
  const [weatherWindDir, setWeatherWindDir] = useState('N');
  const [weatherWindSpd, setWeatherWindSpd] = useState('0');
  
  const [inspector, setInspector] = useState('');
  const [remarks, setRemarks] = useState('');
  
  const [lights, setLights] = useState<any>({
    edge: { sideA: 11, sideB: 11 },
    end: { rwy01: 6, rwy19: 6 },
    threshold: { rwy01: 12, rwy19: 12 },
    papi: { rwy01: { count: 2, brightness: '3' }, rwy19: { count: 2, brightness: '3' } },
    taxi: { boardA: 2, boardB: 2 },
    apron: { masts: 6, perMast: 3 },
    rob: { status: 'In Service' },
    windcone: { status: 'In Service' }
  });

  const fetchData = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const [recData, staffData] = await Promise.all([
        apiFetch('/lights'),
        apiFetch('/staff').catch(() => []),
      ]);
      setRecords(Array.isArray(recData) ? recData : []);
      const myEmail = String(profile?.email || user?.email || '').toLowerCase();
      const mine = Array.isArray(staffData) ? staffData.find((member: any) => (member.email || '').toLowerCase() === myEmail) : null;
      setMyStaff(mine || null);
      setLoadError('');
    } catch (err: any) {
      setLoadError(err.message || 'Inspection records could not be loaded.');
      if (!quiet) toast.error(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, user]);

  useEffect(() => { const initialLoad = window.setTimeout(() => void fetchData(true), 0); const interval = window.setInterval(() => void fetchData(true), 30000); return () => { window.clearTimeout(initialLoad); window.clearInterval(interval); }; }, [fetchData]);

  const canView = canViewRWYLights(profile, myStaff);
  const canEdit = canEditRWYLights(profile, myStaff);

  const handleLightChange = (category: string, field: string, value: any, subField?: string) => {
    setLights((prev: any) => {
      if (subField) {
        return { ...prev, [category]: { ...prev[category], [field]: { ...prev[category][field], [subField]: value } } };
      }
      return { ...prev, [category]: { ...prev[category], [field]: value } };
    });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!inspector) { toast.error('Select the inspector'); return; }

    const finalWeather = `Vis: ${weatherVisCond} ${weatherVisKm}km | Cloud: ${weatherCloudCond} ${weatherCloudPct}% | Wind: ${weatherWindDir} ${weatherWindSpd}km/h`;

    setSaving(true);
    try {
      await apiFetch('/lights', {
        method: 'POST',
        body: JSON.stringify({ date, time, weather: finalWeather, inspectorName: inspector, data: lights, remarks })
      });
      toast.success('Lights inspection saved!');
      setShowForm(false);
      setRemarks('');
      fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/lights/${deleteTarget}`, { method: 'DELETE' });
      toast.success('Record deleted');
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) { toast.error(err.message); }
  };

  const handlePrintModal = () => {
    document.body.classList.add('printing-modal');
    window.print();
    setTimeout(() => document.body.classList.remove('printing-modal'), 1000);
  };

  const filteredRecords = records.filter((record) => {
    const query = search.trim().toLowerCase();
    return !query || [record.date, record.time, record.inspectorName, record.weather, record.remarks].some((value) => String(value || '').toLowerCase().includes(query));
  });
  const faultCount = records.filter((record) => record.data?.rob?.status === 'Faulty' || record.data?.windcone?.status === 'Faulty').length;
  const todayCount = records.filter((record) => record.date === INITIAL_DATE).length;
  const latestRecord = [...records].sort((a, b) => `${b.date || ''} ${b.time || ''}`.localeCompare(`${a.date || ''} ${a.time || ''}`))[0];
  if (loading) return <div className="page-content"><p>Loading...</p></div>;
  if (!canView) return <div className="page-content"><div className="empty-state"><h2>Access Denied</h2></div></div>;

  return (
    <div className="page-content runway-lights-page">
      <header className="runway-lights-hero no-print">
        <div>
          <span className="runway-lights-kicker">Airfield electrical safety</span>
          <h2>Runway Lights Inspection</h2>
          <p>Record lighting availability, environmental conditions, and equipment faults in a clear inspection history.</p>
        </div>
        <div className="runway-lights-hero__actions">
          <button type="button" className="runway-lights-secondary" onClick={() => void fetchData()} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
          {canEdit && <button type="button" className="runway-lights-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Close inspection' : 'New inspection'}</button>}
        </div>
      </header>

      {loadError && <div className="runway-lights-alert no-print" role="alert"><strong>Inspection information may be out of date.</strong><span>{loadError}</span></div>}

      <section className="runway-lights-summary no-print" aria-label="Inspection summary">
        <div><span>Total records</span><strong>{records.length}</strong><small>saved inspections</small></div>
        <div><span>Today</span><strong>{todayCount}</strong><small>inspections completed</small></div>
        <div><span>Fault reports</span><strong>{faultCount}</strong><small>ROB or windcone faults</small></div>
        <div><span>Latest inspection</span><strong>{latestRecord?.time || '—'}</strong><small>{latestRecord?.date || 'No record yet'}</small></div>
      </section>

      <section className="runway-lights-controls no-print">
        <label><span>Search inspection history</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Date, inspector, weather or remarks…" /></label>
      </section>
      {showForm && canEdit && (
        <form className="runway-lights-form" onSubmit={handleSubmit}>
          <header className="runway-lights-form__header">
            <div><span>New inspection</span><h3>Airfield lighting condition report</h3></div>
            <p>Record the observed serviceable light count and immediately flag equipment faults.</p>
          </header>

          <section className="runway-lights-form__section">
            <div className="runway-lights-form__section-title"><span>01</span><div><h4>Inspection details</h4><p>Date, time and authorized inspector</p></div></div>
            <div className="runway-lights-form__grid runway-lights-form__grid--three">
              <label><span>Date</span><input type="date" value={date} onChange={e => setDate(e.target.value)} required /></label>
              <label><span>Time</span><input type="time" value={time} onChange={e => setTime(e.target.value)} required /></label>
              <label><span>Inspected by</span><select value={inspector} onChange={e => setInspector(e.target.value)} required><option value="">Select authorized staff…</option>{lightsInspectors.map((s: any) => <option key={s.staffId} value={s.staffName}>{s.staffName}</option>)}</select></label>
            </div>
          </section>

          <section className="runway-lights-form__section">
            <div className="runway-lights-form__section-title"><span>02</span><div><h4>Weather at inspection</h4><p>Visibility, cloud and surface wind</p></div></div>
            <div className="runway-lights-weather-grid">
              <div className="runway-lights-composite"><strong>Visibility</strong><div><select aria-label="Visibility condition" value={weatherVisCond} onChange={e => setWeatherVisCond(e.target.value)}><option value="Good">Good</option><option value="Moderate">Moderate</option><option value="Poor">Poor</option></select><input aria-label="Visibility distance" type="number" min="0" max="50" step="0.1" value={weatherVisKm} onChange={e => setWeatherVisKm(e.target.value)} /><em>km</em></div></div>
              <div className="runway-lights-composite"><strong>Cloud</strong><div><select aria-label="Cloud condition" value={weatherCloudCond} onChange={e => setWeatherCloudCond(e.target.value)}><option value="Clear">Clear</option><option value="Few">Few</option><option value="Scattered">Scattered</option><option value="Broken">Broken</option><option value="Overcast">Overcast</option></select><input aria-label="Cloud cover" type="number" min="0" max="100" value={weatherCloudPct} onChange={e => setWeatherCloudPct(e.target.value)} /><em>%</em></div></div>
              <div className="runway-lights-composite"><strong>Wind</strong><div><select aria-label="Wind direction" value={weatherWindDir} onChange={e => setWeatherWindDir(e.target.value)}>{WIND_DIRS.map(d => <option key={d} value={d}>{d}</option>)}</select><input aria-label="Wind speed" type="number" min="0" max="200" value={weatherWindSpd} onChange={e => setWeatherWindSpd(e.target.value)} /><em>km/h</em></div></div>
            </div>
          </section>

          <section className="runway-lights-form__section">
            <div className="runway-lights-form__section-title"><span>03</span><div><h4>Serviceable lighting count</h4><p>Enter the observed count for each installation</p></div></div>
            <div className="runway-lights-equipment-grid">
              <fieldset><legend>Edge lights</legend><label><span>Side A</span><input type="number" min="0" value={lights.edge.sideA} onChange={e => handleLightChange('edge', 'sideA', e.target.value)} /></label><label><span>Side B</span><input type="number" min="0" value={lights.edge.sideB} onChange={e => handleLightChange('edge', 'sideB', e.target.value)} /></label></fieldset>
              <fieldset><legend>End lights</legend><label><span>RWY 01</span><input type="number" min="0" value={lights.end.rwy01} onChange={e => handleLightChange('end', 'rwy01', e.target.value)} /></label><label><span>RWY 19</span><input type="number" min="0" value={lights.end.rwy19} onChange={e => handleLightChange('end', 'rwy19', e.target.value)} /></label></fieldset>
              <fieldset><legend>Threshold lights</legend><label><span>RWY 01</span><input type="number" min="0" value={lights.threshold.rwy01} onChange={e => handleLightChange('threshold', 'rwy01', e.target.value)} /></label><label><span>RWY 19</span><input type="number" min="0" value={lights.threshold.rwy19} onChange={e => handleLightChange('threshold', 'rwy19', e.target.value)} /></label></fieldset>
              <fieldset><legend>PAPI RWY 01</legend><label><span>Count</span><input type="number" min="0" value={lights.papi.rwy01.count} onChange={e => handleLightChange('papi', 'rwy01', e.target.value, 'count')} /></label><label><span>Brightness</span><select value={lights.papi.rwy01.brightness} onChange={e => handleLightChange('papi', 'rwy01', e.target.value, 'brightness')}>{[1,2,3,4,5].map(level => <option key={level} value={level}>{level}</option>)}</select></label></fieldset>
              <fieldset><legend>PAPI RWY 19</legend><label><span>Count</span><input type="number" min="0" value={lights.papi.rwy19.count} onChange={e => handleLightChange('papi', 'rwy19', e.target.value, 'count')} /></label><label><span>Brightness</span><select value={lights.papi.rwy19.brightness} onChange={e => handleLightChange('papi', 'rwy19', e.target.value, 'brightness')}>{[1,2,3,4,5].map(level => <option key={level} value={level}>{level}</option>)}</select></label></fieldset>
              <fieldset><legend>Taxi boards</legend><label><span>Board A</span><input type="number" min="0" value={lights.taxi.boardA} onChange={e => handleLightChange('taxi', 'boardA', e.target.value)} /></label><label><span>Board B</span><input type="number" min="0" value={lights.taxi.boardB} onChange={e => handleLightChange('taxi', 'boardB', e.target.value)} /></label></fieldset>
              <fieldset><legend>Apron mast lighting</legend><label><span>Masts</span><input type="number" min="0" value={lights.apron.masts} onChange={e => handleLightChange('apron', 'masts', e.target.value)} /></label><label><span>Per mast</span><input type="number" min="0" value={lights.apron.perMast} onChange={e => handleLightChange('apron', 'perMast', e.target.value)} /></label></fieldset>
            </div>
          </section>

          <section className="runway-lights-form__section">
            <div className="runway-lights-form__section-title"><span>04</span><div><h4>Equipment status and remarks</h4><p>Flag faults for immediate operational attention</p></div></div>
            <div className="runway-lights-status-grid">
              <label className={lights.rob.status === 'Faulty' ? 'is-faulty' : 'is-serviceable'}><span>ROB status</span><select value={lights.rob.status} onChange={e => handleLightChange('rob', 'status', e.target.value)}><option>In Service</option><option>Faulty</option></select></label>
              <label className={lights.windcone.status === 'Faulty' ? 'is-faulty' : 'is-serviceable'}><span>Windcone</span><select value={lights.windcone.status} onChange={e => handleLightChange('windcone', 'status', e.target.value)}><option>In Service</option><option>Faulty</option></select></label>
              <label className="runway-lights-form__remarks"><span>Technician remarks / action taken</span><textarea rows={3} maxLength={500} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Record defects, location and action taken…" /><small>{remarks.length}/500</small></label>
            </div>
          </section>

          <footer className="runway-lights-form__footer"><span>Review all values before saving the permanent inspection record.</span><button type="submit" disabled={saving}>{saving ? 'Saving inspection…' : 'Save inspection'}</button></footer>
        </form>
      )}

      <div className="staff-list">
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Time</th><th>Inspector</th><th>Weather</th>
                <th>Edge (A/B)</th><th>End (01/19)</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: '20px' }}>No records found.</td></tr> : filteredRecords.map(r => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>{r.time || '—'}</td>
                  <td><strong>{r.inspectorName}</strong></td>
                  <td style={{ fontSize: '11px', maxWidth: '200px' }}>{r.weather || '—'}</td>
                  <td>{r.data?.edge?.sideA || 0} / {r.data?.edge?.sideB || 0}</td>
                  <td>{r.data?.end?.rwy01 || 0} / {r.data?.end?.rwy19 || 0}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="reset-pw-btn" onClick={() => setViewingRecord(r)}>👁️ View / Print</button>
                    {canEdit && <button className="delete-btn" onClick={() => setDeleteTarget(r.id)} style={{ marginLeft: '6px' }}>Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewingRecord && (
        <div className="modal-backdrop" onClick={() => setViewingRecord(null)}>
          <div className="modal-content" style={{ maxWidth: '800px', width: '95%', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header no-print" style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Inspection Record: {viewingRecord.date}</h3>
              <div>
                <button className="quick-btn" style={{ background: '#166534', color: 'white', marginRight: '10px' }} onClick={handlePrintModal}>🖨️ Print / PDF</button>
                <button className="cancel-btn" onClick={() => setViewingRecord(null)}>Close</button>
              </div>
            </div>
            
            <div className="modal-scrollable-body" style={{ padding: '20px', overflowY: 'auto', flex: 1, background: '#fff' }}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, color: '#000' }}>Runway Lights Inspection Report</h2>
                <p style={{ margin: '4px 0', fontSize: '14px' }}>Funadhoo Airport</p>
              </div>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginBottom: '20px' }}>
                <tbody>
                  <tr><td style={{ padding: '8px', border: '1px solid #000', fontWeight: 'bold', width: '30%' }}>Date:</td><td style={{ padding: '8px', border: '1px solid #000' }}>{viewingRecord.date}</td></tr>
                  <tr><td style={{ padding: '8px', border: '1px solid #000', fontWeight: 'bold' }}>Time:</td><td style={{ padding: '8px', border: '1px solid #000' }}>{viewingRecord.time}</td></tr>
                  <tr><td style={{ padding: '8px', border: '1px solid #000', fontWeight: 'bold' }}>Inspector:</td><td style={{ padding: '8px', border: '1px solid #000' }}>{viewingRecord.inspectorName}</td></tr>
                  <tr><td style={{ padding: '8px', border: '1px solid #000', fontWeight: 'bold' }}>Weather:</td><td style={{ padding: '8px', border: '1px solid #000' }}>{viewingRecord.weather}</td></tr>
                  <tr><td style={{ padding: '8px', border: '1px solid #000', fontWeight: 'bold' }}>Remarks:</td><td style={{ padding: '8px', border: '1px solid #000' }}>{viewingRecord.remarks || 'None'}</td></tr>
                </tbody>
              </table>

              <h3 style={{ marginBottom: '10px' }}>Light Details</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    <th style={{ padding: '8px', border: '1px solid #000', textAlign: 'left' }}>Category</th>
                    <th style={{ padding: '8px', border: '1px solid #000', textAlign: 'left' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td style={{ padding: '8px', border: '1px solid #000' }}>Edge Lights</td><td style={{ padding: '8px', border: '1px solid #000' }}>Side A: {viewingRecord.data?.edge?.sideA} | Side B: {viewingRecord.data?.edge?.sideB}</td></tr>
                  <tr><td style={{ padding: '8px', border: '1px solid #000' }}>End Lights</td><td style={{ padding: '8px', border: '1px solid #000' }}>RWY 01: {viewingRecord.data?.end?.rwy01} | RWY 19: {viewingRecord.data?.end?.rwy19}</td></tr>
                  <tr><td style={{ padding: '8px', border: '1px solid #000' }}>Threshold Lights</td><td style={{ padding: '8px', border: '1px solid #000' }}>RWY 01: {viewingRecord.data?.threshold?.rwy01} | RWY 19: {viewingRecord.data?.threshold?.rwy19}</td></tr>
                  <tr><td style={{ padding: '8px', border: '1px solid #000' }}>PAPI RWY 01</td><td style={{ padding: '8px', border: '1px solid #000' }}>Count: {viewingRecord.data?.papi?.rwy01?.count} | Brightness: {viewingRecord.data?.papi?.rwy01?.brightness}</td></tr>
                  <tr><td style={{ padding: '8px', border: '1px solid #000' }}>PAPI RWY 19</td><td style={{ padding: '8px', border: '1px solid #000' }}>Count: {viewingRecord.data?.papi?.rwy19?.count} | Brightness: {viewingRecord.data?.papi?.rwy19?.brightness}</td></tr>
                  <tr><td style={{ padding: '8px', border: '1px solid #000' }}>Taxi Boards</td><td style={{ padding: '8px', border: '1px solid #000' }}>A: {viewingRecord.data?.taxi?.boardA} | B: {viewingRecord.data?.taxi?.boardB}</td></tr>
                  <tr><td style={{ padding: '8px', border: '1px solid #000' }}>Apron Mast</td><td style={{ padding: '8px', border: '1px solid #000' }}>{viewingRecord.data?.apron?.masts} masts x {viewingRecord.data?.apron?.perMast} lights</td></tr>
                  <tr><td style={{ padding: '8px', border: '1px solid #000' }}>ROB Status</td><td style={{ padding: '8px', border: '1px solid #000' }}>{viewingRecord.data?.rob?.status}</td></tr>
                  <tr><td style={{ padding: '8px', border: '1px solid #000' }}>Windcone</td><td style={{ padding: '8px', border: '1px solid #000' }}>{viewingRecord.data?.windcone?.status}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={!!deleteTarget} title="Delete Record?" message="Permanently delete this light inspection record?" confirmText="Delete" isDanger={true} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}