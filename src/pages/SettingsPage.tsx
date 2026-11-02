import { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import { authClient } from '../lib/auth-client';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import ChangePasswordModal from './ChangePasswordModal';
import { ConfirmDialog } from '../components/Dialogs';
import { UserEditModal } from '../components/UserEditModal';

const ALL_LEAVES = ['ANNUAL LEAVE', 'SICK LEAVE', 'SICK LEAVE / MC', 'NO PAY LEAVE', 'DUTY TRAVEL', 'PATERNITY LEAVE', 'MATERNITY LEAVE', 'PRE-MATERNITY LEAVE', 'FAMILY RESPONSIBILITY LEAVE (FRL)'];
const DEPARTMENTS = ['Ground Operations', 'Maintenance', 'Security', 'Fire & Rescue', 'Administration', 'Safety'];

function SettingsPage() {
  const { user, profile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'rules' | 'incharges' | 'detailed' | 'console'>('general');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  const isDev = profile?.role === 'developer';
  const isManager = profile?.role === 'manager' || profile?.role === 'admin';
  const isSMT = profile?.role === 'smt' || profile?.isSmt === true;
  const canManageAccess = isDev || isManager;
  
  const [otRules, setOtRules] = useState({ adminHours: 40, regularHours: 48, deductLeaves: ['SICK LEAVE', 'SICK LEAVE / MC'] });
  const [savingRules, setSavingRules] = useState(false);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [resetPwTarget, setResetPwTarget] = useState<string | null>(null);
  const [deleteTempTarget, setDeleteTempTarget] = useState<string | null>(null);
  const [deleteInspectorTarget, setDeleteInspectorTarget] = useState<string | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<{id: string, email: string} | null>(null);
  const [editingUser, setEditingUser] = useState<any>(null);

  const [tempAccessList, setTempAccessList] = useState<any[]>([]);
  const [tempStaffId, setTempStaffId] = useState('');
  const [tempDept, setTempDept] = useState('Maintenance');
  const [tempStart, setTempStart] = useState('');
  const [tempEnd, setTempEnd] = useState('');

  const [inspectorStaffId, setInspectorStaffId] = useState('');
  const [inspectorList, setInspectorList] = useState<any[]>([]);

  const fetchSettings = useCallback(async () => {
    try {
      const [rulesData, usersData, tempAccessData, staffData, inspectorsData] = await Promise.all([
        apiFetch('/settings/ot_rules').catch(() => null), 
        apiFetch('/users').catch(() => []), 
        apiFetch('/temp-access').catch(() => []), 
        apiFetch('/staff').catch(() => []), 
        apiFetch('/lights-inspectors').catch(() => [])
      ]);
      
      if (rulesData) setOtRules(rulesData);
      // Ensure we ALWAYS set an array, preventing the white screen crash
      setActiveUsers(Array.isArray(usersData) ? usersData : []);
      setTempAccessList(Array.isArray(tempAccessData) ? tempAccessData : []);
      setStaffList(Array.isArray(staffData) ? staffData : []); 
      setInspectorList(Array.isArray(inspectorsData) ? inspectorsData : []);
    } catch (err: any) { 
      console.error("Failed to load settings", err); 
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    const interval = setInterval(fetchSettings, 15000);
    return () => clearInterval(interval);
  }, [fetchSettings]);

  const saveRules = async (e: FormEvent) => { 
    e.preventDefault(); 
    setSavingRules(true); 
    try { 
      await apiFetch('/settings/ot_rules', { method: 'POST', body: JSON.stringify(otRules) }); 
      toast.success('System rules updated!'); 
    } catch (err: any) { 
      toast.error('Error: ' + err.message); 
    } 
    setSavingRules(false); 
  };

  const toggleDeductLeave = (l: string) => { 
    setOtRules(prev => { 
      const exists = prev.deductLeaves.includes(l); 
      return { ...prev, deductLeaves: exists ? prev.deductLeaves.filter(x => x !== l) : [...prev.deductLeaves, l] }; 
    }); 
  };
  
  const handleAddTempAccess = async (e: FormEvent) => { 
    e.preventDefault(); 
    const staff = staffList.find(s => s.id === tempStaffId); 
    if (!staff || !tempStart || !tempEnd) { toast.error("Fill all fields"); return; } 
    try { 
      await apiFetch('/temp-access', { method: 'POST', body: JSON.stringify({ email: staff.email, targetDept: tempDept, startDate: tempStart, endDate: tempEnd }) }); 
      toast.success('Temporary access granted'); 
      setTempStart(''); setTempEnd(''); fetchSettings(); 
    } catch (err: any) { toast.error(err.message); } 
  };

  const handleAddInspector = async (e: FormEvent) => { 
    e.preventDefault(); 
    const staff = staffList.find(s => s.id === inspectorStaffId); 
    if (!staff) { toast.error("Select a staff member"); return; } 
    try { 
      await apiFetch('/lights-inspectors', { method: 'POST', body: JSON.stringify({ staffId: staff.id, staffName: staff.name, staffSN: staff.sn }) }); 
      toast.success('Inspector added'); 
      setInspectorStaffId(''); fetchSettings(); 
    } catch (err: any) { toast.error(err.message); } 
  };

  // 🚨 SAFE TOGGLE FIX
  const togglePermission = async (staffId: string, field: string, currentVal: boolean) => {
    try {
      const staffRec = staffList.find(s => s.id === staffId);
      if (!staffRec) return;
      
      // Send ONLY the updated field to prevent DB type crashes
      const updatePayload = { [field]: !currentVal };
      
      await apiFetch(`/staff/${staffId}`, { 
        method: 'PUT', 
        body: JSON.stringify(updatePayload) 
      });
      
      toast.success(`Access updated for ${staffRec.name}`);
      fetchSettings();
    } catch (err: any) { toast.error(err.message); }
  };

  // Match real names from staffList
  let allMergedUsers: any[] = [];
  activeUsers.forEach(a => { 
    if (!a.email) return; 
    const emailLower = a.email.toLowerCase();
    const snPart = emailLower.split('@')[0];
    
    const staffMatch = staffList.find(s => 
      (s.email || '').toLowerCase() === emailLower || 
      (s.sn || '').toLowerCase() === snPart ||
      `sn-${(s.sn || '').toLowerCase()}` === snPart
    );
    
    const realName = staffMatch?.name || a.name || (a.email || '').split('@')[0];

    const idx = allMergedUsers.findIndex(u => (u.email || '').toLowerCase() === emailLower); 
    if (idx >= 0) { 
      allMergedUsers[idx] = { ...allMergedUsers[idx], name: realName, role: a.role || 'staff', department: a.department || '—', status: 'Active', id: a.id, position: staffMatch?.position || '—' }; 
    } else { 
      allMergedUsers.push({ email: a.email, name: realName, password: '—', role: a.role || 'staff', department: a.department || '—', status: 'Active', id: a.id, position: staffMatch?.position || '—' }); 
    } 
  });

  const filteredUsers = allMergedUsers.filter((u: any) => (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())).sort((a: any, b: any) => (a.email || '').localeCompare(b.email || ''));

  const smtStaff = staffList.filter(s => s.isSmt);
  const nonSecurityStaff = staffList.filter(s => !s.isSmt && s.department !== 'Security');
  const assignableSmtForRampsheet = smtStaff.filter(s => s.department !== 'Ground Operations');
  const assignableSmtForOpsBoard = smtStaff.filter(s => s.department !== 'Ground Operations');
  const assignableSmtForIncharge = smtStaff;
  const assignableBirdCountStaff = [...smtStaff, ...nonSecurityStaff].filter(s => !(s.isSmt && s.department === 'Ground Operations')).sort((a,b) => (a.name||'').localeCompare(b.name||''));

  return (
    <div className="page-content" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div className="staff-header" style={{ justifyContent: 'center', marginBottom: '20px' }}><h2 style={{ fontSize: '24px' }}>⚙️ Settings</h2></div>

      <div className="ops-tabs" style={{ justifyContent: 'center', marginBottom: '24px', margin: '0 auto 24px auto' }}>
        <button className={`ops-tab-btn ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')}>👤 General</button>
        {canManageAccess && <button className={`ops-tab-btn ${activeTab === 'rules' ? 'active' : ''}`} onClick={() => setActiveTab('rules')}>⚙️ Rules & Users</button>}
        {canManageAccess && <button className={`ops-tab-btn ${activeTab === 'incharges' ? 'active' : ''}`} onClick={() => setActiveTab('incharges')}>🔐 Access Control</button>}
        {isDev && <button className={`ops-tab-btn ${activeTab === 'detailed' ? 'active' : ''}`} onClick={() => setActiveTab('detailed')}>📋 Access Details</button>}
        {isDev && <button className={`ops-tab-btn ${activeTab === 'console' ? 'active' : ''}`} onClick={() => setActiveTab('console')}>💻 Console</button>}
      </div>

      {/* ... (General & Rules tabs omitted for brevity, they are unchanged) ... */}

      {activeTab === 'incharges' && canManageAccess && (
        <div className="dash-card border-l-4 border-purple-500">
          <h3>🔐 Access Control</h3>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
            Manage department incharges, temporary cross-department access, RWY light inspectors, and granular feature permissions.
          </p>

          {/* Temporary Access */}
          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 12px', color: '#1e293b', fontSize: '14px' }}>🔑 Temporary Cross-Department Access (Date-Based)</h4>
            <form onSubmit={handleAddTempAccess} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>Staff</label>
                <select value={tempStaffId} onChange={e => setTempStaffId(e.target.value)} required style={{ display: 'block', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#1e293b', minWidth: '220px' }}>
                  <option value="">Select Staff...</option>
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.department})</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>Target Dept</label>
                <select value={tempDept} onChange={e => setTempDept(e.target.value)} style={{ display: 'block', padding: '8px', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>Start</label>
                <input type="date" value={tempStart} onChange={e => setTempStart(e.target.value)} required style={{ display: 'block', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#1e293b' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>End</label>
                <input type="date" value={tempEnd} onChange={e => setTempEnd(e.target.value)} required style={{ display: 'block', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#1e293b' }} />
              </div>
              <button type="submit" className="quick-btn" style={{ background: '#8b5cf6', color: 'white' }}>Grant Access</button>
            </form>
            {tempAccessList.length > 0 ? (
              <table className="mini-table">
                <thead><tr><th>Name</th><th>Email</th><th>Target Dept</th><th>Start</th><th>End</th><th>Actions</th></tr></thead>
                <tbody>
                  {tempAccessList.map(t => {
                    const staffInfo = staffList.find(s => (s.email || '').toLowerCase() === t.email.toLowerCase());
                    return (
                      <tr key={t.id}>
                        <td><strong>{staffInfo?.name || t.email.split('@')[0]}</strong></td>
                        <td style={{ fontSize: '12px' }}>{t.email}</td>
                        <td>{t.targetDept}</td>
                        <td>{t.startDate}</td>
                        <td>{t.endDate}</td>
                        <td><button onClick={() => setDeleteTempTarget(t.id)} className="delete-btn">Remove</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>No temporary access grants.</p>}
          </div>

          {/* RWY Lights Inspectors */}
          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 12px', color: '#1e293b', fontSize: '14px' }}>🚨 RWY Lights Inspectors</h4>
            <form onSubmit={handleAddInspector} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>Staff</label>
                <select value={inspectorStaffId} onChange={e => setInspectorStaffId(e.target.value)} required style={{ display: 'block', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#1e293b', minWidth: '220px' }}>
                  <option value="">Select Staff...</option>
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.department})</option>)}
                </select>
              </div>
              <button type="submit" className="quick-btn" style={{ background: '#dc2626', color: 'white' }}>Add Inspector</button>
            </form>
            {inspectorList.length > 0 ? (
              <table className="mini-table">
                <thead><tr><th>Staff Name</th><th>Designation</th><th>SN</th><th>Actions</th></tr></thead>
                <tbody>
                  {inspectorList.map(i => {
                    const staffInfo = staffList.find(s => s.id === i.staffId);
                    return (
                      <tr key={i.staffId}>
                        <td><strong>{i.staffName}</strong></td>
                        <td>{staffInfo?.position || '—'}</td>
                        <td>{i.staffSN || '—'}</td>
                        <td><button onClick={() => setDeleteInspectorTarget(i.staffId)} className="delete-btn">Remove</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>No inspectors assigned.</p>}
          </div>

          {/* Granular Permissions */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 12px', color: '#1e293b', fontSize: '14px' }}>✈️ Rampsheet Edit Access</h4>
              <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {assignableSmtForRampsheet.map(s => (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={s.rampsheetEditAccess === true} onChange={() => togglePermission(s.id, 'rampsheetEditAccess', s.rampsheetEditAccess === true)} style={{ width: '16px', height: '16px' }} />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 12px', color: '#1e293b', fontSize: '14px' }}>🦅 Birds Count Edit Access</h4>
              <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {assignableBirdCountStaff.map(s => (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={s.birdCountEditAccess === true} onChange={() => togglePermission(s.id, 'birdCountEditAccess', s.birdCountEditAccess === true)} style={{ width: '16px', height: '16px' }} />
                    {s.name} {s.isSmt && '⭐'}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 12px', color: '#1e293b', fontSize: '14px' }}>📋 Ops Board Access</h4>
              <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {assignableSmtForOpsBoard.map(s => (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={s.opsBoardAccess === true} onChange={() => togglePermission(s.id, 'opsBoardAccess', s.opsBoardAccess === true)} style={{ width: '16px', height: '16px' }} />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 12px', color: '#1e293b', fontSize: '14px' }}>⭐ Assign SMT Incharge</h4>
              <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {assignableSmtForIncharge.map(s => (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={s.isIncharge === true} onChange={() => togglePermission(s.id, 'isIncharge', s.isIncharge === true)} style={{ width: '16px', height: '16px' }} />
                    {s.name} <span style={{ color: '#64748b', fontSize: '11px' }}>({s.department})</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ... (Rest of the file: ConfirmDialogs & Modals) ... */}
    </div>
  );
}

export default SettingsPage;