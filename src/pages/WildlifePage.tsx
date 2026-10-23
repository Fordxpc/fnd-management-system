import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../auth';
import { toast } from 'sonner';

// Pre-loaded Bird Database (Extracted from your Excel)
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
  
  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [refNo, setRefNo] = useState(`RACL-FND-WHP-${new Date().getFullYear()}-01`);
  const [wind, setWind] = useState('');
  const [temp, setTemp] = useState('');
  const [cloud, setCloud] = useState('');
  const [rain, setRain] = useState('N');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('08:30');
  
  // Rows State
  const [rows, setRows] = useState<any[]>(
    Array.from({ length: 10 }, () => ({ bird: '', flocks: 'N', zones: [0,0,0,0,0,0,0] }))
  );

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'bird_counts'), (snap) => {
      setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a:any, b:any) => b.createdAt.localeCompare(a.createdAt)));
    });
    return () => unsub();
  }, []);

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
    if (!row.bird) return { total: 0, riskIndex: 0, status: '—', rshb: 0 };
    const dbBird = BIRD_DB.find(b => b.name === row.bird);
    const rshb = dbBird?.rshb || 0;
    const mass = dbBird?.mass || 0;
    const flocksVal = row.flocks === 'Y' ? 2 : 1;
    const totalBirds = row.zones.reduce((a: number, b: number) => a + b, 0);
    
    // Formula: Flocks * Mass(kg) * RSHB * TotalBirds
    const riskIndex = Math.round(flocksVal * (mass / 1000) * rshb * totalBirds);
    
    let status = 'LOW RISK';
    if (riskIndex >= 1000) status = 'ALERT';
    else if (riskIndex > 250) status = 'HIGH RISK';
    else if (riskIndex > 100) status = 'MODERATE';

    return { total: totalBirds, riskIndex, status, rshb };
  };

  const handleSave = async () => {
    const validRows = rows.filter(r => r.bird);
    if (validRows.length === 0) { toast.error('Please select at least one bird species.'); return; }

    try {
      await addDoc(collection(db, 'bird_counts'), {
        date, refNo, wind, temp, cloud, rain, startTime, endTime,
        rows: validRows,
        observer: user?.email || profile?.name || 'User',
        createdAt: new Date().toISOString()
      });
      toast.success('Bird count saved successfully!');
      setActiveTab('records');
      // Reset
      setRows(Array.from({ length: 10 }, () => ({ bird: '', flocks: 'N', zones: [0,0,0,0,0,0,0] })));
    } catch (err: any) { toast.error(err.message); }
  };

  const handlePrint = () => { window.print(); };

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
        <div className="dash-card" style={{ padding: '24px', overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
            <div><label className="text-xs font-bold text-slate-500">Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded" /></div>
            <div><label className="text-xs font-bold text-slate-500">Ref No</label><input value={refNo} onChange={e => setRefNo(e.target.value)} className="w-full p-2 border rounded" /></div>
            <div><label className="text-xs font-bold text-slate-500">Start Time</label><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-2 border rounded" /></div>
            <div><label className="text-xs font-bold text-slate-500">Finish Time</label><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-2 border rounded" /></div>
            <div><label className="text-xs font-bold text-slate-500">Wind</label><input placeholder="WSW 31KM/H" value={wind} onChange={e => setWind(e.target.value)} className="w-full p-2 border rounded" /></div>
            <div><label className="text-xs font-bold text-slate-500">Temperature</label><input placeholder="28°C" value={temp} onChange={e => setTemp(e.target.value)} className="w-full p-2 border rounded" /></div>
            <div><label className="text-xs font-bold text-slate-500">Cloudy</label><input placeholder="100%" value={cloud} onChange={e => setCloud(e.target.value)} className="w-full p-2 border rounded" /></div>
            <div><label className="text-xs font-bold text-slate-500">Rain Last 24h</label><select value={rain} onChange={e => setRain(e.target.value)} className="w-full p-2 border rounded"><option value="N">N</option><option value="Y">Y</option></select></div>
          </div>

          <table className="mini-table" style={{ width: '100%', fontSize: '11px', textAlign: 'center' }}>
            <thead>
              <tr>
                <th>BIRD SPECIES</th><th>FLOCKS (Y/N)</th>
                {ZONES.map(z => <th key={z} style={{ width: '40px' }}>Z{z}</th>)}
                <th>Total</th><th>RSHB</th><th>Risk Index</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const calc = calculateRisk(row);
                return (
                  <tr key={i}>
                    <td>
                      <select value={row.bird} onChange={e => handleRowChange(i, 'bird', e.target.value)} className="w-full p-1 border rounded text-xs">
                        <option value="">Select Bird...</option>
                        {BIRD_DB.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
                      </select>
                    </td>
                    <td>
                      <select value={row.flocks} onChange={e => handleRowChange(i, 'flocks', e.target.value)} className="p-1 border rounded text-xs">
                        <option value="N">N</option><option value="Y">Y</option>
                      </select>
                    </td>
                    {ZONES.map((_, zIdx) => (
                      <td key={zIdx}><input type="number" min="0" value={row.zones[zIdx] || ''} onChange={e => handleRowChange(i, 'zone', e.target.value, zIdx)} className="w-10 p-1 border rounded text-center" /></td>
                    ))}
                    <td className="font-bold">{calc.total}</td>
                    <td>{calc.rshb}</td>
                    <td className="font-bold" style={{ color: calc.riskIndex > 250 ? '#dc2626' : calc.riskIndex > 100 ? '#f59e0b' : '#16a34a' }}>{calc.riskIndex}</td>
                    <td><span className="status-badge" style={{ fontSize: '10px', background: calc.status === 'ALERT' ? '#fee2e2' : calc.status === 'HIGH RISK' ? '#fef3c7' : calc.status === 'MODERATE' ? '#fef08a' : '#dcfce7' }}>{calc.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            {isManager && <button className="add-staff-btn" onClick={handleSave}>💾 Save Bird Count</button>}
            <button className="export-btn print-btn" onClick={handlePrint}>🖨️ Print</button>
          </div>
        </div>
      )}

      {activeTab === 'records' && (
        <div className="dash-card">
          <h3>📁 Saved Bird Count Records</h3>
          <table className="mini-table mt-4">
            <thead><tr><th>Date</th><th>Ref No</th><th>Observer</th><th>Total Species</th><th>Actions</th></tr></thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td>{r.date}</td>
                  <td>{r.refNo}</td>
                  <td>{r.observer}</td>
                  <td>{r.rows.length}</td>
                  <td>
                    <button className="delete-btn" onClick={() => deleteDoc(doc(db, 'bird_counts', r.id))}>Delete</button>
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
          <div style={{ background: '#f8fafc', height: '400px', borderRadius: '12px', border: '2px dashed #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 800 }}>[ ZONE MAP IMAGE ]</h2>
            <p>Upload your airport diagram here.</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{ background: '#dc2626', color: '#fff', padding: '4px 12px', borderRadius: '4px' }}>Zone 1 (RWY)</span>
              <span style={{ background: '#f59e0b', color: '#fff', padding: '4px 12px', borderRadius: '4px' }}>Zone 2 (Inflight)</span>
              <span style={{ background: '#eab308', color: '#fff', padding: '4px 12px', borderRadius: '4px' }}>Zone 3 (TXY)</span>
              <span style={{ background: '#84cc16', color: '#fff', padding: '4px 12px', borderRadius: '4px' }}>Zone 4 (Strip)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WildlifePage;