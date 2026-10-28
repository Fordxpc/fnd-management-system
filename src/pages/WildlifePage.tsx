import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import { ConfirmDialog } from '../components/Dialogs';

const BIRD_DB = [
  { name: 'Kiru Bondana', common: 'Kentish Plover', mass: 44, rshb: 1.5 },
  { name: 'Alaka', common: 'Grey Plover', mass: 300, rshb: 2.5 },
  { name: 'Angoti Bondana', common: 'Common Ringed Plover', mass: 64, rshb: 1.5 },
  { name: 'Beyndu', common: 'Sooty Tern', mass: 180, rshb: 1.5 },
  { name: 'Bodu Gaadhooni', common: 'Great Crested Tern', mass: 397, rshb: 5 },
  { name: 'Bodu Raabondhi', common: 'Western Reef Egret', mass: 1000, rshb: 10 },
  { name: 'Dhandifulhu Dhooni', common: 'White-Tailed Tropicbird', mass: 370, rshb: 2.5 },
  { name: 'Dondheeni', common: 'White Tern', mass: 60, rshb: 1.5 },
  { name: 'Fin’dhana', common: 'Common sandpiper', mass: 70, rshb: 1.5 },
  { name: 'Gohorukey', common: 'Pallas\'s Gull', mass: 1600, rshb: 5 },
  { name: 'Hoara Lesser', common: 'Frigatebird', mass: 800, rshb: 2.5 },
  { name: 'Kaalhu', common: 'Crow', mass: 620, rshb: 5 },
  { name: 'Kanifulhu Dhooni', common: 'Gull-Billed Tern', mass: 221, rshb: 1.5 },
  { name: 'Kurangi', common: 'Lesser Noddy', mass: 115, rshb: 1.5 },
  { name: 'Lagnaa', common: 'Great Egret', mass: 1500, rshb: 10 },
  { name: 'Maa Dhooni', common: 'Red-footed Booby', mass: 950, rshb: 5 },
  { name: 'Maaranga', common: 'Brown Noddy', mass: 140, rshb: 2.5 },
  { name: 'Rathafa', common: 'Ruddy turnstone', mass: 190, rshb: 2.5 },
  { name: 'Vaali', common: 'Bridled Tern', mass: 140, rshb: 2.5 },
  { name: 'Valla', common: 'Roseate Tern', mass: 112, rshb: 2.5 },
].sort((a, b) => a.name.localeCompare(b.name));

const ZONES = [1, 2, 3, 4, 5, 6, 7];

function WildlifePage() {
  const { profile, user } = useAuth();
  const isManager = ['developer', 'manager', 'smt'].includes(profile?.role || '');
  
  const [activeTab, setActiveTab] = useState<'form' | 'records' | 'map'>('form');
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [refNo, setRefNo] = useState(`RACL-FND-WHP-${new Date().getFullYear()}-01`);
  
  // Split wind into direction and speed
  const [windDir, setWindDir] = useState('');
  const [windSpd, setWindSpd] = useState('');
  
  const [temp, setTemp] = useState('');
  const [cloud, setCloud] = useState('');
  const [rain, setRain] = useState('N');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('08:30');
  
  const [rows, setRows] = useState<any[]>(
    Array.from({ length: 10 }, () => ({ bird: '', flocks: 'N', zones: [0,0,0,0,0,0,0] }))
  );

  const fetchRecords = useCallback(async () => {
    try {
      const data = await apiFetch('/wildlife');
      setRecords(data);
      setLoading(false);
    } catch (err: any) {
      toast.error(err.message);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
    const interval = setInterval(fetchRecords, 15000);
    return () => clearInterval(interval);
  }, [fetchRecords]);

  const handleRowChange = (index: number, field: string, value: any, zoneIdx?: number) => {
    setRows(prev => {
      const updated = [...prev];
      if (field === 'zone' && zoneIdx !== undefined) {
        updated[index].zones[zoneIdx] = Number(value) || 0;
      } else {
        updated[index][field] = value;
      }
      return updated;
    });
  };

  const calculateRisk = (row: any) => {
    if (!row.bird) return { total: 0, riskIndex: 0, status: '—', rshb: 0, action: 'Not required' };
    const dbBird = BIRD_DB.find(b => b.name === row.bird);
    const rshb = dbBird?.rshb || 0;
    const mass = dbBird?.mass || 0;
    const flocksVal = row.flocks === 'Y' ? 2 : 1;
    const totalBirds = row.zones.reduce((a: number, b: number) => a + b, 0);
    const riskIndex = Math.round(flocksVal * (mass / 1000) * rshb * totalBirds);
    
    let status = 'LOW RISK';
    let action = 'Mitigation Not required';
    if (riskIndex >= 1000) { status = 'ALERT'; action = 'Urgently mitigation required before Operation'; }
    else if (riskIndex > 250) { status = 'HIGH RISK'; action = 'Mitigation required before Operation'; }
    else if (riskIndex > 100) { status = 'MODERATE'; action = 'Advise to disparce bird near Runway Area'; }

    return { total: totalBirds, riskIndex, status, rshb, action };
  };

  const handleSave = async () => {
    const validRows = rows.filter(r => r.bird);
    if (validRows.length === 0) { toast.error('Please select at least one bird species.'); return; }

    // Auto update full name and designation
    const observerName = `${profile?.name || user?.email || 'User'} (${profile?.position || 'Staff'})`;

    try {
      await apiFetch('/wildlife', {
        method: 'POST',
        body: JSON.stringify({
          date, refNo, 
          wind: `${windDir} ${windSpd}km/h`.trim(), 
          temp, cloud, rain, startTime, endTime,
          rows: validRows,
          observer: observerName
        })
      });
      toast.success('Bird count saved successfully!');
      // ... rest of the function
      setActiveTab('records');
      setRows(Array.from({ length: 10 }, () => ({ bird: '', flocks: 'N', zones: [0,0,0,0,0,0,0] })));
      fetchRecords();
    } catch (err: any) { toast.error(err.message); }
  };

  const handlePrint = () => {
    document.body.classList.add('printing-bird-count');
    window.print();
    setTimeout(() => document.body.classList.remove('printing-bird-count'), 1000);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/wildlife/${deleteTarget}`, { method: 'DELETE' });
      toast.success('Record deleted.');
      setDeleteTarget(null);
      fetchRecords();
    } catch (err: any) { toast.error(err.message); }
  };

  if (loading) return <div className="page-content"><p>Loading Wildlife Data...</p></div>;

  return (
    <div className="page-content">
      <div className="staff-header no-print">
        <h2>🦅 Wildlife & Bird Hazard Management</h2>
      </div>

      <div className="ops-tabs no-print">
        <button className={`ops-tab-btn ${activeTab === 'form' ? 'active' : ''}`} onClick={() => setActiveTab('form')}>📝 Bird Count Form</button>
        <button className={`ops-tab-btn ${activeTab === 'records' ? 'active' : ''}`} onClick={() => setActiveTab('records')}>📁 Saved Records</button>
        <button className={`ops-tab-btn ${activeTab === 'map' ? 'active' : ''}`} onClick={() => setActiveTab('map')}>🗺️ Zone Map</button>
      </div>

      {activeTab === 'form' && (
        <div className="dash-card" style={{ padding: '24px', overflowX: 'auto', background: '#fff' }}>
          
          {/* PAGE 1: BIRD COUNT FORM */}
          <div className="bird-count-page-1">
            <div style={{ textAlign: 'center', marginBottom: '16px', fontFamily: 'Arial, sans-serif' }}>
              <img src="/racl-logo.png" alt="RACL" style={{ height: '60px', objectFit: 'contain', marginBottom: '8px' }} />
              <div style={{ fontSize: '16px', fontWeight: 'bold' }}>Wild Life Bird Count Form</div>
              <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Funadhoo Airport</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px', fontFamily: 'Arial' }}>
              <div><label style={{fontSize:'12px', fontWeight:'bold'}}>DATE:</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-1 border" /></div>
              <div><label style={{fontSize:'12px', fontWeight:'bold'}}>REF NO:</label><input value={refNo} onChange={e => setRefNo(e.target.value)} className="w-full p-1 border" /></div>
              
              {/* Wind Direction and Speed split */}
              <div>
                <label style={{fontSize:'12px', fontWeight:'bold'}}>WIND:</label>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <input placeholder="WSW" value={windDir} onChange={e => setWindDir(e.target.value)} className="w-full p-1 border" style={{ width: '40%' }} />
                  <input type="number" placeholder="31" value={windSpd} onChange={e => setWindSpd(e.target.value)} className="w-full p-1 border" style={{ width: '40%' }} />
                  <span style={{ fontSize: '11px', fontWeight: 'bold' }}>km/h</span>
                </div>
              </div>
              
              <div><label style={{fontSize:'12px', fontWeight:'bold'}}>START TIME:</label><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-1 border" /></div>
              
              {/* Temp with °C */}
              <div>
                <label style={{fontSize:'12px', fontWeight:'bold'}}>TEMPERATURE:</label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input type="number" placeholder="28" value={temp} onChange={e => setTemp(e.target.value)} className="w-full p-1 border" />
                  <span style={{ marginLeft: '4px', fontWeight: 'bold' }}>°C</span>
                </div>
              </div>

              {/* Cloud with % */}
              <div>
                <label style={{fontSize:'12px', fontWeight:'bold'}}>CLOUDY:</label>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input type="number" placeholder="100" value={cloud} onChange={e => setCloud(e.target.value)} className="w-full p-1 border" />
                  <span style={{ marginLeft: '4px', fontWeight: 'bold' }}>%</span>
                </div>
              </div>

              <div><label style={{fontSize:'12px', fontWeight:'bold'}}>RAIN LAST 24 HRS:</label><select value={rain} onChange={e => setRain(e.target.value)} className="w-full p-1 border"><option value="N">N</option><option value="Y">Y</option></select></div>
              <div><label style={{fontSize:'12px', fontWeight:'bold'}}>FINISHED @:</label><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-1 border" /></div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', textAlign: 'center', fontFamily: 'Arial' }}>
              <thead>
                <tr>
                  <th style={{border:'1px solid #000', padding:'4px', background:'#f1f5f9'}}>No:</th>
                  <th style={{border:'1px solid #000', padding:'4px', background:'#f1f5f9'}}>BIRD SPECIES</th>
                  <th style={{border:'1px solid #000', padding:'4px', background:'#f1f5f9'}}>FLOCKS (Y/N)</th>
                  <th style={{border:'1px solid #000', padding:'4px', background:'#f1f5f9'}} colSpan={7}>Concentration of Birds at Zone</th>
                  <th style={{border:'1px solid #000', padding:'4px', background:'#f1f5f9'}}>Hazardous Behaviour</th>
                  <th style={{border:'1px solid #000', padding:'4px', background:'#f1f5f9'}}>Bird Type Total @ Zones</th>
                  <th style={{border:'1px solid #000', padding:'4px', background:'#f1f5f9'}}>Status</th>
                  <th style={{border:'1px solid #000', padding:'4px', background:'#f1f5f9'}}>Action Required</th>
                </tr>
                <tr>
                  <th style={{border:'1px solid #000', padding:'4px', background:'#f1f5f9'}} colSpan={3}></th>
                  {ZONES.map(z => <th key={z} style={{border:'1px solid #000', padding:'4px', background:'#f1f5f9'}}>{z}</th>)}
                  <th style={{border:'1px solid #000', padding:'4px', background:'#f1f5f9'}}>RSHB</th>
                  <th style={{border:'1px solid #000', padding:'4px', background:'#f1f5f9'}}></th>
                  <th style={{border:'1px solid #000', padding:'4px', background:'#f1f5f9'}}></th>
                  <th style={{border:'1px solid #000', padding:'4px', background:'#f1f5f9'}}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const calc = calculateRisk(row);
                  return (
                    <tr key={i}>
                      <td style={{border:'1px solid #000', padding:'4px'}}>{i + 1}</td>
                      <td style={{border:'1px solid #000', padding:'4px'}}>
                        <select value={row.bird} onChange={e => handleRowChange(i, 'bird', e.target.value)} className="w-full p-1 border-0 text-xs text-center">
                          <option value="">Select...</option>
                          {BIRD_DB.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                        </select>
                      </td>
                      <td style={{border:'1px solid #000', padding:'4px'}}>
                        <select value={row.flocks} onChange={e => handleRowChange(i, 'flocks', e.target.value)} className="p-1 border-0 text-xs text-center">
                          <option value="N">N</option><option value="Y">Y</option>
                        </select>
                      </td>
                      {ZONES.map((_, zIdx) => (
                        <td key={zIdx} style={{border:'1px solid #000', padding:'4px'}}><input type="number" min="0" value={row.zones[zIdx] || ''} onChange={e => handleRowChange(i, 'zone', e.target.value, zIdx)} style={{width:'30px', border:'none', textAlign:'center'}} /></td>
                      ))}
                      <td style={{border:'1px solid #000', padding:'4px'}}>{calc.rshb}</td>
                      <td style={{border:'1px solid #000', padding:'4px'}} className="font-bold">{calc.total}</td>
                      <td style={{border:'1px solid #000', padding:'4px'}}>{calc.status}</td>
                      <td style={{border:'1px solid #000', padding:'4px'}}>{calc.action}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* PAGE 2: BIRD WATCH REPORT */}
          <div className="bird-count-page-2" style={{ marginTop: '40px', borderTop: '2px dashed #ccc', paddingTop: '20px' }}>
            <h3 style={{ textAlign: 'center', fontFamily: 'Arial', marginBottom: '16px' }}>Bird Watch Report</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '12px', fontFamily: 'Arial', border: '1px solid #000' }}>
              <div style={{ padding: '10px', borderRight: '1px solid #000' }}>
                <div style={{ marginBottom: '8px' }}><strong>Report No:</strong> {refNo}</div>
                <div style={{ marginBottom: '8px' }}><strong>Condition:</strong> LOW / MODERATE / SEVERE / High / ALERT</div>
                <div><strong>Legend:</strong><br/>
                  LOW: Normal bird activity, low probability.<br/>
                  MODERATE: Concentrations represent probable hazard.<br/>
                  SEVERE: Heavy concentration, immediate hazard.<br/>
                  ALERT: Weather/time makes influx likely.
                </div>
              </div>
              <div style={{ padding: '10px' }}>
                <div style={{ marginBottom: '8px' }}><strong>Issue date:</strong> {date} <strong>Review date:</strong> {date}</div>
                {/* Ensure no email is shown here */}
                <div style={{ marginBottom: '8px' }}><strong>Observer:</strong> {profile?.name || 'User'}</div>
                <div style={{ marginBottom: '8px' }}><strong>Designation:</strong> {profile?.position || 'Operations Officer'}</div>
                <div style={{ marginBottom: '8px' }}><strong>Bird/Wildlife management strategies implemented:</strong> Yes / No</div>
                <div><strong>Risk Levels:</strong> LOW (&lt;100) | MODERATE (100-250) | SEVERE (250-1000) | ALERT (&gt;1000)</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }} className="no-print">
            {isManager && <button className="add-staff-btn" onClick={handleSave}>💾 Save Bird Count</button>}
            <button className="export-btn print-btn" onClick={handlePrint}>🖨️ Print</button>
          </div>
        </div>
      )}

      {/* Records and Map tabs remain the same... */}
      {activeTab === 'records' && (
        <div className="dash-card">
          <h3>📁 Saved Bird Count Records</h3>
          <table className="mini-table mt-4">
            <thead><tr><th>Date</th><th>Ref No</th><th>Observer</th><th>Total Species</th><th>Actions</th></tr></thead>
            <tbody>
              {records.map((r: any) => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>{r.refNo}</td>
                  <td>{r.observer}</td>
                  <td>{r.rows?.length || 0}</td>
                  <td>
                    <button className="delete-btn" onClick={() => setDeleteTarget(r.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'map' && (
        <div className="dash-card" style={{ textAlign: 'center' }}>
          <h3>🗺️ Airside Zone Map</h3>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>Reference map for Bird Concentration Zones (1-7)</p>
          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
            <img src="/zone-map.png" alt="Zone Map" style={{ width: '100%', maxWidth: '800px', height: 'auto', objectFit: 'contain' }} />
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Bird Count?"
        message="Are you sure you want to delete this bird count record? This action cannot be undone."
        confirmText="Delete"
        isDanger={true}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default WildlifePage;