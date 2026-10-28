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

  // Form State
  const [date, setDate] = useState(formatDate(new Date()));
  const [time, setTime] = useState(getCurrentTime());
  
  // Weather State
  const [weatherVis, setWeatherVis] = useState('');
  const [weatherCloud, setWeatherCloud] = useState('');
  const [weatherWindDir, setWeatherWindDir] = useState('');
  const [weatherWindSpd, setWeatherWindSpd] = useState('');
  
  const [inspector, setInspector] = useState('');
  const [remarks, setRemarks] = useState('');
  
  // Dynamic Lights Data
  const [lights, setLights] = useState<any>({
    edge: { sideA: 11, sideB: 11 },
    end: { rwy01: 6, rwy19: 6 },
    threshold: { rwy01: 12, rwy19: 12 },
    papi: { 
      rwy01: { count: 2, brightness: '3' }, 
      rwy19: { count: 2, brightness: '3' } 
    },
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

    // Combine 4 weather fields into 1 string for the database
    const finalWeather = `Vis: ${weatherVis || 'N/A'} | Cloud: ${weatherCloud || 'N/A'} | Wind: ${weatherWindDir || 'N/A'} ${weatherWindSpd || '0'}kts`;

    try {
      await apiFetch('/lights', {
        method: 'POST',
        body: JSON.stringify({ 
          date, 
          time, 
          weather: finalWeather, 
          inspectorName: inspector, 
          data: lights, 
          remarks 
        })
      });
      toast.success('Lights inspection saved!');
      setShowForm(false);
      setRemarks('');
      setWeatherVis('');
      setWeatherCloud('');
      setWeatherWindDir('');
      setWeatherWindSpd('');
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

  if (loading) return <div className="page-content"><p>Loading...</p></div>;

  return (
    <div className="page-content">
      <div className="staff-header">
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
          
          {/* Split Weather Condition into Grid */}
          <div style={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Visibility</label>
              <select value={weatherVis} onChange={e => setWeatherVis(e.target.value)} style={{ color: '#1e293b', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '100%' }}>
                <option value="">Select...</option>
                <option value="Good">Good</option>
                <option value="Moderate">Moderate</option>
                <option value="Poor">Poor</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Cloud</label>
              <select value={weatherCloud} onChange={e => setWeatherCloud(e.target.value)} style={{ color: '#1e293b', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '100%' }}>
                <option value="">Select...</option>
                <option value="SKC">Clear (SKC)</option>
                <option value="FEW">Few (FEW)</option>
                <option value="SCT">Scattered (SCT)</option>
                <option value="BKN">Broken (BKN)</option>
                <option value="OVC">Overcast (OVC)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Wind Dir</label>
              <select value={weatherWindDir} onChange={e => setWeatherWindDir(e.target.value)} style={{ color: '#1e293b', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '100%' }}>
                <option value="">Select...</option>
                <option value="N">N</option><option value="NE">NE</option><option value="E">E</option>
                <option value="SE">SE</option><option value="S">S</option><option value="SW">SW</option>
                <option value="W">W</option><option value="NW">NW</option><option value="VRB">VRB</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Wind Spd (kts)</label>
              <input type="number" placeholder="e.g. 10" value={weatherWindSpd} onChange={e => setWeatherWindSpd(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
            </div>
          </div>

          <div>
            <label>Inspected By</label>
            <select value={inspector} onChange={e => setInspector(e.target.value)} required style={{ color: '#1e293b' }}>
              <option value="">Select Staff...</option>
              {/* Use lightsInspectors array instead of all staffList */}
              {lightsInspectors.map((s: any) => (
                <option key={s.staffId} value={s.staffName}>
                  {s.staffName} (Authorized)
                </option>
              ))}
            </select>
          </div>

          <div style={{ gridColumn: 'span 2', fontWeight: 600, marginTop: '16px', borderBottom: '1px solid #cbd5e1' }}>Light Details</div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', gridColumn: 'span 2', background: '#f8fafc', padding: '16px', borderRadius: '8px' }}>
            {/* Edge Lights */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Edge Lights (Side A / B)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" placeholder="A" value={lights.edge.sideA} onChange={e => handleLightChange('edge', 'sideA', e.target.value)} />
                <input type="number" placeholder="B" value={lights.edge.sideB} onChange={e => handleLightChange('edge', 'sideB', e.target.value)} />
              </div>
            </div>
            
            {/* End Lights */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>End Lights (01 / 19)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" placeholder="01" value={lights.end.rwy01} onChange={e => handleLightChange('end', 'rwy01', e.target.value)} />
                <input type="number" placeholder="19" value={lights.end.rwy19} onChange={e => handleLightChange('end', 'rwy19', e.target.value)} />
              </div>
            </div>
            
            {/* Threshold Lights */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Threshold (01 / 19)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" placeholder="01" value={lights.threshold.rwy01} onChange={e => handleLightChange('threshold', 'rwy01', e.target.value)} />
                <input type="number" placeholder="19" value={lights.threshold.rwy19} onChange={e => handleLightChange('threshold', 'rwy19', e.target.value)} />
              </div>
            </div>

            {/* PAPI RWY 01 */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>PAPI RWY 01 (Count / Brightness)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" placeholder="Count" value={lights.papi.rwy01.count} onChange={e => handleLightChange('papi', 'rwy01', e.target.value, 'count')} />
                <select value={lights.papi.rwy01.brightness} onChange={e => handleLightChange('papi', 'rwy01', e.target.value, 'brightness')} style={{ color: '#1e293b', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                  <option value="1">1 (Low)</option><option value="2">2</option><option value="3">3 (Med)</option><option value="4">4</option><option value="5">5 (High)</option>
                </select>
              </div>
            </div>

            {/* PAPI RWY 19 */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>PAPI RWY 19 (Count / Brightness)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" placeholder="Count" value={lights.papi.rwy19.count} onChange={e => handleLightChange('papi', 'rwy19', e.target.value, 'count')} />
                <select value={lights.papi.rwy19.brightness} onChange={e => handleLightChange('papi', 'rwy19', e.target.value, 'brightness')} style={{ color: '#1e293b', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                  <option value="1">1 (Low)</option><option value="2">2</option><option value="3">3 (Med)</option><option value="4">4</option><option value="5">5 (High)</option>
                </select>
              </div>
            </div>

            {/* Taxi Boards */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Taxi Boards (A / B)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" placeholder="A" value={lights.taxi.boardA} onChange={e => handleLightChange('taxi', 'boardA', e.target.value)} />
                <input type="number" placeholder="B" value={lights.taxi.boardB} onChange={e => handleLightChange('taxi', 'boardB', e.target.value)} />
              </div>
            </div>

            {/* Apron Mast */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Apron Mast (Masts x Lights)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" placeholder="Masts" value={lights.apron.masts} onChange={e => handleLightChange('apron', 'masts', e.target.value)} />
                <input type="number" placeholder="Per Mast" value={lights.apron.perMast} onChange={e => handleLightChange('apron', 'perMast', e.target.value)} />
              </div>
            </div>
            
            {/* ROB */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>ROB Status</label>
              <select value={lights.rob.status} onChange={e => handleLightChange('rob', 'status', e.target.value)} style={{ color: '#1e293b', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                <option>In Service</option><option>Faulty</option>
              </select>
            </div>
            
            {/* Windcone */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Windcone Light</label>
              <select value={lights.windcone.status} onChange={e => handleLightChange('windcone', 'status', e.target.value)} style={{ color: '#1e293b', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                <option>In Service</option><option>Faulty</option>
              </select>
            </div>
          </div>

          <div style={{ gridColumn: 'span 2' }}>
            <label>Technician Remarks / Notes</label>
            <textarea rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Details of faults or repairs..." />
          </div>

          <button type="submit" style={{ gridColumn: 'span 2', background: '#16a34a' }}>Save Inspection</button>
        </form>
      )}

      <div className="staff-list">
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Time</th><th>Inspector</th><th>Weather</th>
                <th>Edge (A/B)</th><th>End (01/19)</th><th>Thresh (01/19)</th>
                <th>PAPI 01 (L/B)</th><th>PAPI 19 (L/B)</th>
                <th>Taxi (A/B)</th><th>Apron</th><th>ROB</th><th>Windcone</th><th>Remarks</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? <tr><td colSpan={15} style={{ textAlign: 'center', padding: '20px' }}>No records found.</td></tr> : records.map(r => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>{r.time || '—'}</td>
                  <td><strong>{r.inspectorName}</strong></td>
                  <td style={{ fontSize: '11px', maxWidth: '150px' }}>{r.weather || '—'}</td>
                  <td>{r.data.edge?.sideA || 0} / {r.data.edge?.sideB || 0}</td>
                  <td>{r.data.end?.rwy01 || 0} / {r.data.end?.rwy19 || 0}</td>
                  <td>{r.data.threshold?.rwy01 || 0} / {r.data.threshold?.rwy19 || 0}</td>
                  <td>{r.data.papi?.rwy01?.count || 0} / {r.data.papi?.rwy01?.brightness || '—'}</td>
                  <td>{r.data.papi?.rwy19?.count || 0} / {r.data.papi?.rwy19?.brightness || '—'}</td>
                  <td>{r.data.taxi?.boardA || 0} / {r.data.taxi?.boardB || 0}</td>
                  <td>{r.data.apron?.masts || 0} x {r.data.apron?.perMast || 0}</td>
                  <td>{r.data.rob?.status}</td>
                  <td>{r.data.windcone?.status}</td>
                  <td style={{ fontSize: '12px', color: '#64748b' }}>{r.remarks || '—'}</td>
                  <td>
                    {(isDev || isManager) && <button className="delete-btn" onClick={() => setDeleteTarget(r.id)}>Delete</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog isOpen={!!deleteTarget} title="Delete Record?" message="Permanently delete this light inspection record?" confirmText="Delete" isDanger={true} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}