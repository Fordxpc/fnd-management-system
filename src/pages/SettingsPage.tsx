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
  const canManageAccess = isDev || isManager;
  
  const [otRules, setOtRules] = useState({ adminHours: 40, regularHours: 48, deductLeaves: ['SICK LEAVE', 'SICK LEAVE / MC'] });
  const [savingRules, setSavingRules] = useState(false);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [resetRequests, setResetRequests] = useState<any[]>([]);
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
      const [rulesData, usersData, tempAccessData, staffData, inspectorsData, requestsData] = await Promise.all([
        apiFetch('/settings/ot_rules').catch(() => null), 
        apiFetch('/users').catch(() => []), 
        apiFetch('/temp-access').catch(() => []), 
        apiFetch('/staff').catch(() => []), 
        apiFetch('/lights-inspectors').catch(() => []),
        canManageAccess ? apiFetch('/password-reset-requests').catch(() => []) : Promise.resolve([])
      ]);
      
      if (rulesData) setOtRules(rulesData);
      setActiveUsers(Array.isArray(usersData) ? usersData : []);
      setTempAccessList(Array.isArray(tempAccessData) ? tempAccessData : []);
      setStaffList(Array.isArray(staffData) ? staffData : []); 
      setInspectorList(Array.isArray(inspectorsData) ? inspectorsData : []);
      setResetRequests(Array.isArray(requestsData) ? requestsData : []);
    } catch (err: any) { 
      console.error("Failed to load settings", err); 
    }
  }, [canManageAccess]);

  useEffect(() => {
    fetchSettings();
    const interval = setInterval(fetchSettings, 15000);
    return () => clearInterval(interval);
  }, [fetchSettings]);

  const saveRules = async (e: FormEvent) => { 
    e.preventDefault(); setSavingRules(true); 
    try { await apiFetch('/settings/ot_rules', { method: 'POST', body: JSON.stringify(otRules) }); toast.success('System rules updated!'); } 
    catch (err: any) { toast.error('Error: ' + err.message); } 
    setSavingRules(false); 
  };

  const toggleDeductLeave = (l: string) => { 
    setOtRules(prev => { 
      const exists = prev.deductLeaves.includes(l); 
      return { ...prev, deductLeaves: exists ? prev.deductLeaves.filter(x => x !== l) : [...prev.deductLeaves, l] }; 
    }); 
  };
  
  const handleAddTempAccess = async (e: FormEvent) => { 
    e.preventDefault(); const staff = staffList.find(s => s.id === tempStaffId); 
    if (!staff || !tempStart || !tempEnd) { toast.error("Fill all fields"); return; } 
    try { await apiFetch('/temp-access', { method: 'POST', body: JSON.stringify({ email: staff.email, targetDept: tempDept, startDate: tempStart, endDate: tempEnd }) }); toast.success('Temporary access granted'); setTempStart(''); setTempEnd(''); fetchSettings(); } 
    catch (err: any) { toast.error(err.message); } 
  };

  const handleAddInspector = async (e: FormEvent) => { 
    e.preventDefault(); const staff = staffList.find(s => s.id === inspectorStaffId); 
    if (!staff) { toast.error("Select a staff member"); return; } 
    try { await apiFetch('/lights-inspectors', { method: 'POST', body: JSON.stringify({ staffId: staff.id, staffName: staff.name, staffSN: staff.sn }) }); toast.success('Inspector added'); setInspectorStaffId(''); fetchSettings(); } 
    catch (err: any) { toast.error(err.message); } 
  };

  const togglePermission = async (staffId: string, field: string, currentVal: boolean) => {
    try {
      const staffRec = staffList.find(s => s.id === staffId);
      if (!staffRec) return;
      const updatePayload = { [field]: !currentVal };
      await apiFetch(`/staff/${staffId}`, { method: 'PUT', body: JSON.stringify(updatePayload) });
      toast.success(`Access updated for ${staffRec.name}`);
      fetchSettings();
    } catch (err: any) { toast.error(err.message); }
  };

  const isRoleAutoGranted = (s: any, field: string) => {
    if (isDev || isManager) return true; 
    if (s.department === 'Ground Operations' && (s.isSMT || s.role === 'smt')) {
      if (['opsBoardViewAccess', 'opsBoardEditAccess', 'rampsheetViewAccess', 'rampsheetEditAccess'].includes(field)) return true;
    }
    return false;
  };

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
  const smtStaff = staffList.filter(s => s.isSMT);

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

      {activeTab === 'general' && (
        <>
          <div className="dash-card mb-4 border-l-4 border-slate-500" style={{ textAlign: 'center', padding: '30px' }}>
            <h3 style={{ marginBottom: '16px' }}>👤 Account Information</h3>
            <p style={{ margin: '0 0 8px', color: '#475569', fontSize: '16px' }}>Logged in as: <strong style={{ color: '#0f172a', fontSize: '18px' }}>{profile?.name || user?.name || 'User'}</strong></p>
            <p style={{ margin: '0 0 20px', color: '#475569', fontSize: '14px' }}>Role: <span style={{ textTransform: 'uppercase', fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '4px 10px', borderRadius: '12px' }}>{profile?.role || 'Staff'}</span></p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="change-pw-btn" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => setShowPasswordModal(true)}>🔐 Change Password</button>
              <button className="logout-btn" style={{ width: 'auto', padding: '10px 20px' }} onClick={logout}>Log Out</button>
            </div>
          </div>
        </>
      )}

      {activeTab === 'rules' && canManageAccess && (
        <div className="dash-card border-l-4 border-blue-500">
          <h3>⚙️ System Rules & Access Control</h3>
          
          {resetRequests.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #fca5a5', padding: '20px', borderRadius: '8px', marginBottom: '24px', marginTop: '16px' }}>
              <h4 style={{ margin: '0 0 12px', color: '#dc2626' }}>🚨 Pending Password Resets</h4>
              <table className="mini-table">
                <thead><tr><th>Email</th><th>Requested At</th><th>Action</th></tr></thead>
                <tbody>
                  {resetRequests.map(r => (
                    <tr key={r.id}>
                      <td>{r.email}</td>
                      <td>{new Date(r.requestedAt).toLocaleString()}</td>
                      <td>
                        <button className="quick-btn" style={{ background: '#dc2626', color: 'white', padding: '4px 8px' }} onClick={async () => {
                            try { await apiFetch(`/password-reset-requests/${r.id}/approve`, { method: 'POST' }); toast.success(`Password reset for ${r.email}`); fetchSettings(); } catch(e: any) { toast.error(e.message); }
                        }}>Approve & Reset</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <form onSubmit={saveRules} style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px', marginTop: '16px' }}>
            <h4 style={{ margin: '0 0 16px', color: '#1e293b' }}>Overtime Thresholds</h4>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>Regular Staff Weekly Hours</label>
                <input type="number" value={otRules.regularHours} onChange={e => setOtRules({...otRules, regularHours: Number(e.target.value)})} style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', width: '120px', color: '#1e293b' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>Admin Staff Weekly Hours</label>
                <input type="number" value={otRules.adminHours} onChange={e => setOtRules({...otRules, adminHours: Number(e.target.value)})} style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', width: '120px', color: '#1e293b' }} />
              </div>
            </div>
            <button type="submit" disabled={savingRules} className="quick-btn" style={{ background: '#2563eb', color: 'white' }}>{savingRules ? 'Saving...' : 'Save Rules'}</button>
          </form>

          {isDev && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '20px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                <div><h4 style={{ margin: 0, color: '#1e293b' }}>👥 Master User List ({activeUsers.length})</h4></div>
                <input type="text" placeholder="🔍 Search name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', width: '250px', fontSize: '13px', color: '#1e293b' }} />
              </div>
              <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <table className="mini-table" style={{ margin: 0, width: '100%' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                    <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>No users found matching "{searchQuery}"</td></tr>
                    ) : filteredUsers.map(u => (
                      <tr key={u.email}>
                        <td><strong>{u.name}</strong></td>
                        <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{u.email}</td>
                        <td><span style={{ textTransform: 'uppercase', fontWeight: 700, fontSize: '11px', background: u.role === 'developer' ? '#fee2e2' : u.role === 'smt' ? '#fef3c7' : '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>{u.role}</span></td>
                        <td><span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: u.status === 'Active' ? '#dcfce7' : '#f1f5f9', color: u.status === 'Active' ? '#166534' : '#475569' }}>{u.status.toUpperCase()}</span></td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {u.id && (<button className="edit-btn" onClick={() => setEditingUser(u)} style={{ padding: '4px 8px', fontSize: '11px', marginRight: '6px' }}>✏️ Edit</button>)}
                          <button className="reset-pw-btn" disabled={resetPwTarget === u.email} onClick={() => setResetPwTarget(u.email)} style={{ padding: '4px 8px', fontSize: '11px', marginRight: '6px' }}>{resetPwTarget === u.email ? '...' : '📧 Reset'}</button>
                          {u.id && (<button className="delete-btn" onClick={() => setDeleteUserTarget({ id: u.id!, email: u.email })} style={{ padding: '4px 8px', fontSize: '11px' }}>Remove</button>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'incharges' && canManageAccess && (
        <div className="dash-card border-l-4 border-purple-500">
          <h3>🔐 Access Control</h3>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
            Manage department incharges, temporary cross-department access, and granular feature permissions.
          </p>

          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 12px', color: '#1e293b', fontSize: '14px' }}>🔑 Temporary Cross-Department Access</h4>
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

          <div style={{ marginTop: '30px' }}>
            <h3 style={{ fontSize: '18px', color: '#1e293b', marginBottom: '16px' }}>Granular Permissions</h3>

            {smtStaff.length > 0 && (
              <div style={{ marginBottom: '24px', background: '#fef3c7', padding: '16px', borderRadius: '8px', border: '1px solid #fde68a' }}>
                <h4 style={{ margin: '0 0 12px', color: '#b45309', fontSize: '15px' }}>⭐ SMT Members</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table className="mini-table" style={{ fontSize: '12px', whiteSpace: 'nowrap', margin: 0, background: 'white' }}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Designation</th>
                        <th style={{ textAlign: 'center' }}>Rampsheet (V / E)</th>
                        <th style={{ textAlign: 'center' }}>RWY Lights (V / E)</th>
                        <th style={{ textAlign: 'center' }}>Bird Count (V / E)</th>
                        <th style={{ textAlign: 'center' }}>Ops Board (V / E)</th>
                        <th style={{ textAlign: 'center' }}>Incharge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {smtStaff.map(s => (
                        <tr key={s.id}>
                          <td><strong>{s.name}</strong></td>
                          <td>{s.position || '—'}</td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <input type="checkbox" title="View" checked={isRoleAutoGranted(s, 'rampsheetViewAccess') || s.rampsheetViewAccess === true} disabled={isRoleAutoGranted(s, 'rampsheetViewAccess')} onChange={() => togglePermission(s.id, 'rampsheetViewAccess', s.rampsheetViewAccess === true)} style={{ width: '16px', height: '16px' }} />
                            <span style={{ margin: '0 4px', color: '#cbd5e1' }}>|</span>
                            <input type="checkbox" title="Edit" checked={isRoleAutoGranted(s, 'rampsheetEditAccess') || s.rampsheetEditAccess === true} disabled={isRoleAutoGranted(s, 'rampsheetEditAccess')} onChange={() => togglePermission(s.id, 'rampsheetEditAccess', s.rampsheetEditAccess === true)} style={{ width: '16px', height: '16px' }} />
                          </td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <input type="checkbox" title="View" checked={isRoleAutoGranted(s, 'rwyLightViewAccess') || s.rwyLightViewAccess === true} disabled={isRoleAutoGranted(s, 'rwyLightViewAccess')} onChange={() => togglePermission(s.id, 'rwyLightViewAccess', s.rwyLightViewAccess === true)} style={{ width: '16px', height: '16px' }} />
                            <span style={{ margin: '0 4px', color: '#cbd5e1' }}>|</span>
                            <input type="checkbox" title="Edit" checked={isRoleAutoGranted(s, 'rwyLightEditAccess') || s.rwyLightEditAccess === true} disabled={isRoleAutoGranted(s, 'rwyLightEditAccess')} onChange={() => togglePermission(s.id, 'rwyLightEditAccess', s.rwyLightEditAccess === true)} style={{ width: '16px', height: '16px' }} />
                          </td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <input type="checkbox" title="View" checked={isRoleAutoGranted(s, 'birdCountViewAccess') || s.birdCountViewAccess === true} disabled={isRoleAutoGranted(s, 'birdCountViewAccess')} onChange={() => togglePermission(s.id, 'birdCountViewAccess', s.birdCountViewAccess === true)} style={{ width: '16px', height: '16px' }} />
                            <span style={{ margin: '0 4px', color: '#cbd5e1' }}>|</span>
                            <input type="checkbox" title="Edit" checked={isRoleAutoGranted(s, 'birdCountEditAccess') || s.birdCountEditAccess === true} disabled={isRoleAutoGranted(s, 'birdCountEditAccess')} onChange={() => togglePermission(s.id, 'birdCountEditAccess', s.birdCountEditAccess === true)} style={{ width: '16px', height: '16px' }} />
                          </td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <input type="checkbox" title="View" checked={isRoleAutoGranted(s, 'opsBoardViewAccess') || s.opsBoardViewAccess === true} disabled={isRoleAutoGranted(s, 'opsBoardViewAccess')} onChange={() => togglePermission(s.id, 'opsBoardViewAccess', s.opsBoardViewAccess === true)} style={{ width: '16px', height: '16px' }} />
                            <span style={{ margin: '0 4px', color: '#cbd5e1' }}>|</span>
                            <input type="checkbox" title="Edit" checked={isRoleAutoGranted(s, 'opsBoardEditAccess') || s.opsBoardEditAccess === true} disabled={isRoleAutoGranted(s, 'opsBoardEditAccess')} onChange={() => togglePermission(s.id, 'opsBoardEditAccess', s.opsBoardEditAccess === true)} style={{ width: '16px', height: '16px' }} />
                          </td>
                          <td style={{ textAlign: 'center' }}><input type="checkbox" checked={s.isIncharge === true} onChange={() => togglePermission(s.id, 'isIncharge', s.isIncharge === true)} style={{ width: '16px', height: '16px' }} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {DEPARTMENTS.map(dept => {
              const deptStaff = staffList.filter(s => s.department === dept && !s.isSmt);
              if (deptStaff.length === 0) return null;
              
              return (
                <div key={dept} style={{ marginBottom: '24px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 12px', color: '#1e293b', fontSize: '15px' }}>{dept}</h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="mini-table" style={{ fontSize: '12px', whiteSpace: 'nowrap', margin: 0, background: 'white' }}>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Designation</th>
                          <th style={{ textAlign: 'center' }}>Rampsheet (V / E)</th>
                          <th style={{ textAlign: 'center' }}>RWY Lights (V / E)</th>
                          <th style={{ textAlign: 'center' }}>Bird Count (V / E)</th>
                          <th style={{ textAlign: 'center' }}>Ops Board (V / E)</th>
                          <th style={{ textAlign: 'center' }}>Incharge</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deptStaff.map(s => (
                          <tr key={s.id}>
                            <td><strong>{s.name}</strong></td>
                            <td>{s.position || '—'}</td>
                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <input type="checkbox" title="View" checked={isRoleAutoGranted(s, 'rampsheetViewAccess') || s.rampsheetViewAccess === true} disabled={isRoleAutoGranted(s, 'rampsheetViewAccess')} onChange={() => togglePermission(s.id, 'rampsheetViewAccess', s.rampsheetViewAccess === true)} style={{ width: '16px', height: '16px' }} />
                              <span style={{ margin: '0 4px', color: '#cbd5e1' }}>|</span>
                              <input type="checkbox" title="Edit" checked={isRoleAutoGranted(s, 'rampsheetEditAccess') || s.rampsheetEditAccess === true} disabled={isRoleAutoGranted(s, 'rampsheetEditAccess')} onChange={() => togglePermission(s.id, 'rampsheetEditAccess', s.rampsheetEditAccess === true)} style={{ width: '16px', height: '16px' }} />
                            </td>
                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <input type="checkbox" title="View" checked={isRoleAutoGranted(s, 'rwyLightViewAccess') || s.rwyLightViewAccess === true} disabled={isRoleAutoGranted(s, 'rwyLightViewAccess')} onChange={() => togglePermission(s.id, 'rwyLightViewAccess', s.rwyLightViewAccess === true)} style={{ width: '16px', height: '16px' }} />
                              <span style={{ margin: '0 4px', color: '#cbd5e1' }}>|</span>
                              <input type="checkbox" title="Edit" checked={isRoleAutoGranted(s, 'rwyLightEditAccess') || s.rwyLightEditAccess === true} disabled={isRoleAutoGranted(s, 'rwyLightEditAccess')} onChange={() => togglePermission(s.id, 'rwyLightEditAccess', s.rwyLightEditAccess === true)} style={{ width: '16px', height: '16px' }} />
                            </td>
                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <input type="checkbox" title="View" checked={isRoleAutoGranted(s, 'birdCountViewAccess') || s.birdCountViewAccess === true} disabled={isRoleAutoGranted(s, 'birdCountViewAccess')} onChange={() => togglePermission(s.id, 'birdCountViewAccess', s.birdCountViewAccess === true)} style={{ width: '16px', height: '16px' }} />
                              <span style={{ margin: '0 4px', color: '#cbd5e1' }}>|</span>
                              <input type="checkbox" title="Edit" checked={isRoleAutoGranted(s, 'birdCountEditAccess') || s.birdCountEditAccess === true} disabled={isRoleAutoGranted(s, 'birdCountEditAccess')} onChange={() => togglePermission(s.id, 'birdCountEditAccess', s.birdCountEditAccess === true)} style={{ width: '16px', height: '16px' }} />
                            </td>
                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <input type="checkbox" title="View" checked={isRoleAutoGranted(s, 'opsBoardViewAccess') || s.opsBoardViewAccess === true} disabled={isRoleAutoGranted(s, 'opsBoardViewAccess')} onChange={() => togglePermission(s.id, 'opsBoardViewAccess', s.opsBoardViewAccess === true)} style={{ width: '16px', height: '16px' }} />
                              <span style={{ margin: '0 4px', color: '#cbd5e1' }}>|</span>
                              <input type="checkbox" title="Edit" checked={isRoleAutoGranted(s, 'opsBoardEditAccess') || s.opsBoardEditAccess === true} disabled={isRoleAutoGranted(s, 'opsBoardEditAccess')} onChange={() => togglePermission(s.id, 'opsBoardEditAccess', s.opsBoardEditAccess === true)} style={{ width: '16px', height: '16px' }} />
                            </td>
                            <td style={{ textAlign: 'center' }}><input type="checkbox" checked={s.isIncharge === true} onChange={() => togglePermission(s.id, 'isIncharge', s.isIncharge === true)} style={{ width: '16px', height: '16px' }} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'detailed' && isDev && (
        <div className="dash-card border-l-4 border-purple-500">
          <h3>📋 Access Details Matrix</h3>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Comprehensive overview of all staff permissions.</p>
          
          <div style={{ overflowX: 'auto', maxHeight: '65vh' }}>
            <table className="mini-table" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                <tr>
                  <th>Name</th>
                  <th>Dept</th>
                  <th>Role</th>
                  <th style={{ textAlign: 'center' }}>Ramp (V/E)</th>
                  <th style={{ textAlign: 'center' }}>RWY (V/E)</th>
                  <th style={{ textAlign: 'center' }}>Bird (V/E)</th>
                  <th style={{ textAlign: 'center' }}>Ops (V/E)</th>
                  <th>Incharge</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map(s => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.department}</td>
                    <td style={{ textTransform: 'uppercase', fontSize: '10px', fontWeight: 700 }}>{s.isSmt ? 'SMT' : 'Staff'}</td>
                    <td style={{ textAlign: 'center' }}>{(isRoleAutoGranted(s, 'rampsheetViewAccess') || s.rampsheetViewAccess) ? '✅' : '❌'} / {(isRoleAutoGranted(s, 'rampsheetEditAccess') || s.rampsheetEditAccess) ? '✅' : '❌'}</td>
                    <td style={{ textAlign: 'center' }}>{(isRoleAutoGranted(s, 'rwyLightViewAccess') || s.rwyLightViewAccess) ? '✅' : '❌'} / {(isRoleAutoGranted(s, 'rwyLightEditAccess') || s.rwyLightEditAccess) ? '✅' : '❌'}</td>
                    <td style={{ textAlign: 'center' }}>{(isRoleAutoGranted(s, 'birdCountViewAccess') || s.birdCountViewAccess) ? '✅' : '❌'} / {(isRoleAutoGranted(s, 'birdCountEditAccess') || s.birdCountEditAccess) ? '✅' : '❌'}</td>
                    <td style={{ textAlign: 'center' }}>{(isRoleAutoGranted(s, 'opsBoardViewAccess') || s.opsBoardViewAccess) ? '✅' : '❌'} / {(isRoleAutoGranted(s, 'opsBoardEditAccess') || s.opsBoardEditAccess) ? '✅' : '❌'}</td>
                    <td style={{ textAlign: 'center', color: s.isIncharge ? '#16a34a' : '#cbd5e1' }}>{s.isIncharge ? '✅' : '❌'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'console' && isDev && (
        <div className="dash-card border-l-4 border-slate-800" style={{ background: '#0f172a', color: '#e2e8f0', fontFamily: 'monospace' }}>
          <h3 style={{ color: '#38bdf8' }}>💻 System Console</h3>
          <div style={{ maxHeight: '400px', overflowY: 'auto', fontSize: '12px' }}>
            <p><span style={{ color: '#4ade80' }}>[OK]</span> Cloudflare D1 Database Connected</p>
            <p><span style={{ color: '#4ade80' }}>[OK]</span> Auth Provider loaded</p>
            <p><span style={{ color: '#facc15' }}>[INFO]</span> Active Staff Records: {activeUsers.length}</p>
            <p><span style={{ color: '#facc15' }}>[INFO]</span> UID: {user?.id}</p>
            <p><span style={{ color: '#facc15' }}>[INFO]</span> Current Token Expiry: {user?.metadata?.lastSignInTime || 'N/A'}</p>
            <p><span style={{ color: '#38bdf8' }}>[LOG]</span> Waiting for developer input...</p>
          </div>
        </div>
      )}

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}

      <ConfirmDialog 
        isOpen={!!deleteTempTarget}
        title="Remove Temp Access?"
        message="Are you sure you want to remove this temporary access?"
        confirmText="Remove"
        isDanger={true}
        onConfirm={async () => {
          if (!deleteTempTarget) return;
          try {
            await apiFetch(`/temp-access/${deleteTempTarget}`, { method: 'DELETE' });
            toast.success('Access removed');
            fetchSettings();
          } catch (err: any) { toast.error(err.message); }
          setDeleteTempTarget(null);
        }}
        onCancel={() => setDeleteTempTarget(null)}
      />

      <ConfirmDialog 
        isOpen={!!deleteInspectorTarget}
        title="Remove Inspector?"
        message="Are you sure you want to remove this staff member from RWY Lights inspectors?"
        confirmText="Remove"
        isDanger={true}
        onConfirm={async () => {
          if (!deleteInspectorTarget) return;
          try {
            await apiFetch(`/lights-inspectors/${deleteInspectorTarget}`, { method: 'DELETE' });
            toast.success('Inspector removed');
            fetchSettings();
          } catch (err: any) { toast.error(err.message); }
          setDeleteInspectorTarget(null);
        }}
        onCancel={() => setDeleteInspectorTarget(null)}
      />

      <ConfirmDialog 
        isOpen={!!resetPwTarget}
        title="Send Password Reset?"
        message={`Send a password reset email to ${resetPwTarget}?`}
        confirmText="Send Email"
        isDanger={false}
        onConfirm={async () => {
          if (!resetPwTarget) return;
          try {
            await (authClient as any).forgetPassword({ email: resetPwTarget, redirectTo: '/reset-password' });
            toast.success(`Reset email sent to ${resetPwTarget}.`);
          } catch (err: any) {
            toast.error(err.message || 'Failed to send reset email.');
          }
          setResetPwTarget(null);
        }}
        onCancel={() => setResetPwTarget(null)}
      />

      <ConfirmDialog 
        isOpen={!!deleteUserTarget}
        title="Remove User?"
        message={`Are you sure you want to remove ${deleteUserTarget?.email} from the database?`}
        confirmText="Remove"
        isDanger={true}
        onConfirm={async () => {
          if (!deleteUserTarget) return;
          try {
            await apiFetch(`/users/${deleteUserTarget.id}`, { method: 'DELETE' });
            toast.success(`${deleteUserTarget.email} removed from lists.`);
            fetchSettings();
          } catch (err: any) { toast.error('Error: ' + err.message); }
          setDeleteUserTarget(null);
        }}
        onCancel={() => setDeleteUserTarget(null)}
      />

      {editingUser && (
        <UserEditModal 
          user={editingUser} 
          onClose={() => setEditingUser(null)} 
          onSaved={fetchSettings} 
        />
      )}
    </div>
  );
}

export default SettingsPage;