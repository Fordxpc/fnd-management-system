import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import { ConfirmDialog } from '../components/Dialogs';

const formatDate = (date: Date) => date.toISOString().split('T')[0];
const getCurrentTime = () => {
  const now = new Date();
  return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
};

const WIND_DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW', 'VRB'];

export default function RWYLightsPage() {
  const { profile, lightsInspectors } = useAuth();
  
  const isDev = profile?.role === 'developer';
  const isManager = profile?.role === 'manager' || profile?.role === 'admin';
  const isSMT = profile?.role === 'smt' || profile?.isSMT === true;
  
  const myStaffId = profile?.id; 
  const isSelectedInspector = lightsInspectors.some((i: any) => 
    i.staffName.toLowerCase() === (profile?.name || '').toLowerCase() || i.staffId === myStaffId
  );

  const isGroundOpsSMT = isSMT && profile?.department === 'Ground Operations';
  const canEdit = isDev || isManager || isSelectedInspector || isGroundOpsSMT;
  
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [viewingRecord, setViewingRecord] = useState<any>(null);

  // Form State
  const [date, setDate] = useState(formatDate(new Date()));
  const [time, setTime] = useState(getCurrentTime());
  
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

  const fetchData = useCallback(async () => {
    try {
      const recData = await apiFetch('/lights');
      setRecords(recData);
      setLoading(false);
    } catch (err: any) { toast.error(err.message); setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  if (loading) return <div className="page-content"><p>Loading...</p></div>;

  return (
    <div className="page-content">
      <div className="staff-header no-print">
        <h2>🚨 Runway Lights Inspection</h2>
        {canEdit && (
          <button className="add-staff-btn" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New Inspection'}</button>
        )}
      </div>

      {showForm && canEdit && (
        <form className="staff-form" onSubmit={handleSubmit} style={{ marginBottom: '24px' }}>
          <div style={{ gridColumn: 'span 2', fontWeight: 600, marginBottom: '8px' }}>Inspection Details</div>
          <div><label>Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
          <div><label>Time</label><input type="time" value={time} onChange={e => setTime(e.target.value)} required /></div>
          
          {/* Decorative Weather Grid */}
          <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            
            {/* Visibility */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Visibility</label>
              <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
                <select value={weatherVisCond} onChange={e => setWeatherVisCond(e.target.value)} style={{ flex: 1, border: 'none', padding: '8px', outline: 'none', background: 'transparent' }}>
                  <option value="Good">Good</option>
                  <option value="Moderate">Mod</option>
                  <option value="Poor">Poor</option>
                </select>
                <span style={{ padding: '0 4px', color: '#94a3b8' }}>|</span>
                <input type="number" value={weatherVisKm} onChange={e => setWeatherVisKm(e.target.value)} style={{ width: '45px', border: 'none', padding: '8px', outline: 'none', textAlign: 'center' }} />
                <span style={{ paddingRight: '10px', fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>km</span>
              </div>
            </div>

            {/* Cloud */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Cloud</label>
              <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
                <select value={weatherCloudCond} onChange={e => setWeatherCloudCond(e.target.value)} style={{ flex: 1, border: 'none', padding: '8px', outline: 'none', background: 'transparent' }}>
                  <option value="Clear">Clear</option>
                  <option value="Few">Few</option>
                  <option value="Scattered">SCT</option>
                  <option value="Broken">BKN</option>
                  <option value="Overcast">OVC</option>
                </select>
                <span style={{ padding: '0 4px', color: '#94a3b8' }}>|</span>
                <input type="number" value={weatherCloudPct} onChange={e => setWeatherCloudPct(e.target.value)} style={{ width: '45px', border: 'none', padding: '8px', outline: 'none', textAlign: 'center' }} />
                <span style={{ paddingRight: '10px', fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>%</span>
              </div>
            </div>

            {/* Wind */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Wind</label>
              <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
                <select value={weatherWindDir} onChange={e => setWeatherWindDir(e.target.value)} style={{ flex: 1, border: 'none', padding: '8px', outline: 'none', background: 'transparent' }}>
                  {WIND_DIRS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <span style={{ padding: '0 4px', color: '#94a3b8' }}>|</span>
                <input type="number" value={weatherWindSpd} onChange={e => setWeatherWindSpd(e.target.value)} style={{ width: '45px', border: 'none', padding: '8px', outline: 'none', textAlign: 'center' }} />
                <span style={{ paddingRight: '10px', fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>km/h</span>
              </div>
            </div>

          </div>

          <div>
            <label>Inspected By</label>
            <select value={inspector} onChange={e => setInspector(e.target.value)} required style={{ color: '#1e293b' }}>
              <option value="">Select Authorized Staff...</option>
              {lightsInspectors.map((s: any) => (
                <option key={s.staffId} value={s.staffName}>{s.staffName}</option>
              ))}
            </select>
          </div>

          <div style={{ gridColumn: 'span 2', fontWeight: 600, marginTop: '16px', borderBottom: '1px solid #cbd5e1' }}>Light Details</div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', gridColumn: 'span 2', background: '#f8fafc', padding: '16px', borderRadius: '8px' }}>
            <div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Edge Lights (A / B)</label><div style={{ display: 'flex', gap: '8px' }}><input type="number" placeholder="A" value={lights.edge.sideA} onChange={e => handleLightChange('edge', 'sideA', e.target.value)} /><input type="number" placeholder="B" value={lights.edge.sideB} onChange={e => handleLightChange('edge', 'sideB', e.target.value)} /></div></div>
            <div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>End Lights (01 / 19)</label><div style={{ display: 'flex', gap: '8px' }}><input type="number" placeholder="01" value={lights.end.rwy01} onChange={e => handleLightChange('end', 'rwy01', e.target.value)} /><input type="number" placeholder="19" value={lights.end.rwy19} onChange={e => handleLightChange('end', 'rwy19', e.target.value)} /></div></div>
            <div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Threshold (01 / 19)</label><div style={{ display: 'flex', gap: '8px' }}><input type="number" placeholder="01" value={lights.threshold.rwy01} onChange={e => handleLightChange('threshold', 'rwy01', e.target.value)} /><input type="number" placeholder="19" value={lights.threshold.rwy19} onChange={e => handleLightChange('threshold', 'rwy19', e.target.value)} /></div></div>
            <div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>PAPI RWY 01</label><div style={{ display: 'flex', gap: '8px' }}><input type="number" placeholder="Count" value={lights.papi.rwy01.count} onChange={e => handleLightChange('papi', 'rwy01', e.target.value, 'count')} /><select value={lights.papi.rwy01.brightness} onChange={e => handleLightChange('papi', 'rwy01', e.target.value, 'brightness')} style={{ padding: '8px' }}><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select></div></div>
            <div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>PAPI RWY 19</label><div style={{ display: 'flex', gap: '8px' }}><input type="number" placeholder="Count" value={lights.papi.rwy19.count} onChange={e => handleLightChange('papi', 'rwy19', e.target.value, 'count')} /><select value={lights.papi.rwy19.brightness} onChange={e => handleLightChange('papi', 'rwy19', e.target.value, 'brightness')} style={{ padding: '8px' }}><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select></div></div>
            <div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Taxi Boards (A / B)</label><div style={{ display: 'flex', gap: '8px' }}><input type="number" placeholder="A" value={lights.taxi.boardA} onChange={e => handleLightChange('taxi', 'boardA', e.target.value)} /><input type="number" placeholder="B" value={lights.taxi.boardB} onChange={e => handleLightChange('taxi', 'boardB', e.target.value)} /></div></div>
            <div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Apron Mast</label><div style={{ display: 'flex', gap: '8px' }}><input type="number" placeholder="Masts" value={lights.apron.masts} onChange={e => handleLightChange('apron', 'masts', e.target.value)} /><input type="number" placeholder="Per Mast" value={lights.apron.perMast} onChange={e => handleLightChange('apron', 'perMast', e.target.value)} /></div></div>
            <div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>ROB Status</label><select value={lights.rob.status} onChange={e => handleLightChange('rob', 'status', e.target.value)} style={{ padding: '8px', width: '100%' }}><option>In Service</option><option>Faulty</option></select></div>
            <div><label style={{ fontSize: '12px', fontWeight: 'bold' }}>Windcone</label><select value={lights.windcone.status} onChange={e => handleLightChange('windcone', 'status', e.target.value)} style={{ padding: '8px', width: '100%' }}><option>In Service</option><option>Faulty</option></select></div>
          </div>

          <div style={{ gridColumn: 'span 2' }}><label>Technician Remarks / Notes</label><textarea rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} /></div>
          <button type="submit" style={{ gridColumn: 'span 2', background: '#16a34a' }}>Save Inspection</button>
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
              {records.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: '20px' }}>No records found.</td></tr> : records.map(r => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>{r.time || '—'}</td>
                  <td><strong>{r.inspectorName}</strong></td>
                  <td style={{ fontSize: '11px', maxWidth: '200px' }}>{r.weather || '—'}</td>
                  <td>{r.data.edge?.sideA || 0} / {r.data.edge?.sideB || 0}</td>
                  <td>{r.data.end?.rwy01 || 0} / {r.data.end?.rwy19 || 0}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="reset-pw-btn" onClick={() => setViewingRecord(r)}>👁️ View / Print</button>
                    {(isDev || isManager) && <button className="delete-btn" onClick={() => setDeleteTarget(r.id)} style={{ marginLeft: '6px' }}>Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* VIEW / PRINT MODAL */}
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
                  <tr><td style={{ padding: '8px', border: '1px solid #000' }}>Edge Lights</td><td style={{ padding: '8px', border: '1px solid #000' }}>Side A: {viewingRecord.data.edge?.sideA} | Side B: {viewingRecord.data.edge?.sideB}</td></tr>
                  <tr><td style={{ padding: '8px', border: '1px solid #000' }}>End Lights</td><td style={{ padding: '8px', border: '1px solid #000' }}>RWY 01: {viewingRecord.data.end?.rwy01} | RWY 19: {viewingRecord.data.end?.rwy19}</td></tr>
                  <tr><td style={{ padding: '8px', border: '1px solid #000' }}>Threshold Lights</td><td style={{ padding: '8px', border: '1px solid #000' }}>RWY 01: {viewingRecord.data.threshold?.rwy01} | RWY 19: {viewingRecord.data.threshold?.rwy19}</td></tr>
                  <tr><td style={{ padding: '8px', border: '1px solid #000' }}>PAPI RWY 01</td><td style={{ padding: '8px', border: '1px solid #000' }}>Count: {viewingRecord.data.papi?.rwy01?.count} | Brightness: {viewingRecord.data.papi?.rwy01?.brightness}</td></tr>
                  <tr><td style={{ padding: '8px', border: '1px solid #000' }}>PAPI RWY 19</td><td style={{ padding: '8px', border: '1px solid #000' }}>Count: {viewingRecord.data.papi?.rwy19?.count} | Brightness: {viewingRecord.data.papi?.rwy19?.brightness}</td></tr>
                  <tr><td style={{ padding: '8px', border: '1px solid #000' }}>Taxi Boards</td><td style={{ padding: '8px', border: '1px solid #000' }}>A: {viewingRecord.data.taxi?.boardA} | B: {viewingRecord.data.taxi?.boardB}</td></tr>
                  <tr><td style={{ padding: '8px', border: '1px solid #000' }}>Apron Mast</td><td style={{ padding: '8px', border: '1px solid #000' }}>{viewingRecord.data.apron?.masts} masts x {viewingRecord.data.apron?.perMast} lights</td></tr>
                  <tr><td style={{ padding: '8px', border: '1px solid #000' }}>ROB Status</td><td style={{ padding: '8px', border: '1px solid #000' }}>{viewingRecord.data.rob?.status}</td></tr>
                  <tr><td style={{ padding: '8px', border: '1px solid #000' }}>Windcone</td><td style={{ padding: '8px', border: '1px solid #000' }}>{viewingRecord.data.windcone?.status}</td></tr>
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