import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useAuth } from '../auth';
import { ConfirmDialog } from '../components/Dialogs';
import { canViewOpsBoard, canEditOpsBoard } from '../lib/permissions';

const DEFAULT_TASKS = [{ id: 'chocks-on', label: 'CHOCKS ON', color: 'linear-gradient(135deg, #ec407a, #ad1457)', text: '#fff' }, { id: 'cone-setup', label: 'CONE SET UP', color: 'linear-gradient(135deg, #00c6ff, #0072ff)', text: '#fff' }, { id: 'unload-back', label: 'UNLOADING — BACK HOLD', color: 'linear-gradient(135deg, #66bb6a, #2e7d32)', text: '#fff' }, { id: 'unload-front', label: 'UNLOADING — FRONT HOLD', color: 'linear-gradient(135deg, #ffee58, #fbc02d)', text: '#1a1a1a' }, { id: 'unload-hall', label: 'UNLOADING — ARRIVAL HALL', color: 'linear-gradient(135deg, #ab47bc, #6a1b9a)', text: '#fff' }, { id: 'load-front', label: 'LOADING — FRONT HOLD', color: 'linear-gradient(135deg, #ffa726, #e65100)', text: '#fff' }, { id: 'load-back', label: 'LOADING — BACK HOLD', color: 'linear-gradient(135deg, #26c6da, #00838f)', text: '#fff' }, { id: 'cone-pickup', label: 'CONE PICK UP', color: 'linear-gradient(135deg, #ffca28, #ff8f00)', text: '#1a1a1a' }, { id: 'chocks-off', label: 'CHOCKS OFF', color: 'linear-gradient(135deg, #7e57c2, #4527a0)', text: '#fff' }, { id: 'door', label: 'DOOR OPEN / CLOSE', color: 'linear-gradient(135deg, #26a69a, #00695c)', text: '#fff' }, { id: 'aircraft-cleaning', label: 'AIRCRAFT CLEANING', color: 'linear-gradient(135deg, #64748b, #475569)', text: '#fff' }, { id: 'wchc', label: '♿ WCHC — FIRE-FIGHTER ASSIST', color: 'linear-gradient(135deg, #ef5350, #b71c1c)', text: '#fff' }, { id: 'wchr', label: '♿ WCHR — CLEANING TEAM ASSIST', color: 'linear-gradient(135deg, #8d6e63, #4e342e)', text: '#fff' }];
const formatDate = (date: Date) => date.toISOString().split('T')[0];
const INITIAL_DATE = formatDate(new Date());
const BOARD_TIMESTAMP = new Date().toLocaleString();

const readStoredArray = <T,>(key: string, fallback: T[]): T[] => {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const readStoredDraft = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem('ops_board_draft') || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

function OpsBoardPage() {
  const { profile, user } = useAuth();

  const [dataReady, setDataReady] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [myStaff, setMyStaff] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'runway' | 'ground' | 'fod' | 'history'>('runway');
  const [availableStaff, setAvailableStaff] = useState<Array<{ name: string; department: string }>>([]);
  const [runwayStaffPool, setRunwayStaffPool] = useState<string[]>(() => readStoredArray('ops_runway_staff_pool', []));
  const [groundStaffPool, setGroundStaffPool] = useState<string[]>(() => readStoredArray('ops_ground_staff_pool', []));
  const [showRunwayStaffManager, setShowRunwayStaffManager] = useState(false);
  const [showGroundStaffManager, setShowGroundStaffManager] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewBaseScale, setPreviewBaseScale] = useState(1);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [deleteFodTarget, setDeleteFodTarget] = useState<string | null>(null);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<string | null>(null);


  const [rwy19, setRwy19] = useState<string[]>(() => readStoredDraft().rwy19 || []);
  const [rwy01, setRwy01] = useState<string[]>(() => readStoredDraft().rwy01 || []);
  const [lights, setLights] = useState<string[]>(() => readStoredDraft().lights || []);
  const runwayRef = useRef<HTMLDivElement>(null);

  const [tasks, setTasks] = useState<any[]>(() => readStoredArray('ops_tasks', DEFAULT_TASKS));
  useEffect(() => { localStorage.setItem('ops_tasks', JSON.stringify(tasks)); }, [tasks]);

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskForm, setTaskForm] = useState({ label: '', colorStart: '#26c6da', colorEnd: '#00838f', text: '#fff' });
  const [groundAssign, setGroundAssign] = useState<{ [key: string]: string[] }>(() => readStoredDraft().groundAssign || {});
  const groundRef = useRef<HTMLDivElement>(null);

  const [fodList, setFodList] = useState<any[]>([]);
  const [fodForm, setFodForm] = useState({ date: INITIAL_DATE, grams: '', remarks: '' });
  const [fodSubmitting, setFodSubmitting] = useState(false);
  const [runwayHistory, setRunwayHistory] = useState<any[]>([]);
  const [groundHistory, setGroundHistory] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const fetchData = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const results = await Promise.allSettled([
        apiFetch('/ops/runway'),
        apiFetch('/ops/ground'),
        apiFetch('/fod'),
        apiFetch('/staff'),
      ]);
      const getData = (index: number) => results[index].status === 'fulfilled' ? (results[index] as PromiseFulfilledResult<any>).value : [];
      setRunwayHistory(getData(0)); setGroundHistory(getData(1)); setFodList(getData(2));
      const failedRequests = results.filter(result => result.status === 'rejected').length;
      setLoadError(failedRequests ? failedRequests + ' operations data source' + (failedRequests === 1 ? '' : 's') + ' could not be refreshed.' : '');

      const staffData = getData(3);
      if (Array.isArray(staffData)) {
        const operationalStaff = staffData
          .filter((member: any) => ['Ground Operations', 'Maintenance'].includes(member.department) && String(member.status || 'active').toLowerCase() !== 'inactive')
          .map((member: any) => ({ name: String(member.name || '').trim().toUpperCase(), department: String(member.department || '') }))
          .filter((member: any) => member.name)
          .filter((member: any, index: number, list: any[]) => list.findIndex(item => item.name === member.name) === index)
          .sort((a: any, b: any) => a.name.localeCompare(b.name));
        setAvailableStaff(operationalStaff);
        const validNames = new Set(operationalStaff.map((member: any) => member.name));
        const defaultOpsNames = operationalStaff.filter((member: any) => member.department === 'Ground Operations').map((member: any) => member.name);
        setRunwayStaffPool(current => localStorage.getItem('ops_runway_staff_pool') === null ? defaultOpsNames : current.filter(name => validNames.has(name)));
        setGroundStaffPool(current => localStorage.getItem('ops_ground_staff_pool') === null ? defaultOpsNames : current.filter(name => validNames.has(name)));
      }
      const myEmail = String(profile?.email || user?.email || '').toLowerCase();
      const mine = Array.isArray(staffData)
        ? staffData.find((s: any) => (s.email || '').toLowerCase() === myEmail)
        : null;
      setMyStaff(mine || null);
      setDataReady(true);
    } catch (err: any) {
      console.error(err);
      setLoadError(err.message || 'Operations data could not be refreshed.');
      setDataReady(true);
    } finally {
      setRefreshing(false);
    }
  }, [profile, user]);

  useEffect(() => { const initialLoad = window.setTimeout(() => void fetchData(true), 0); const interval = window.setInterval(() => void fetchData(true), 15000); return () => { window.clearTimeout(initialLoad); window.clearInterval(interval); }; }, [fetchData]);

  useEffect(() => {
    if (!showPreview) return;
    const handleResize = () => { const screenWidth = window.innerWidth - 40; const targetWidth = 700; setPreviewBaseScale(screenWidth < targetWidth ? screenWidth / targetWidth : 1); };
    handleResize(); window.addEventListener('resize', handleResize); return () => window.removeEventListener('resize', handleResize);
  }, [showPreview]);

  useEffect(() => { localStorage.setItem('ops_board_draft', JSON.stringify({ rwy19, rwy01, lights, groundAssign })); }, [rwy19, rwy01, lights, groundAssign]);
  useEffect(() => { if (dataReady) localStorage.setItem('ops_runway_staff_pool', JSON.stringify(runwayStaffPool)); }, [dataReady, runwayStaffPool]);
  useEffect(() => { if (dataReady) localStorage.setItem('ops_ground_staff_pool', JSON.stringify(groundStaffPool)); }, [dataReady, groundStaffPool]);

  const canView = canViewOpsBoard(profile, myStaff);
  const canEdit = canEditOpsBoard(profile, myStaff);
  const normalizedRole = String(profile?.role || '').toLowerCase();
  const canManageBoardStaff = ['developer', 'admin', 'manager', 'owner'].includes(normalizedRole) || ((myStaff?.isSmt === true || normalizedRole === 'smt') && ['Ground Operations', 'Maintenance'].includes(String(myStaff?.department || '')));
  const allBoardStaff = Array.from(new Set([...runwayStaffPool, ...groundStaffPool])).sort();

  const toggleBoardStaff = (board: 'runway' | 'ground', name: string) => {
    if (!canManageBoardStaff) return;
    const member = availableStaff.find(item => item.name === name);
    if (!member) return;
    const pool = board === 'runway' ? runwayStaffPool : groundStaffPool;
    const setPool = board === 'runway' ? setRunwayStaffPool : setGroundStaffPool;
    if (pool.includes(name)) {
      setPool(current => current.filter(item => item !== name));
      if (board === 'runway') { setRwy19(current => current.filter(item => item !== name)); setRwy01(current => current.filter(item => item !== name)); setLights(current => current.filter(item => item !== name)); }
      else setGroundAssign(current => Object.fromEntries(Object.entries(current).map(([taskId, names]) => [taskId, names.filter(item => item !== name)])));
      return;
    }
    setPool(current => [...current, name].sort());
  };

  const handleAddTask = () => { setEditingTaskId(null); setTaskForm({ label: '', colorStart: '#26c6da', colorEnd: '#00838f', text: '#fff' }); setShowTaskModal(true); };
  const handleEditTask = (task: any) => { const colorMatches = String(task.color || '').match(/#[0-9a-fA-F]{3,6}/g) || []; setTaskForm({ label: task.label || '', colorStart: colorMatches[0] || '#26c6da', colorEnd: colorMatches[1] || '#00838f', text: task.text || '#fff' }); setEditingTaskId(task.id); setShowTaskModal(true); };
  const handleSaveTask = () => { const label = taskForm.label.trim(); if (!label) { toast.error('Task label is required'); return; } const payload = { id: editingTaskId || `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label: label.toUpperCase(), color: `linear-gradient(135deg, ${taskForm.colorStart}, ${taskForm.colorEnd})`, text: taskForm.text }; if (editingTaskId) { setTasks(prev => prev.map(t => (t.id === editingTaskId ? payload : t))); toast.success('Task board updated'); } else { setTasks(prev => [...prev, payload]); toast.success('Task board added'); } setShowTaskModal(false); setEditingTaskId(null); };
  const handleDeleteTask = (id: string) => setDeleteTaskTarget(id);
  const handleResetTasks = () => { setTasks(DEFAULT_TASKS); toast.success('Task boards reset to defaults'); };

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
    setGroundAssign(prev => { const current = prev[taskId] || []; const updated = current.includes(name) ? current.filter(n => n !== name) : [...current, name]; return { ...prev, [taskId]: updated }; });
  };

  const handleClearBoard = () => setShowClearConfirm(true);

  const saveRunwayData = async () => { try { await apiFetch('/ops/runway', { method: 'POST', body: JSON.stringify({ date: new Date().toISOString().split('T')[0], time: new Date().toLocaleTimeString(), rwy19, rwy01, lights }) }); toast.success('Runway board saved to history!'); fetchData(); } catch (err: any) { toast.error(err.message); } };
  const saveGroundData = async () => { try { await apiFetch('/ops/ground', { method: 'POST', body: JSON.stringify({ date: new Date().toISOString().split('T')[0], time: new Date().toLocaleTimeString(), assignments: groundAssign }) }); toast.success('Ground board saved to history!'); fetchData(); } catch (err: any) { toast.error(err.message); } };
  const handleSaveFOD = async (e: any) => { e.preventDefault(); if (!fodForm.grams || !fodForm.remarks) { toast.error('Please enter grams and remarks'); return; } setFodSubmitting(true); try { await apiFetch('/fod', { method: 'POST', body: JSON.stringify({ ...fodForm, grams: Number(fodForm.grams), loggedBy: user?.email || '' }) }); toast.success('FOD entry recorded!'); setFodForm({ date: INITIAL_DATE, grams: '', remarks: '' }); fetchData(); } catch (err: any) { toast.error(err.message); } setFodSubmitting(false); };
  const handleDeleteFOD = (id: string) => setDeleteFodTarget(id);

  const renderBoardCanvas = async (ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current) throw new Error('Board is not ready');
    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed'; wrapper.style.left = '-9999px'; wrapper.style.top = '0'; wrapper.style.width = '700px'; wrapper.style.background = '#141414'; wrapper.style.padding = '20px';
    const clone = ref.current.cloneNode(true) as HTMLElement;
    clone.style.width = '100%'; clone.style.background = 'transparent'; clone.style.overflow = 'visible';
    clone.querySelectorAll('.ops-grid-3').forEach(grid => { const element = grid as HTMLElement; element.style.display = 'grid'; element.style.gridTemplateColumns = 'repeat(3, 1fr)'; element.style.gridAutoFlow = 'row'; element.style.gap = '8px'; element.style.overflow = 'visible'; element.style.width = '100%'; });
    clone.querySelectorAll('.ops-card').forEach(card => { const element = card as HTMLElement; element.style.width = '100%'; element.style.minWidth = '0'; element.style.overflow = 'hidden'; (element.style as any).breakInside = 'avoid'; });
    wrapper.appendChild(clone); document.body.appendChild(wrapper); void wrapper.offsetHeight;
    try {
      return await html2canvas(wrapper, { scale: 2, backgroundColor: '#141414', width: 700, height: wrapper.scrollHeight, windowWidth: 700, windowHeight: wrapper.scrollHeight });
    } finally {
      document.body.removeChild(wrapper);
    }
  };

  const exportBoard = async (ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
    toast.info('Generating high-quality image...');
    try {
      const canvas = await renderBoardCanvas(ref);
      const link = document.createElement('a');
      link.download = `${filename}_${INITIAL_DATE}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
      toast.success('JPG downloaded successfully');
    } catch (err: any) { toast.error('Export failed: ' + err.message); }
  };

  const exportBoardPdf = async (ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
    toast.info('Preparing A4 landscape PDF...');
    try {
      const canvas = await renderBoardCanvas(ref);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const margin = 8;
      const pageWidth = pdf.internal.pageSize.getWidth() - margin * 2;
      const pageHeight = pdf.internal.pageSize.getHeight() - margin * 2;
      const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
      const width = canvas.width * ratio;
      const height = canvas.height * ratio;
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.96), 'JPEG', (pdf.internal.pageSize.getWidth() - width) / 2, (pdf.internal.pageSize.getHeight() - height) / 2, width, height);
      pdf.save(`${filename}_${INITIAL_DATE}.pdf`);
      toast.success('A4 PDF downloaded successfully');
    } catch (err: any) { toast.error('PDF export failed: ' + err.message); }
  };
  const allHistory = [...runwayHistory.map(h => ({ ...h, type: 'runway' })), ...groundHistory.map(h => ({ ...h, type: 'ground' }))].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const staffUtilization: { [name: string]: { runway: number, ground: number } } = {};
  allHistory.forEach(h => { if (h.type === 'runway') { [...(h.rwy19 || []), ...(h.rwy01 || []), ...(h.lights || [])].forEach((n: string) => { if (!staffUtilization[n]) staffUtilization[n] = { runway: 0, ground: 0 }; staffUtilization[n].runway++; }); } else { Object.values(h.assignments || {}).flat().forEach((n: any) => { if (!staffUtilization[n]) staffUtilization[n] = { runway: 0, ground: 0 }; staffUtilization[n].ground++; }); } });
  const chartData = Object.entries(staffUtilization).map(([name, data]) => ({ name, runway: data.runway, ground: data.ground, total: data.runway + data.ground })).sort((a, b) => b.total - a.total).slice(0, 10);
  const indHistory = selectedStaff ? allHistory.filter(h => { if (h.type === 'runway') return [...(h.rwy19 || []), ...(h.rwy01 || []), ...(h.lights || [])].includes(selectedStaff); return Object.values(h.assignments || {}).flat().includes(selectedStaff); }) : [];
  const indTaskCounts: { [task: string]: number } = {};
  indHistory.forEach(h => { if (h.type === 'runway') { if (h.rwy19.includes(selectedStaff)) indTaskCounts['RWY 19 Inspection'] = (indTaskCounts['RWY 19 Inspection'] || 0) + 1; if (h.rwy01.includes(selectedStaff)) indTaskCounts['RWY 01 Inspection'] = (indTaskCounts['RWY 01 Inspection'] || 0) + 1; if (h.lights.includes(selectedStaff)) indTaskCounts['Light Inspection'] = (indTaskCounts['Light Inspection'] || 0) + 1; } else { Object.entries(h.assignments || {}).forEach(([taskId, names]: any) => { if (names.includes(selectedStaff)) { const label = tasks.find(t => t.id === taskId)?.label || taskId; indTaskCounts[label] = (indTaskCounts[label] || 0) + 1; } }); } });

  if (!dataReady) return <div className="page-content"><p>Loading Operations Board...</p></div>;
  if (!canView) return <div className="page-content"><div className="empty-state"><h2>Access Denied</h2><p>You do not have permission to view the Operations Board.</p></div></div>;

  return (
    <div className="page-content operations-board-page">
      <header className="operations-board-hero">
        <div>
          <span className="operations-board-kicker">Daily airside coordination</span>
          <h2>Operations Board</h2>
          <p>Assign inspection teams, coordinate aircraft turnaround duties, and retain a clear operational record.</p>
        </div>
        <div className="operations-board-hero__actions">
          <button type="button" className="operations-board-refresh" onClick={() => void fetchData()} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh data'}</button>
        </div>
      </header>

      {loadError && <div className="operations-board-alert" role="alert"><strong>Some information may be out of date.</strong><span>{loadError}</span></div>}

      <section className="operations-board-summary" aria-label="Operations board summary">
        <div><span>Staff pool</span><strong>{allBoardStaff.length}</strong><small>selected team members</small></div>
        <div><span>Runway assigned</span><strong>{new Set([...rwy19, ...rwy01, ...lights]).size}</strong><small>current inspection team</small></div>
        <div><span>Ground duties</span><strong>{Object.values(groundAssign).reduce((total, names) => total + names.length, 0)}</strong><small>active assignments</small></div>
        <div><span>Saved boards</span><strong>{runwayHistory.length + groundHistory.length}</strong><small>historical records</small></div>
      </section>

      <nav className="operations-board-tabs" aria-label="Operations board sections">
        <button type="button" className={activeTab === 'runway' ? 'active' : ''} onClick={() => setActiveTab('runway')}><span>01</span><strong>Runway</strong><small>Inspection allocation</small></button>
        <button type="button" className={activeTab === 'ground' ? 'active' : ''} onClick={() => setActiveTab('ground')}><span>02</span><strong>Ground duties</strong><small>Turnaround tasks</small></button>
        <button type="button" className={activeTab === 'fod' ? 'active' : ''} onClick={() => setActiveTab('fod')}><span>03</span><strong>FOD log</strong><small>Collection records</small></button>
        <button type="button" className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}><span>04</span><strong>History</strong><small>Reports and activity</small></button>
      </nav>
      {activeTab === 'runway' && (
        <div>
          {(canEdit || canManageBoardStaff) && (
            <div className="dash-card operations-assignment-panel" style={{ marginBottom: '20px' }}>
              <div className="operations-assignment-head"><div><h3>Assign runway inspection staff</h3><p>Select active Ground Operations and Maintenance staff for runway duties.</p></div>{canManageBoardStaff && <button type="button" onClick={() => setShowRunwayStaffManager(current => !current)}>{showRunwayStaffManager ? 'Close staff list' : 'Add / remove staff'}</button>}</div>
              {showRunwayStaffManager && canManageBoardStaff && <div className="operations-staff-manager"><header><strong>Runway staff pool</strong><span>{runwayStaffPool.length} selected · Ground Operations and Maintenance</span></header><div>{availableStaff.map(member => { const selected = runwayStaffPool.includes(member.name); return <button type="button" className={selected ? 'selected' : ''} key={member.name} onClick={() => toggleBoardStaff('runway', member.name)}><span><strong>{member.name}</strong><small>{member.department}</small></span><em>{selected ? 'Remove' : 'Add'}</em></button>; })}</div></div>}
              <div className="operations-runway-staff" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '12px' }}>
                {runwayStaffPool.map(s => (
                  <div className="operations-runway-person" key={s} style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px' }}>{s}</span>
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

          <div className="ops-board-export-area" style={{ background: '#141414', padding: '20px', borderRadius: '12px', overflowX: 'auto' }}>
            <div className="ops-board-fixed-width" ref={runwayRef} style={{ minWidth: '700px' }}>
              <div style={{ textAlign: 'center', color: '#fff', fontSize: '14px', fontWeight: 900, letterSpacing: '1px', marginBottom: '16px', textTransform: 'uppercase' }}>
                FND RUNWAY INSPECTION BOARD
              </div>
              <div className="ops-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ background: '#e53935', color: '#fff', padding: '6px', textAlign: 'center', fontWeight: 'bold', fontSize: '11px' }}>RWY 19</div>
                  <div style={{ background: '#0a0a0a', flex: 1, padding: '4px 0', border: '1px solid #333', borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
                    {rwy19.length ? rwy19.map(n => (
                      <div key={n} style={{ textAlign: 'center', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '4px 2px', borderBottom: '1px solid #111', whiteSpace: 'nowrap' }}>{n}</div>
                    )) : <div style={{ textAlign: 'center', color: '#444', padding: '6px', fontSize: '10px' }}>—</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ background: '#1e88e5', color: '#fff', padding: '6px', textAlign: 'center', fontWeight: 'bold', fontSize: '11px' }}>RWY 01</div>
                  <div style={{ background: '#0a0a0a', flex: 1, padding: '4px 0', border: '1px solid #333', borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
                    {rwy01.length ? rwy01.map(n => (
                      <div key={n} style={{ textAlign: 'center', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '4px 2px', borderBottom: '1px solid #111', whiteSpace: 'nowrap' }}>{n}</div>
                    )) : <div style={{ textAlign: 'center', color: '#444', padding: '6px', fontSize: '10px' }}>—</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ background: '#fdd835', color: '#111', padding: '6px', textAlign: 'center', fontWeight: 'bold', fontSize: '11px', lineHeight: 1.1 }}>LIGHT INSPECTION</div>
                  <div style={{ background: '#0a0a0a', flex: 1, padding: '4px 0', border: '1px solid #333', borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
                    {lights.length ? lights.map(n => (
                      <div key={n} style={{ textAlign: 'center', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '4px 2px', borderBottom: '1px solid #111', whiteSpace: 'nowrap' }}>{n}</div>
                    )) : <div style={{ textAlign: 'center', color: '#444', padding: '6px', fontSize: '10px' }}>—</div>}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'center', color: '#777', marginTop: '16px', fontSize: '10px' }}>{BOARD_TIMESTAMP}</div>
            </div>
          </div>

          <div className="operations-board-actions">
            {canEdit && <button className="operations-board-action danger" onClick={handleClearBoard}>Clear assignments</button>}
            {canEdit && <button className="operations-board-action save" onClick={saveRunwayData}>Save board</button>}
            <button className="operations-board-action preview" onClick={() => { setShowPreview(true); setPreviewZoom(1); }}>Preview</button>
            <button className="operations-board-action export" onClick={() => exportBoard(runwayRef, 'FND_Runway_Board')}>Export JPG</button>
            <button className="operations-board-action pdf" onClick={() => exportBoardPdf(runwayRef, 'FND_Runway_Board')}>Export A4 PDF</button>
          </div>
        </div>
      )}

      {activeTab === 'ground' && (
        <div>
          {(canEdit || canManageBoardStaff) && (
            <div className="dash-card operations-assignment-panel" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ margin: 0 }}>Assign Staff to Tasks</h3>
                {(canEdit || canManageBoardStaff) && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {canEdit && <button className="quick-btn" style={{ background: '#6b7280', color: 'white' }} onClick={handleResetTasks}>↺ Reset Defaults</button>}
                    {canEdit && <button className="quick-btn" style={{ background: '#0b2b4f', color: 'white' }} onClick={handleAddTask}>➕ Add Task Board</button>}
                    {canManageBoardStaff && <button className="quick-btn" style={{ background: '#0f766e', color: 'white' }} onClick={() => setShowGroundStaffManager(current => !current)}>{showGroundStaffManager ? 'Close Staff List' : 'Add / Remove Staff'}</button>}
                  </div>
                )}
              </div>

              {showGroundStaffManager && canManageBoardStaff && <div className="operations-staff-manager"><header><strong>Ground Task staff pool</strong><span>{groundStaffPool.length} selected · Ground Operations and Maintenance</span></header><div>{availableStaff.map(member => { const selected = groundStaffPool.includes(member.name); return <button type="button" className={selected ? 'selected' : ''} key={member.name} onClick={() => toggleBoardStaff('ground', member.name)}><span><strong>{member.name}</strong><small>{member.department}</small></span><em>{selected ? 'Remove' : 'Add'}</em></button>; })}</div></div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                {tasks.map(t => (
                  <div className="operations-task-assignment" key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>{t.label}</span>
                      {canEdit && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => handleEditTask(t)} title="Edit task board" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>✏️ Edit</button>
                          <button onClick={() => handleDeleteTask(t.id)} title="Delete task board" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>🗑️</button>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', width: '100%' }}>
                      {groundStaffPool.map(s => (
                        <label className={(groundAssign[t.id] || []).includes(s) ? 'operations-task-person selected' : 'operations-task-person'} key={s} style={{ fontSize: '10px', display: 'flex', alignItems: 'flex-start', gap: '4px', background: (groundAssign[t.id] || []).includes(s) ? '#dbeafe' : '#f8fafc', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', cursor: canEdit ? 'pointer' : 'default' }}>
                          <input type="checkbox" checked={(groundAssign[t.id] || []).includes(s)} onChange={() => toggleGround(t.id, s)} disabled={!canEdit} style={{ width: '14px', height: '14px', flexShrink: 0, marginTop: '2px' }} />
                          <span style={{ lineHeight: '1.2', wordBreak: 'break-word' }}>{s}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                {tasks.length === 0 && (<div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '13px' }}>No task boards configured. Click <strong>➕ Add Task Board</strong> to create one.</div>)}
              </div>
            </div>
          )}

          <div className="ops-board-export-area" style={{ background: '#141414', padding: '20px', borderRadius: '12px', overflowX: 'auto' }}>
            <div className="ops-board-fixed-width" ref={groundRef} style={{ minWidth: '700px' }}>
              <div style={{ textAlign: 'center', color: '#fff', fontSize: '14px', fontWeight: 900, letterSpacing: '1px', marginBottom: '16px', textTransform: 'uppercase' }}>FND FLIGHT OPERATIONS — GROUND TASK BOARD</div>
              <div className="ops-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {tasks.map(t => {
                  const assigned = groundAssign[t.id] || [];
                  return (
                    <div key={t.id} style={{ display: 'flex', flexDirection: 'column', borderRadius: '6px', overflow: 'hidden' }}>
                      <div style={{ background: t.color, color: t.text, padding: '6px', textAlign: 'center', fontWeight: 'bold', fontSize: '10px', letterSpacing: '0.5px' }}>{t.label}</div>
                      <div style={{ background: '#0a0a0a', flex: 1, padding: '4px 0', border: '1px solid #333', borderTop: 'none', borderRadius: '0 0 6px 6px' }}>
                        {assigned.length ? (assigned.map(n => (<div key={n} style={{ textAlign: 'center', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '4px 2px', borderBottom: '1px solid #111', whiteSpace: 'nowrap' }}>{n}</div>))) : <div style={{ textAlign: 'center', color: '#444', padding: '6px', fontSize: '10px' }}>—</div>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ background: '#111', borderLeft: '3px solid #fbc02d', borderRadius: '6px', padding: '12px', marginTop: '16px' }}>
                <h4 style={{ color: '#fbc02d', margin: '0 0 8px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📋 OPERATIONAL NOTES</h4>
                <ol style={{ color: '#e2e8f0', fontSize: '10px', paddingLeft: '16px', margin: 0, lineHeight: 1.4 }}>
                  <li>Aircraft cabin cleaning shall commence only after complete passenger disembarkation.</li>
                  <li>WCHR passengers shall be transported to the aircraft door during the departure phase.</li>
                  <li>Upon task completion, personnel shall assist passengers in proceeding to the aircraft door.</li>
                </ol>
              </div>
              <div style={{ textAlign: 'center', color: '#777', marginTop: '16px', fontSize: '10px' }}>{BOARD_TIMESTAMP}</div>
            </div>
          </div>

          <div className="operations-board-actions">
            {canEdit && <button className="operations-board-action danger" onClick={handleClearBoard}>Clear assignments</button>}
            {canEdit && <button className="operations-board-action save" onClick={saveGroundData}>Save board</button>}
            <button className="operations-board-action preview" onClick={() => { setShowPreview(true); setPreviewZoom(1); }}>Preview</button>
            <button className="operations-board-action export" onClick={() => exportBoard(groundRef, 'FND_Ground_Board')}>Export JPG</button>
            <button className="operations-board-action pdf" onClick={() => exportBoardPdf(groundRef, 'FND_Ground_Board')}>Export A4 PDF</button>
          </div>
        </div>
      )}

      {activeTab === 'fod' && (
        <div className="dash-grid">
          {canEdit && (
            <div className="dash-card">
              <h3>🪨 Log FOD Collection</h3>
              <form onSubmit={handleSaveFOD} className="staff-form" style={{ gridTemplateColumns: '1fr', padding: 0, boxShadow: 'none' }}>
                <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Date</label><input type="date" value={fodForm.date} onChange={e => setFodForm({ ...fodForm, date: e.target.value })} required /></div>
                <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Stone Count (grams)</label><input type="number" placeholder="e.g. 15" value={fodForm.grams} onChange={e => setFodForm({ ...fodForm, grams: e.target.value })} required /></div>
                <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Remarks / Details</label><input placeholder="e.g. Small rocks found near RWY 19" value={fodForm.remarks} onChange={e => setFodForm({ ...fodForm, remarks: e.target.value })} required /></div>
                <button type="submit" disabled={fodSubmitting} style={{ gridColumn: 'span 1' }}>{fodSubmitting ? 'Saving...' : 'Save FOD Entry'}</button>
              </form>
            </div>
          )}

          <div className="dash-card" style={!canEdit ? { gridColumn: 'span 2' } : undefined}>
            <h3>📋 Recent FOD Collections</h3>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="mini-table">
                <thead><tr><th>Date</th><th>Grams</th><th>Remarks</th><th>Logged By</th><th></th></tr></thead>
                <tbody>
                  {fodList.length === 0 ? (<tr><td colSpan={5} style={{ textAlign: 'center' }}>No FOD records yet.</td></tr>) : fodList.map(f => (
                    <tr key={f.id}>
                      <td>{f.date}</td>
                      <td style={{ fontWeight: 800, color: '#dc2626' }}>{f.grams}g</td>
                      <td style={{ fontSize: '12px' }}>{f.remarks}</td>
                      <td style={{ fontSize: '11px', color: '#64748b' }}>{f.loggedBy.split('@')[0]}</td>
                      <td>{canEdit && <button className="delete-btn" onClick={() => handleDeleteFOD(f.id)}>Delete</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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
                {allBoardStaff.map(s => <option key={s} value={s}>{s}</option>)}
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
                    <button onClick={() => setExpandedLog(isExpanded ? null : h.id)} style={{ width: '100%', padding: '12px 16px', background: '#f8fafc', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: h.type === 'runway' ? '#dc2626' : '#2563eb' }}>{h.type === 'runway' ? '✈️ Runway Inspection' : '🛬 Ground Task Board'}</span>
                        <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '12px' }}>{h.date} at {h.time}</span>
                      </div>
                      <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: 600 }}>{isExpanded ? 'Hide Details ▲' : 'Show Details ▼'}</span>
                    </button>

                    {isExpanded && (
                      <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0', background: 'white', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {h.type === 'runway' ? (
                          <>
                            <div style={{ background: '#fef2f2', padding: '10px', borderRadius: '6px', border: '1px solid #fecaca' }}><div style={{ fontSize: '11px', fontWeight: 700, color: '#991b1b' }}>RWY 19</div><div style={{ fontSize: '13px', marginTop: '4px' }}>{h.rwy19?.join(', ') || '—'}</div></div>
                            <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '6px', border: '1px solid #bfdbfe' }}><div style={{ fontSize: '11px', fontWeight: 700, color: '#1e40af' }}>RWY 01</div><div style={{ fontSize: '13px', marginTop: '4px' }}>{h.rwy01?.join(', ') || '—'}</div></div>
                            <div style={{ background: '#fef3c7', padding: '10px', borderRadius: '6px', border: '1px solid #fde68a', gridColumn: 'span 2' }}><div style={{ fontSize: '11px', fontWeight: 700, color: '#92400e' }}>LIGHT INSPECTION</div><div style={{ fontSize: '13px', marginTop: '4px' }}>{h.lights?.join(', ') || '—'}</div></div>
                          </>
                        ) : (
                          Object.entries(h.assignments || {}).map(([taskId, names]: any) => {
                            if (!names || names.length === 0) return null;
                            const label = tasks.find(t => t.id === taskId)?.label || taskId;
                            return (<div key={taskId} style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}><div style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>{label}</div><div style={{ fontSize: '13px', marginTop: '4px' }}>{names.join(', ')}</div></div>);
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

      {showPreview && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, height: '100dvh', background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#141414', color: 'white', borderBottom: '1px solid #333', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <h3 style={{ margin: 0 }}>⭐ Export Preview</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#222', padding: '4px 8px', borderRadius: '6px' }}>
                <button onClick={() => setPreviewZoom(z => Math.max(0.5, z - 0.25))} style={{ background: '#333', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>-</button>
                <span style={{ fontSize: '12px', minWidth: '40px', textAlign: 'center' }}>{Math.round(previewZoom * 100)}%</span>
                <button onClick={() => setPreviewZoom(z => Math.min(3, z + 0.25))} style={{ background: '#333', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
              </div>
            </div>
            <button onClick={() => setShowPreview(false)} style={{ background: '#333', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>✕ Close</button>
          </div>
          
          <div style={{ flex: 1, overflow: 'auto', background: '#222', padding: '20px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
            <div style={{ width: '700px', height: 'max-content', transform: `scale(${previewBaseScale * previewZoom})`, transformOrigin: 'top center', transition: 'transform 0.2s ease-out', marginBottom: (previewBaseScale * previewZoom) < 1 ? `-${600 * (1 - (previewBaseScale * previewZoom))}px` : '0' }}>
              <div style={{ width: '700px', background: '#141414', padding: '20px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                {activeTab === 'runway' ? (
                  <div>
                    <div style={{ textAlign: 'center', color: '#fff', fontSize: '14px', fontWeight: 900, letterSpacing: '1px', marginBottom: '16px', textTransform: 'uppercase' }}>FND RUNWAY INSPECTION BOARD</div>
                    <div className="ops-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', borderRadius: '6px', overflow: 'hidden' }}><div style={{ background: '#e53935', color: '#fff', padding: '6px', textAlign: 'center', fontWeight: 'bold', fontSize: '11px' }}>RWY 19</div><div style={{ background: '#0a0a0a', flex: 1, padding: '4px 0', border: '1px solid #333', borderTop: 'none' }}>{rwy19.length ? rwy19.map(n => (<div key={n} style={{ textAlign: 'center', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '4px 2px', borderBottom: '1px solid #111', whiteSpace: 'nowrap' }}>{n}</div>)) : <div style={{ textAlign: 'center', color: '#444', padding: '6px', fontSize: '10px' }}>—</div>}</div></div>
                      <div style={{ display: 'flex', flexDirection: 'column', borderRadius: '6px', overflow: 'hidden' }}><div style={{ background: '#1e88e5', color: '#fff', padding: '6px', textAlign: 'center', fontWeight: 'bold', fontSize: '11px' }}>RWY 01</div><div style={{ background: '#0a0a0a', flex: 1, padding: '4px 0', border: '1px solid #333', borderTop: 'none' }}>{rwy01.length ? rwy01.map(n => (<div key={n} style={{ textAlign: 'center', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '4px 2px', borderBottom: '1px solid #111', whiteSpace: 'nowrap' }}>{n}</div>)) : <div style={{ textAlign: 'center', color: '#444', padding: '6px', fontSize: '10px' }}>—</div>}</div></div>
                      <div style={{ display: 'flex', flexDirection: 'column', borderRadius: '6px', overflow: 'hidden' }}><div style={{ background: '#fdd835', color: '#111', padding: '6px', textAlign: 'center', fontWeight: 'bold', fontSize: '11px', lineHeight: 1.1 }}>LIGHT INSPECTION</div><div style={{ background: '#0a0a0a', flex: 1, padding: '4px 0', border: '1px solid #333', borderTop: 'none' }}>{lights.length ? lights.map(n => (<div key={n} style={{ textAlign: 'center', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '4px 2px', borderBottom: '1px solid #111', whiteSpace: 'nowrap' }}>{n}</div>)) : <div style={{ textAlign: 'center', color: '#444', padding: '6px', fontSize: '10px' }}>—</div>}</div></div>
                    </div>
                    <div style={{ textAlign: 'center', color: '#777', marginTop: '16px', fontSize: '10px' }}>{BOARD_TIMESTAMP}</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ textAlign: 'center', color: '#fff', fontSize: '14px', fontWeight: 900, letterSpacing: '1px', marginBottom: '16px', textTransform: 'uppercase' }}>FND FLIGHT OPERATIONS — GROUND TASK BOARD</div>
                    <div className="ops-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      {tasks.map(t => {
                        const assigned = groundAssign[t.id] || [];
                        return (<div key={t.id} style={{ display: 'flex', flexDirection: 'column', borderRadius: '6px', overflow: 'hidden' }}><div style={{ background: t.color, color: t.text, padding: '6px', textAlign: 'center', fontWeight: 'bold', fontSize: '10px' }}>{t.label}</div><div style={{ background: '#0a0a0a', flex: 1, padding: '4px 0', border: '1px solid #333', borderTop: 'none' }}>{assigned.length ? (assigned.map(n => (<div key={n} style={{ textAlign: 'center', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '4px 2px', borderBottom: '1px solid #111', whiteSpace: 'nowrap' }}>{n}</div>))) : <div style={{ textAlign: 'center', color: '#444', padding: '6px', fontSize: '10px' }}>—</div>}</div></div>);
                      })}
                    </div>
                    <div style={{ background: '#111', borderLeft: '3px solid #fbc02d', borderRadius: '6px', padding: '12px', marginTop: '16px' }}><h4 style={{ color: '#fbc02d', margin: '0 0 8px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📋 OPERATIONAL NOTES</h4><ol style={{ color: '#e2e8f0', fontSize: '10px', paddingLeft: '16px', margin: 0, lineHeight: 1.4 }}><li>Aircraft cabin cleaning shall commence only after complete passenger disembarkation.</li><li>WCHR passengers shall be transported to the aircraft door during the departure phase.</li><li>Upon task completion, personnel shall assist passengers in proceeding to the aircraft door.</li></ol></div>
                    <div style={{ textAlign: 'center', color: '#777', marginTop: '16px', fontSize: '10px' }}>{BOARD_TIMESTAMP}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ padding: '16px', background: '#141414', textAlign: 'center', borderTop: '1px solid #333', flexShrink: 0 }}>
            <button onClick={() => { exportBoard(activeTab === 'runway' ? runwayRef : groundRef, activeTab === 'runway' ? 'FND_Runway_Board' : 'FND_Ground_Board'); }} className="add-staff-btn" style={{ background: '#059669', padding: '12px 24px', fontSize: '16px' }}>📸 Download JPG</button>
            <button onClick={() => { exportBoardPdf(activeTab === 'runway' ? runwayRef : groundRef, activeTab === 'runway' ? 'FND_Runway_Board' : 'FND_Ground_Board'); }} className="add-staff-btn" style={{ background: '#dc2626', padding: '12px 24px', fontSize: '16px', marginLeft: '8px' }}>Download A4 PDF</button>
          </div>
        </div>
      )}

      {showTaskModal && (
        <div className="modal-backdrop" onClick={() => setShowTaskModal(false)} style={{ zIndex: 10000 }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', width: '92%', padding: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#1e293b', fontSize: '18px' }}>{editingTaskId ? '✏️ Edit Task Board' : '➕ Add Task Board'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div><label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Task Label *</label><input type="text" value={taskForm.label} onChange={(e) => setTaskForm({ ...taskForm, label: e.target.value })} placeholder="e.g. LAVATORY SERVICE" style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', color: '#1e293b', background: '#fff' }} autoFocus /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Gradient Start</label><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="color" value={taskForm.colorStart} onChange={(e) => setTaskForm({ ...taskForm, colorStart: e.target.value })} style={{ width: '42px', height: '38px', padding: 0, border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', background: '#fff' }} /><input type="text" value={taskForm.colorStart} onChange={(e) => setTaskForm({ ...taskForm, colorStart: e.target.value })} style={{ flex: 1, padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace', color: '#1e293b', background: '#fff' }} /></div></div>
                <div><label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Gradient End</label><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="color" value={taskForm.colorEnd} onChange={(e) => setTaskForm({ ...taskForm, colorEnd: e.target.value })} style={{ width: '42px', height: '38px', padding: 0, border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', background: '#fff' }} /><input type="text" value={taskForm.colorEnd} onChange={(e) => setTaskForm({ ...taskForm, colorEnd: e.target.value })} style={{ flex: 1, padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace', color: '#1e293b', background: '#fff' }} /></div></div>
              </div>
              <div><label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Text Color</label><select value={taskForm.text} onChange={(e) => setTaskForm({ ...taskForm, text: e.target.value })} style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', color: '#1e293b', background: '#fff', cursor: 'pointer' }}><option value="#fff">White (light backgrounds)</option><option value="#1a1a1a">Dark (light backgrounds)</option></select></div>
              <div><label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>Preview</label><div style={{ background: `linear-gradient(135deg, ${taskForm.colorStart}, ${taskForm.colorEnd})`, color: taskForm.text, padding: '10px', textAlign: 'center', fontWeight: 'bold', fontSize: '12px', borderRadius: '6px', letterSpacing: '0.5px', minHeight: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{(taskForm.label || 'TASK LABEL PREVIEW').toUpperCase()}</div></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setShowTaskModal(false)} style={{ padding: '9px 18px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSaveTask} style={{ padding: '9px 18px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>{editingTaskId ? 'Save Changes' : 'Add Board'}</button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog isOpen={showClearConfirm} title="Clear Board?" message="Are you sure you want to clear all selections? This will reset the current board." confirmText="Clear Board" isDanger={true} onConfirm={() => { setRwy19([]); setRwy01([]); setLights([]); setGroundAssign({}); localStorage.removeItem('ops_board_draft'); setShowClearConfirm(false); toast.success('Board cleared and ready for new assignments.'); }} onCancel={() => setShowClearConfirm(false)} />
      <ConfirmDialog isOpen={!!deleteFodTarget} title="Delete FOD Record?" message="Are you sure you want to permanently delete this FOD record?" confirmText="Delete" isDanger={true} onConfirm={async () => { if (!deleteFodTarget) return; try { await apiFetch(`/fod/${deleteFodTarget}`, { method: 'DELETE' }); toast.success('FOD record deleted'); fetchData(); } catch (err: any) { toast.error(err.message); } setDeleteFodTarget(null); }} onCancel={() => setDeleteFodTarget(null)} />
      <ConfirmDialog isOpen={!!deleteTaskTarget} title="Delete Task Board?" message={`Are you sure you want to delete this task board? Any staff assigned to it will be unassigned.`} confirmText="Delete" isDanger={true} onConfirm={() => { if (!deleteTaskTarget) return; setTasks(prev => prev.filter(t => t.id !== deleteTaskTarget)); setGroundAssign(prev => { const updated = { ...prev }; delete updated[deleteTaskTarget]; return updated; }); toast.success('Task board deleted'); setDeleteTaskTarget(null); }} onCancel={() => setDeleteTaskTarget(null)} />
    </div>
  );
}

export default OpsBoardPage;
