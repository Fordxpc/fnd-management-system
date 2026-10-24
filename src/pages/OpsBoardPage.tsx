import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, limit, deleteDoc, doc } from 'firebase/firestore';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useAuth } from '../auth';

const DEFAULT_STAFF = [
  'ADAM SHAKIR', 'ADAM FAISAL', 'MOHAMED ADAM', 'MOHAMED SAMEEH', 'MOHAMED NADHEEM', 
  'ISMAIL KAMEEL', 'THORIQ MOHAMED', 'AHMED ASEEL', 'MOHAMED IBRAHIM', 'ZIMLA AYYOOB', 'AMINATH MOOSA'
];

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
  { id: 'aircraft-cleaning', label: 'AIRCRAFT CLEANING', color: 'linear-gradient(135deg, #64748b, #475569)', text: '#fff' },
  { id: 'wchc', label: '♿ WCHC — FIRE-FIGHTER ASSIST', color: 'linear-gradient(135deg, #ef5350, #b71c1c)', text: '#fff' },
  { id: 'wchr', label: '♿ WCHR — CLEANING TEAM ASSIST', color: 'linear-gradient(135deg, #8d6e63, #4e342e)', text: '#fff' },
];

const formatDate = (date: Date) => date.toISOString().split('T')[0];

function OpsBoardPage() {
  const { profile, user } = useAuth();
  
  const isDev = profile?.role === 'developer';
  const isManager = profile?.role === 'manager' || profile?.role === 'owner' || profile?.role === 'admin';
  const isSMT = profile?.role === 'smt' || profile?.isSMT === true;
  const dept = profile?.department || '';
  const isOpsOrSafety = dept === 'Ground Operations' || dept === 'Safety';
  
  const canEdit = isDev || isManager || (isSMT && isOpsOrSafety);
  const canView = canEdit || isSMT || isOpsOrSafety;

  const [activeTab, setActiveTab] = useState<'runway' | 'ground' | 'fod' | 'history'>('runway');
  
  // Persistent Staff Pool
  const [staffPool, setStaffPool] = useState<string[]>(() => {
    const saved = localStorage.getItem('ops_staff_pool');
    return saved ? JSON.parse(saved) : DEFAULT_STAFF;
  });
  const [newStaff, setNewStaff] = useState('');

  useEffect(() => {
    localStorage.setItem('ops_staff_pool', JSON.stringify(staffPool));
  }, [staffPool]);

  const [rwy19, setRwy19] = useState<string[]>([]);
  const [rwy01, setRwy01] = useState<string[]>([]);
  const [lights, setLights] = useState<string[]>([]);
  const runwayRef = useRef<HTMLDivElement>(null);

  const [tasks] = useState(DEFAULT_TASKS);
  const [groundAssign, setGroundAssign] = useState<{ [key: string]: string[] }>({});
  const groundRef = useRef<HTMLDivElement>(null);

  const [fodList, setFodList] = useState<any[]>([]);
  const [fodForm, setFodForm] = useState({ date: formatDate(new Date()), grams: '', remarks: '' });
  const [fodSubmitting, setFodSubmitting] = useState(false);

  const [runwayHistory, setRunwayHistory] = useState<any[]>([]);
  const [groundHistory, setGroundHistory] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // Load Draft from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('ops_board_draft');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setRwy19(parsed.rwy19 || []);
        setRwy01(parsed.rwy01 || []);
        setLights(parsed.lights || []);
        setGroundAssign(parsed.groundAssign || {});
      } catch (e) {
        console.error("Failed to load draft", e);
      }
    }
  }, []);

  // Save Draft to LocalStorage
  useEffect(() => {
    localStorage.setItem('ops_board_draft', JSON.stringify({ rwy19, rwy01, lights, groundAssign }));
  }, [rwy19, rwy01, lights, groundAssign]);

  useEffect(() => {
    const qRunway = query(collection(db, 'ops_runway_history'), orderBy('createdAt', 'desc'), limit(200));
    const unsubR = onSnapshot(qRunway, (snap) => setRunwayHistory(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qGround = query(collection(db, 'ops_ground_history'), orderBy('createdAt', 'desc'), limit(200));
    const unsubG = onSnapshot(qGround, (snap) => setGroundHistory(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qFod = query(collection(db, 'fod_collections'), orderBy('date', 'desc'), limit(200));
    const unsubF = onSnapshot(qFod, (snap) => setFodList(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => { unsubR(); unsubG(); unsubF(); };
  }, []);

  const toggleRunway = (zone: '19' | '01' | 'lights', name: string) => {
    if (!canEdit) return;
    if (zone !== '19' && rwy19.includes(name)) { toast.error('Already assigned to RWY 19'); return; }
    if (zone !== '01' && rwy01.includes(name)) { toast.error('Already assigned to RWY 01'); return; }
    if (zone !== 'lights' && lights.includes(name)) { toast.error('Already assigned to Lights'); return; }

    if (zone === '19') setRwy19(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
    if (zone === '01') setRwy01(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
    if (zone === 'lights') setLights(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  const toggleGround = (taskId: string, name: string) => {
    if (!canEdit) return;
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

  const handleRemoveStaff = (name: string) => {
    if (!window.confirm(`Remove ${name} permanently from the staff list?`)) return;
    setStaffPool(prev => prev.filter(s => s !== name));
  };

  const saveRunwayData = async () => {
    try {
      await addDoc(collection(db, 'ops_runway_history'), {
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString(),
        createdAt: new Date().toISOString(),
        rwy19, rwy01, lights
      });
      toast.success('Runway board saved to history!');
    } catch (err: any) { toast.error(err.message); }
  };

  const saveGroundData = async () => {
    try {
      await addDoc(collection(db, 'ops_ground_history'), {
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString(),
        createdAt: new Date().toISOString(),
        assignments: groundAssign
      });
      toast.success('Ground board saved to history!');
    } catch (err: any) { toast.error(err.message); }
  };

  const handleSaveFOD = async (e: any) => {
    e.preventDefault();
    if (!fodForm.grams || !fodForm.remarks) { toast.error('Please enter grams and remarks'); return; }
    setFodSubmitting(true);
    try {
      await addDoc(collection(db, 'fod_collections'), {
        ...fodForm,
        grams: Number(fodForm.grams),
        loggedBy: user?.email || '',
        createdAt: new Date().toISOString()
      });
      toast.success('FOD entry recorded!');
      setFodForm({ date: formatDate(new Date()), grams: '', remarks: '' });
    } catch (err: any) { toast.error(err.message); }
    setFodSubmitting(false);
  };

  const handleDeleteFOD = async (id: string) => {
    if (!window.confirm('Delete this FOD record?')) return;
    try {
      await deleteDoc(doc(db, 'fod_collections', id));
      toast.success('FOD record deleted');
    } catch (err: any) { toast.error(err.message); }
  };

  const exportBoard = async (ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
    if (!ref.current) return;
    toast.info('Generating high-quality image...');
    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.left = '-9999px';
    wrapper.style.top = '0';
    wrapper.style.width = '1200px';
    wrapper.style.background = '#141414';
    wrapper.style.padding = '20px';

    const clone = ref.current.cloneNode(true) as HTMLElement;
    clone.style.width = '100%';
    clone.style.background = 'transparent';
    clone.style.overflow = 'visible';

    const grids = clone.querySelectorAll('.ops-grid-3');
    grids.forEach(g => {
      const el = g as HTMLElement;
      el.style.display = 'grid';
      el.style.gridTemplateColumns = 'repeat(3, 1fr)';
      el.style.gridAutoFlow = 'row';
      el.style.gap = '12px';
      el.style.overflow = 'visible';
      el.style.width = '100%';
    });

    clone.querySelectorAll('.ops-card').forEach(c => {
      const el = c as HTMLElement;
      el.style.width = '100%';
      el.style.minWidth = '0';
      el.style.overflow = 'hidden';
      (el.style as any).breakInside = 'avoid';
    });

    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);
    void wrapper.offsetHeight;

    try {
      const canvas = await html2canvas(wrapper, {
        scale: 2,
        backgroundColor: '#141414',
        width: wrapper.scrollWidth,
        height: wrapper.scrollHeight,
        windowWidth: wrapper.scrollWidth,
        windowHeight: wrapper.scrollHeight
      });
      document.body.removeChild(wrapper);
      const link = document.createElement('a');
      link.download = `${filename}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
      toast.success('Downloaded successfully!');
    } catch (err: any) {
      document.body.removeChild(wrapper);
      toast.error('Export failed: ' + err.message);
    }
  };

  const allHistory = [
    ...runwayHistory.map(h => ({ ...h, type: 'runway' })),
    ...groundHistory.map(h => ({ ...h, type: 'ground' }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const staffUtilization: { [name: string]: { runway: number, ground: number } } = {};
  allHistory.forEach(h => {
    if (h.type === 'runway') {
      [...(h.rwy19 || []), ...(h.rwy01 || []), ...(h.lights || [])].forEach((n: string) => {
        if (!staffUtilization[n]) staffUtilization[n] = { runway: 0, ground: 0 };
        staffUtilization[n].runway++;
      });
    } else {
      Object.values(h.assignments || {}).flat().forEach((n: any) => {
        if (!staffUtilization[n]) staffUtilization[n] = { runway: 0, ground: 0 };
        staffUtilization[n].ground++;
      });
    }
  });

  const chartData = Object.entries(staffUtilization).map(([name, data]) => ({
    name, runway: data.runway, ground: data.ground, total: data.runway + data.ground
  })).sort((a, b) => b.total - a.total).slice(0, 10);

  const indHistory = selectedStaff ? allHistory.filter(h => {
    if (h.type === 'runway') return [...(h.rwy19 || []), ...(h.rwy01 || []), ...(h.lights || [])].includes(selectedStaff);
    return Object.values(h.assignments || {}).flat().includes(selectedStaff);
  }) : [];

  const indTaskCounts: { [task: string]: number } = {};
  indHistory.forEach(h => {
    if (h.type === 'runway') {
      if (h.rwy19.includes(selectedStaff)) indTaskCounts['RWY 19 Inspection'] = (indTaskCounts['RWY 19 Inspection'] || 0) + 1;
      if (h.rwy01.includes(selectedStaff)) indTaskCounts['RWY 01 Inspection'] = (indTaskCounts['RWY 01 Inspection'] || 0) + 1;
      if (h.lights.includes(selectedStaff)) indTaskCounts['Light Inspection'] = (indTaskCounts['Light Inspection'] || 0) + 1;
    } else {
      Object.entries(h.assignments || {}).forEach(([taskId, names]: any) => {
        if (names.includes(selectedStaff)) {
          const label = tasks.find(t => t.id === taskId)?.label || taskId;
          indTaskCounts[label] = (indTaskCounts[label] || 0) + 1;
        }
      });
    }
  });

  if (!canView) return <div className="page-content"><div className="empty-state"><h2>Access Denied</h2><p>You do not have permission to view the Operations Board.</p></div></div>;

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>📋 Daily Operations Board</h2>
        {canEdit && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <form onSubmit={handleAddStaff} style={{ display: 'flex', gap: '8px' }}>
              <input placeholder="Add Staff Name..." value={newStaff} onChange={e => setNewStaff(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <button type="submit" className="quick-btn" style={{ background: '#0b2b4f', color: 'white' }}>+ Add</button>
            </form>
          </div>
        )}
      </div>

      <div className="ops-tabs">
        <button className={`ops-tab-btn ${activeTab === 'runway' ? 'active' : ''}`} onClick={() => setActiveTab('runway')}>✈️ Runway Inspection</button>
        <button className={`ops-tab-btn ${activeTab === 'ground' ? 'active' : ''}`} onClick={() => setActiveTab('ground')}>🛬 Ground Task Allocation</button>
        <button className={`ops-tab-btn ${activeTab === 'fod' ? 'active' : ''}`} onClick={() => setActiveTab('fod')}>🪨 FOD Collection</button>
        <button className={`ops-tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>📊 History & Reports</button>
      </div>

      {/* ===== RUNWAY TAB ===== */}
      {activeTab === 'runway' && (
        <div>
          {canEdit && (
            <div className="dash-card" style={{ marginBottom: '20px' }}>
              <h3>Assign Staff (Cannot be in multiple zones)</h3>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '12px' }}>
                {staffPool.map(s => (
                  <div key={s} style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px' }}>{s}</span>
                      <button onClick={() => handleRemoveStaff(s)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '12px' }}>✖</button>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <label style={{ fontSize: '11px' }}><input type="checkbox" checked={rwy19.includes(s)} onChange={() => toggleRunway('19', s)} disabled={rwy01.includes(s) || lights.includes(s)} /> RWY 19</label>
                      <label style={{ fontSize: '11px' }}><input type="checkbox" checked={rwy01.includes(s)} onChange={() => toggleRunway('01', s)} disabled={rwy19.includes(s) || lights.includes(s)} /> RWY 01</label>
                      <label style={{ fontSize: '11px' }}><input type="checkbox" checked={lights.includes(s)} onChange={() => toggleRunway('lights', s)} disabled={rwy19.includes(s) || rwy01.includes(s)} /> Lights</label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {canEdit && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '12px' }}>
              <button className="quick-btn" style={{ background: '#059669', color: 'white' }} onClick={saveRunwayData}>💾 Save to Database</button>
              <button className="add-staff-btn" style={{ background: '#0b2b4f' }} onClick={() => exportBoard(runwayRef, 'FND_Runway_Board')}>📸 Export JPG</button>
            </div>
          )}

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
          {canEdit && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '12px' }}>
              <button className="quick-btn" style={{ background: '#059669', color: 'white' }} onClick={saveGroundData}>💾 Save to Database</button>
              <button className="add-staff-btn" style={{ background: '#0b2b4f' }} onClick={() => exportBoard(groundRef, 'FND_Ground_Board')}>📸 Export JPG</button>
            </div>
          )}

          {canEdit && (
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
          )}

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
                        {assigned.length ? (
                          assigned.map((n, idx) => (
                            <div key={n} className="ops-name-row">
                              {idx === 0 ? '⭐ ' : ''} {n}
                            </div>
                          ))
                        ) : <div className="ops-name-row empty">—</div>}
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

      {/* ===== FOD TAB ===== */}
      {activeTab === 'fod' && (
        <div className="dash-grid">
          <div className="dash-card">
            <h3>🪨 Log FOD Collection</h3>
            <form onSubmit={handleSaveFOD} className="staff-form" style={{ gridTemplateColumns: '1fr', padding: 0, boxShadow: 'none' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Date</label>
                <input type="date" value={fodForm.date} onChange={e => setFodForm({ ...fodForm, date: e.target.value })} required />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Stone Count (grams)</label>
                <input type="number" placeholder="e.g. 15" value={fodForm.grams} onChange={e => setFodForm({ ...fodForm, grams: e.target.value })} required />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Remarks / Details</label>
                <input placeholder="e.g. Small rocks found near RWY 19" value={fodForm.remarks} onChange={e => setFodForm({ ...fodForm, remarks: e.target.value })} required />
              </div>
              <button type="submit" disabled={fodSubmitting} style={{ gridColumn: 'span 1' }}>
                {fodSubmitting ? 'Saving...' : 'Save FOD Entry'}
              </button>
            </form>
          </div>

          <div className="dash-card">
            <h3>📋 Recent FOD Collections</h3>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="mini-table">
                <thead><tr><th>Date</th><th>Grams</th><th>Remarks</th><th>Logged By</th><th></th></tr></thead>
                <tbody>
                  {fodList.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center' }}>No FOD records yet.</td></tr>
                  ) : fodList.map(f => (
                    <tr key={f.id}>
                      <td>{f.date}</td>
                      <td style={{ fontWeight: 800, color: '#dc2626' }}>{f.grams}g</td>
                      <td style={{ fontSize: '12px' }}>{f.remarks}</td>
                      <td style={{ fontSize: '11px', color: '#64748b' }}>{f.loggedBy.split('@')[0]}</td>
                      <td>
                        {canEdit && <button className="delete-btn" onClick={() => handleDeleteFOD(f.id)}>Delete</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== HISTORY TAB ===== */}
      {activeTab === 'history' && (
        <div>
          <div className="dash-stats" style={{ marginBottom: '20px' }}>
            <div className="stat-card"><div className="stat-icon" style={{ background: '#fee2e2', color: '#991b1b' }}>✈️</div><div><div className="stat-value">{runwayHistory.length}</div><div className="stat-label">Runway Boards Saved</div></div></div>
            <div className="stat-card"><div className="stat-icon" style={{ background: '#dcfce7', color: '#065f46' }}>🛬</div><div><div className="stat-value">{groundHistory.length}</div><div className="stat-label">Ground Boards Saved</div></div></div>
            <div className="stat-card"><div className="stat-icon" style={{ background: '#dbeafe', color: '#1e40af' }}>👤</div><div><div className="stat-value">{Object.keys(staffUtilization).length}</div><div className="stat-label">Staff Involved</div></div></div>
          </div>

          <div className="dash-grid" style={{ marginBottom: '20px' }}>
            <div className="dash-card">
              <h3>🔍 Individual Staff Record</h3>
              <select value={selectedStaff} onChange={e => setSelectedStaff(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginTop: '10px', marginBottom: '16px' }}>
                <option value="">— Select Staff —</option>
                {staffPool.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              {selectedStaff ? (
                <div>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ flex: 1, background: '#f8fafc', padding: '10px', borderRadius: '6px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#0b2b4f' }}>{indHistory.length}</div>
                      <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700 }}>TOTAL SHIFTS</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>Task Breakdown:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '150px', overflowY: 'auto' }}>
                    {Object.entries(indTaskCounts).map(([task, count]) => (
                      <div key={task} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0', borderBottom: '1px dashed #e2e8f0' }}>
                        <span>{task}</span>
                        <span style={{ fontWeight: 700, background: '#e2e8f0', padding: '2px 8px', borderRadius: '10px' }}>x {count}</span>
                      </div>
                    ))}
                    {Object.keys(indTaskCounts).length === 0 && <span style={{ fontSize: '12px', color: '#94a3b8' }}>No tasks found.</span>}
                  </div>
                </div>
              ) : <p style={{ fontSize: '12px', color: '#94a3b8' }}>Select a staff member to see their history.</p>}
            </div>

            <div className="dash-card">
              <h3>📈 Top Staff Utilization</h3>
              <div style={{ width: '100%', height: 200, marginTop: '10px' }}>
                {chartData.length === 0 ? <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: '40px' }}>No data yet.</p> : (
                  <ResponsiveContainer>
                    <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="runway" name="Runway" stackId="a" fill="#dc2626" />
                      <Bar dataKey="ground" name="Ground" stackId="a" fill="#2563eb" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="dash-card">
            <h3>📋 History Logs</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
              {allHistory.length === 0 ? <div className="empty-state"><p>No history found.</p></div> : allHistory.map(h => {
                const isExpanded = expandedLog === h.id;
                return (
                  <div key={h.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    <button
                      onClick={() => setExpandedLog(isExpanded ? null : h.id)}
                      style={{ width: '100%', padding: '12px 16px', background: '#f8fafc', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                    >
                      <div>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: h.type === 'runway' ? '#dc2626' : '#2563eb' }}>
                          {h.type === 'runway' ? '✈️ Runway Inspection' : '🛬 Ground Task Board'}
                        </span>
                        <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '12px' }}>
                          {h.date} at {h.time}
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600 }}>{isExpanded ? 'Hide Details ▲' : 'Show Details ▼'}</span>
                    </button>

                    {isExpanded && (
                      <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0', background: 'white', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {h.type === 'runway' ? (
                          <>
                            <div style={{ background: '#fef2f2', padding: '10px', borderRadius: '6px', border: '1px solid #fecaca' }}>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: '#991b1b' }}>RWY 19</div>
                              <div style={{ fontSize: '13px', marginTop: '4px' }}>{h.rwy19?.join(', ') || '—'}</div>
                            </div>
                            <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e40af' }}>RWY 01</div>
                              <div style={{ fontSize: '13px', marginTop: '4px' }}>{h.rwy01?.join(', ') || '—'}</div>
                            </div>
                            <div style={{ background: '#fef3c7', padding: '10px', borderRadius: '6px', border: '1px solid #fde68a', gridColumn: 'span 2' }}>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: '#92400e' }}>LIGHT INSPECTION</div>
                              <div style={{ fontSize: '13px', marginTop: '4px' }}>{h.lights?.join(', ') || '—'}</div>
                            </div>
                          </>
                        ) : (
                          Object.entries(h.assignments || {}).map(([taskId, names]: any) => {
                            if (!names || names.length === 0) return null;
                            const label = tasks.find(t => t.id === taskId)?.label || taskId;
                            return (
                              <div key={taskId} style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>{label}</div>
                                <div style={{ fontSize: '13px', marginTop: '4px' }}>{names.join(', ')}</div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OpsBoardPage;