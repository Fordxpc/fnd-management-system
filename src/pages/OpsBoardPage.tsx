import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';

const AIRCRAFT_OPTIONS = ['DH-8/200', 'DH-8/300', 'ATR-42/600', 'ATR-72/600', 'CUSTOM'];

const DEFAULT_STAFF = ['ADAM SHAKIR', 'ADAM FAISAL', 'MOHAMED ADAM', 'MOHAMED SAMEEH', 'MOHAMED NADHEEM', 'ISMAIL KAMEEL', 'THORIQ MOHAMED', 'AHMED ASEEL'];

const DEFAULT_TASKS = [
  { id: 'chocks-on', label: 'CHOCKS ON', color: 'linear-gradient(135deg, #ec407a, #ad1457)', text: '#fff' },
  { id: 'cone-setup', label: 'CONE SET UP', color: 'linear-gradient(135deg, #00c6ff, #0072ff)', text: '#fff' },
  { id: 'unload-back', label: 'UNLOADING — BACK HOLD', color: 'linear-gradient(135deg, #66bb6a, #2e7d32)', text: '#fff' },
  { id: 'unload-front', label: 'UNLOADING — FRONT HOLD', color: 'linear-gradient(135deg, #ffee58, #fbc02d)', text: '#1a1a1a' },
  { id: 'unload-hall', label: 'UNLOADING — ARRIVAL HALL', color: 'linear-gradient(135deg, #ab47bc, #6a1b9a)', text: '#fff' },
  { id: 'load-front', label: 'LOADING — FRONT HOLD', color: 'linear-gradient(135deg, #ffa726, #e65100)', text: '#fff' },
  { id: 'load-back', label: 'LOADING — BACK HOLD', color: 'linear-gradient(135deg, #26c6da, #00838f)', text: '#fff' },
  { id: 'cone-pickup', label: 'CONE PICK UP', color: 'linear-gradient(135deg, #ffca28, #ff8f00)', text: '#1a1a1a' },
  { id: 'chocks-off', label: 'CHOCKS OFF', color: 'linear-gradient(135deg, #7e57c2, #4527a0)', text: '#fff' },
  { id: 'door', label: 'DOOR OPEN / CLOSE', color: 'linear-gradient(135deg, #26a69a, #00695c)', text: '#fff' },
  { id: 'wchc', label: '♿ WCHC — FIRE-FIGHTER ASSIST', color: 'linear-gradient(135deg, #ef5350, #b71c1c)', text: '#fff' },
  { id: 'wchr', label: '♿ WCHR — CLEANING TEAM ASSIST', color: 'linear-gradient(135deg, #8d6e63, #4e342e)', text: '#fff' },
];

function OpsBoardPage() {
  const [activeTab, setActiveTab] = useState<'runway' | 'ground'>('runway');
  const [staffPool, setStaffPool] = useState<string[]>(DEFAULT_STAFF);
  const [newStaff, setNewStaff] = useState('');

  // Runway State
  const [rwy19, setRwy19] = useState<string[]>([]);
  const [rwy01, setRwy01] = useState<string[]>([]);
  const [lights, setLights] = useState<string[]>([]);
  const runwayRef = useRef<HTMLDivElement>(null);

  // Ground State
  const [tasks, setTasks] = useState(DEFAULT_TASKS);
  const [groundAssign, setGroundAssign] = useState<{ [key: string]: string[] }>({});
  const groundRef = useRef<HTMLDivElement>(null);

  // Handle staff toggling for Runway (prevents cross-assignment)
  const toggleRunway = (zone: '19' | '01' | 'lights', name: string) => {
    // Check if assigned elsewhere
    if (zone !== '19' && rwy19.includes(name)) { toast.error('Already assigned to RWY 19'); return; }
    if (zone !== '01' && rwy01.includes(name)) { toast.error('Already assigned to RWY 01'); return; }
    if (zone !== 'lights' && lights.includes(name)) { toast.error('Already assigned to Lights'); return; }

    if (zone === '19') setRwy19(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
    if (zone === '01') setRwy01(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
    if (zone === 'lights') setLights(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  // Handle Ground task toggling
  const toggleGround = (taskId: string, name: string) => {
    setGroundAssign(prev => {
      const current = prev[taskId] || [];
      const updated = current.includes(name) ? current.filter(n => n !== name) : [...current, name];
      return { ...prev, [taskId]: updated };
    });
  };

  const handleAddStaff = (e: any) => {
    e.preventDefault();
    if (!newStaff.trim()) return;
    const name = newStaff.trim().toUpperCase();
    if (staffPool.includes(name)) { toast.error('Staff already in pool'); return; }
    setStaffPool([...staffPool, name]);
    setNewStaff('');
  };

  // THE FIX: Export using a forced Desktop Width to prevent mobile squeezing
  const exportBoard = async (ref: React.RefObject<HTMLDivElement>, filename: string) => {
    if (!ref.current) return;
    toast.info('Generating high-quality image...');
    
    // We clone the node so we don't mess up the screen view
    const clone = ref.current.cloneNode(true) as HTMLElement;
    
    // Force fixed width
    clone.style.position = 'fixed';
    clone.style.left = '-9999px';
    clone.style.top = '0';
    clone.style.width = '1200px';
    clone.style.background = '#141414';
    
    document.body.appendChild(clone);

    try {
      const canvas = await html2canvas(clone, {
        scale: 2,
        backgroundColor: '#141414',
        width: 1200,
        windowWidth: 1200,
      });
      
      document.body.removeChild(clone);
      
      const link = document.createElement('a');
      link.download = `${filename}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
      toast.success('Downloaded successfully!');
    } catch (err: any) {
      document.body.removeChild(clone);
      toast.error('Export failed: ' + err.message);
    }
  };

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>📋 Daily Operations Board</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <form onSubmit={handleAddStaff} style={{ display: 'flex', gap: '8px' }}>
            <input placeholder="Add Staff Name..." value={newStaff} onChange={e => setNewStaff(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            <button type="submit" className="quick-btn" style={{ background: '#0b2b4f', color: 'white' }}>+ Add</button>
          </form>
        </div>
      </div>

      <div className="ops-tabs">
        <button className={`ops-tab-btn ${activeTab === 'runway' ? 'active' : ''}`} onClick={() => setActiveTab('runway')}>✈️ Runway Inspection</button>
        <button className={`ops-tab-btn ${activeTab === 'ground' ? 'active' : ''}`} onClick={() => setActiveTab('ground')}>🛬 Ground Task Allocation</button>
      </div>

      {/* ===== RUNWAY TAB ===== */}
      {activeTab === 'runway' && (
        <div>
          <div className="dash-card" style={{ marginBottom: '20px' }}>
            <h3>Assign Staff (Cannot be in multiple zones)</h3>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '12px' }}>
              {staffPool.map(s => (
                <div key={s} style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px' }}>{s}</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <label style={{ fontSize: '11px' }}><input type="checkbox" checked={rwy19.includes(s)} onChange={() => toggleRunway('19', s)} disabled={rwy01.includes(s) || lights.includes(s)} /> RWY 19</label>
                    <label style={{ fontSize: '11px' }}><input type="checkbox" checked={rwy01.includes(s)} onChange={() => toggleRunway('01', s)} disabled={rwy19.includes(s) || lights.includes(s)} /> RWY 01</label>
                    <label style={{ fontSize: '11px' }}><input type="checkbox" checked={lights.includes(s)} onChange={() => toggleRunway('lights', s)} disabled={rwy19.includes(s) || rwy01.includes(s)} /> Lights</label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
            <button className="add-staff-btn" style={{ background: '#0b2b4f' }} onClick={() => exportBoard(runwayRef, 'FND_Runway_Board')}>📸 Export JPG</button>
          </div>

          <div className="ops-board-export-area">
            <div className="ops-board-fixed-width" ref={runwayRef}>
              <div className="ops-board-title">FND RUNWAY INSPECTION BOARD</div>
              <div className="ops-grid-3">
                <div className="ops-card">
                  <div className="ops-card-header" style={{ background: 'linear-gradient(135deg, #ef5350, #c62828)', color: 'white' }}>RWY 19</div>
                  <div className="ops-card-body">
                    {rwy19.length ? rwy19.map(n => <div key={n} className="ops-name-row">{n}</div>) : <div className="ops-name-row empty">—</div>}
                  </div>
                </div>
                <div className="ops-card">
                  <div className="ops-card-header" style={{ background: 'linear-gradient(135deg, #42a5f5, #1565c0)', color: 'white' }}>RWY 01</div>
                  <div className="ops-card-body">
                    {rwy01.length ? rwy01.map(n => <div key={n} className="ops-name-row">{n}</div>) : <div className="ops-name-row empty">—</div>}
                  </div>
                </div>
                <div className="ops-card">
                  <div className="ops-card-header" style={{ background: 'linear-gradient(135deg, #ffee58, #fbc02d)', color: '#1a1a1a' }}>LIGHT INSPECTION</div>
                  <div className="ops-card-body">
                    {lights.length ? lights.map(n => <div key={n} className="ops-name-row">{n}</div>) : <div className="ops-name-row empty">—</div>}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'center', color: '#aaa', marginTop: '20px', fontSize: '14px' }}>{new Date().toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {/* ===== GROUND TAB ===== */}
      {activeTab === 'ground' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
            <button className="add-staff-btn" style={{ background: '#0b2b4f' }} onClick={() => exportBoard(groundRef, 'FND_Ground_Board')}>📸 Export JPG</button>
          </div>

          <div className="dash-card" style={{ marginBottom: '20px' }}>
            <h3>Assign Staff to Tasks</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
              {tasks.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                  <span style={{ width: '250px', fontWeight: 700, fontSize: '12px' }}>{t.label}</span>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {staffPool.map(s => (
                      <label key={s} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', background: (groundAssign[t.id] || []).includes(s) ? '#dbeafe' : '#f8fafc', padding: '4px 8px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                        <input type="checkbox" checked={(groundAssign[t.id] || []).includes(s)} onChange={() => toggleGround(t.id, s)} />
                        {s}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ops-board-export-area">
            <div className="ops-board-fixed-width" ref={groundRef}>
              <div className="ops-board-title">FND FLIGHT OPERATIONS — GROUND TASK BOARD</div>
              
              <div className="ops-grid-3">
                {tasks.map(t => {
                  const assigned = groundAssign[t.id] || [];
                  return (
                    <div key={t.id} className="ops-card">
                      <div className="ops-card-header" style={{ background: t.color, color: t.text }}>{t.label}</div>
                      <div className="ops-card-body">
                        {assigned.length ? assigned.map(n => <div key={n} className="ops-name-row">{n}</div>) : <div className="ops-name-row empty">—</div>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="ops-notes">
                <h4>📋 Operational Notes & Standing Instructions</h4>
                <ol>
                  <li>Aircraft cabin cleaning shall commence only after complete passenger disembarkation.</li>
                  <li>WCHR passengers shall be transported to the aircraft door during the departure phase.</li>
                  <li>Upon task completion, personnel shall assist passengers in proceeding to the aircraft door. Exit from the terminal area is prohibited until the aircraft is airborne.</li>
                </ol>
              </div>

              <div style={{ textAlign: 'center', color: '#aaa', marginTop: '20px', fontSize: '14px' }}>{new Date().toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default OpsBoardPage;