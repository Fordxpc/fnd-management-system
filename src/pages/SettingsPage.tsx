import { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import { authClient } from '../lib/auth-client';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import ChangePasswordModal from './ChangePasswordModal';
import { ConfirmDialog } from '../components/Dialogs';
import { UserEditModal } from '../components/UserEditModal';


function SettingsPage() {
  const { user, profile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'rules' | 'incharges' | 'detailed'>('general');
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const isDev = (profile?.role || '').toLowerCase() === 'developer';
  const isManager = ['manager', 'admin', 'owner'].includes((profile?.role || '').toLowerCase());
  const canManageAccess = isDev || isManager;

  const [otRules, setOtRules] = useState({ adminHours: 40, regularHours: 48, deductLeaves: ['SICK LEAVE', 'SICK LEAVE / MC'] });
  const [savingRules, setSavingRules] = useState(false);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingAccess, setUpdatingAccess] = useState('');

  const [resetRequests, setResetRequests] = useState<any[]>([]);
  const [completedReset, setCompletedReset] = useState<{ email: string; temporaryPassword: string; userName: string; loginUrl: string } | null>(null);
  const [resetPwTarget, setResetPwTarget] = useState<string | null>(null);
  const [deleteInspectorTarget, setDeleteInspectorTarget] = useState<string | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<{id: string, email: string} | null>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const resetShareMessage = completedReset ? `Funadhoo Airport Management System\n\nYour forgot-password request has been approved.\n\nLogin link: ${completedReset.loginUrl}\nUsername: ${completedReset.userName}\nTemporary password: ${completedReset.temporaryPassword}\n\nPlease sign in and change your password immediately. Your new password must be between 6 and 10 characters. Do not share this message with anyone else.` : '';
  const copyResetMessage = async () => {
    try { await navigator.clipboard.writeText(resetShareMessage); toast.success('Complete reset message copied'); }
    catch { toast.error('Unable to copy automatically. Select the message and copy it manually.'); }
  };


  const [inspectorStaffId, setInspectorStaffId] = useState('');
  const [inspectorList, setInspectorList] = useState<any[]>([]);

  const fetchSettings = useCallback(async () => {
    try {
      const [rulesData, usersData, staffData, inspectorsData, requestsData] = await Promise.all([
        apiFetch('/settings/ot_rules').catch(() => null), 
        apiFetch('/users').catch(() => []), 
        apiFetch('/staff').catch(() => []), 
        apiFetch('/lights-inspectors').catch(() => []),
        canManageAccess ? apiFetch('/password-reset-requests').catch(() => []) : Promise.resolve([])
      ]);
      
      if (rulesData) setOtRules(rulesData);
      setActiveUsers(Array.isArray(usersData) ? usersData : []);
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

  const handleAddInspector = async (e: FormEvent) => { 
    e.preventDefault(); const staff = staffList.find(s => s.id === inspectorStaffId); 
    if (!staff) { toast.error("Select a staff member"); return; } 
    try { await apiFetch('/lights-inspectors', { method: 'POST', body: JSON.stringify({ staffId: staff.id, staffName: staff.name, staffSN: staff.sn }) }); toast.success('Inspector added'); setInspectorStaffId(''); fetchSettings(); } 
    catch (err: any) { toast.error(err.message); } 
  };

  const togglePermission = async (staffId: string, field: string, currentVal: boolean) => {
    const updateKey = `${staffId}:${field}`;
    setUpdatingAccess(updateKey);
    try {
      const staffRec = staffList.find(s => s.id === staffId);
      if (!staffRec) return;
      await apiFetch(`/staff/${staffId}`, { method: 'PUT', body: JSON.stringify({ [field]: !currentVal }) });
      toast.success(`Access updated for ${staffRec.name}`);
      await fetchSettings();
    } catch (err: any) { toast.error(err.message); }
    finally { setUpdatingAccess(''); }
  };

  const isRoleAutoGranted = (s: any, field: string) => {
    const memberRole = getStaffRole(s);
    if (["developer", "admin", "manager", "owner"].includes(memberRole)) return true;
    if (s.specialOpsAccess && ["opsBoardViewAccess", "opsBoardEditAccess", "rampsheetViewAccess", "rampsheetEditAccess", "flightsViewAccess", "flightsEditAccess", "birdCountViewAccess", "birdCountEditAccess", "rwyLightViewAccess", "rwyLightEditAccess"].includes(field)) return true;
    if ((s.isSmt || memberRole === "smt") && ["opsBoardViewAccess", "rampsheetViewAccess", "flightsViewAccess", "birdCountViewAccess", "rwyLightViewAccess", "rosterViewAccess", "leaveViewAccess", "leaveEditAccess", "overtimeViewAccess", "overtimeEditAccess", "reportsViewAccess"].includes(field)) return true;
    if (s.department === "Ground Operations" && (s.isSmt || memberRole === "smt") && field === "opsBoardEditAccess") return true;
    if (s.department === "Safety" && ["opsBoardViewAccess", "opsBoardEditAccess"].includes(field)) return true;
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
  const getStaffRole = (member: any) => activeUsers.find(account => String(account.email || '').toLowerCase() === String(member.email || '').toLowerCase())?.role || (member.isSmt ? 'smt' : 'staff');
  const smtStaff = staffList.filter(member => getStaffRole(member) !== 'developer' && (member.isSmt === true || getStaffRole(member) === 'smt'));
  const specialOpsStaff = staffList.filter(member => getStaffRole(member) === 'staff' && !smtStaff.some(smt => smt.id === member.id) && ['Ground Operations', 'Maintenance', 'Fire & Rescue'].includes(member.department));

  return (
    <div className="page-content settings-workspace">
      <header className="settings-hero">
        <div><span>System workspace</span><h2>Settings &amp; access</h2><p>Manage your account, operational rules and role-based access from one clear workspace.</p></div>
        <div className="settings-hero__identity"><strong>{profile?.name || user?.name || 'User'}</strong><span>{profile?.role || 'Staff'} · {profile?.department || 'FND'}</span></div>
      </header>

      <div className="ops-tabs settings-tabs">
        <button className={`ops-tab-btn ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')}>👤 General</button>
        {canManageAccess && <button className={`ops-tab-btn ${activeTab === 'rules' ? 'active' : ''}`} onClick={() => setActiveTab('rules')}>⚙️ Rules & Users</button>}
        {canManageAccess && <button className={`ops-tab-btn ${activeTab === 'incharges' ? 'active' : ''}`} onClick={() => setActiveTab('incharges')}>🔐 Access Control</button>}
        {canManageAccess && <button className={`ops-tab-btn ${activeTab === 'detailed' ? 'active' : ''}`} onClick={() => setActiveTab('detailed')}>📋 Access Details</button>}
      </div>

      {activeTab === 'general' && (
        <>
          <section className="settings-account-card">
            <div className="settings-account-avatar">{String(profile?.name || user?.name || 'U').trim().charAt(0).toUpperCase()}</div>
            <div className="settings-account-copy"><span>Signed-in system account</span><h3>{profile?.name || user?.name || 'User'}</h3><p>{profile?.email || user?.email}</p><div><strong>{profile?.role || 'Staff'}</strong><em>{profile?.department || 'FND'}</em></div></div>
            <div className="settings-account-actions"><button className="change-pw-btn" onClick={() => setShowPasswordModal(true)}>Change password</button><button className="logout-btn" onClick={logout}>Log out</button></div>
          </section>
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
                            try {
                              const result = await apiFetch(`/password-reset-requests/${r.id}/approve`, { method: 'POST' });
                              setCompletedReset({ email: r.email, temporaryPassword: result.temporaryPassword, userName: result.userName || r.email, loginUrl: result.loginUrl || window.location.origin });
                              fetchSettings();
                            } catch(e: any) { toast.error(e.message); }
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
        <div className="access-control-workspace">
          <header className="access-control-hero">
            <div><span>Role-based policy</span><h3>Access Control</h3><p>Automatic permissions follow role and department. Only meaningful exceptions can be changed here.</p></div>
            <div><strong>{smtStaff.length}</strong><span>SMT members</span></div>
          </header>

          <section className="access-policy-grid">
            <article><strong>Management</strong><p>Developer, Admin and Manager receive automatic operational and management access.</p><span>Developer accounts remain protected.</span></article>
            <article><strong>SMT automatic access</strong><p>All-department visibility, operational views, reports, and own-department Leave/OT approval.</p><span>Ground Operations SMT also edits the Ops Board.</span></article>
            <article><strong>Special Ops bundle</strong><p>Ops Board, Flights, Flight Operations, Wildlife, RWY Lights and operational notifications.</p><span>Safety automatically receives Ops Board edit only.</span></article>
          </section>

          <details className="access-control-section" open>
            <summary><div><h4>SMT and department in-charge</h4><p>Only SMT members can be assigned as department in-charge.</p></div><span>{smtStaff.length} eligible</span></summary>
            <div className="access-member-grid">
              {smtStaff.map(member => {
                const isGroundOpsSMT = member.department === 'Ground Operations';
                const specialEligible = ['Ground Operations', 'Maintenance', 'Fire & Rescue'].includes(member.department);
                return <article className="access-member-card" key={member.id}>
                  <div className="access-member-head"><div className="access-member-avatar">{String(member.name || '?').charAt(0)}</div><div><strong>{member.name}</strong><span>{member.position || 'SMT Member'} · {member.department}</span></div><em>SMT</em></div>
                  <div className="access-auto-list"><span>All departments</span><span>Operational views</span><span>Reports</span><span>Leave/OT oversight</span>{isGroundOpsSMT && <span>Ops Board edit</span>}</div>
                  <div className="access-switch-row"><div><strong>Department in-charge</strong><small>Approve and manage own department</small></div><button type="button" className={`access-switch ${member.isIncharge ? 'active' : ''}`} disabled={updatingAccess === `${member.id}:isIncharge`} onClick={() => void togglePermission(member.id, 'isIncharge', member.isIncharge === true)}><span /></button></div>
                  {specialEligible && <div className="access-switch-row"><div><strong>Special Ops edit bundle</strong><small>Operational edit access beyond automatic views</small></div><button type="button" className={`access-switch ${member.specialOpsAccess ? 'active' : ''}`} disabled={updatingAccess === `${member.id}:specialOpsAccess`} onClick={() => void togglePermission(member.id, 'specialOpsAccess', member.specialOpsAccess === true)}><span /></button></div>}
                </article>;
              })}
              {smtStaff.length === 0 && <p className="access-empty">No SMT members are configured.</p>}
            </div>
          </details>

          <details className="access-control-section">
            <summary><div><h4>Special Operations exceptions</h4><p>Only Ground Operations, Maintenance and Fire & Rescue staff who may need an exception are listed.</p></div><span>{specialOpsStaff.length} eligible</span></summary>
            <div className="access-special-list">
              {specialOpsStaff.map(member => <article key={member.id}><div><strong>{member.name}</strong><span>{member.position || 'Staff'} · {member.department}</span></div><div className="access-bundle-label">Six operational modules</div><button type="button" className={`access-switch ${member.specialOpsAccess ? 'active' : ''}`} disabled={updatingAccess === `${member.id}:specialOpsAccess`} onClick={() => void togglePermission(member.id, 'specialOpsAccess', member.specialOpsAccess === true)}><span /></button></article>)}
              {specialOpsStaff.length === 0 && <p className="access-empty">No eligible operational staff found.</p>}
            </div>
          </details>

          <details className="access-control-section compact">
            <summary><div><h4>RWY Lights inspectors</h4><p>Operational assignment list, separate from system access.</p></div></summary>
            <form className="access-inline-form" onSubmit={handleAddInspector}><select value={inspectorStaffId} onChange={event => setInspectorStaffId(event.target.value)} required><option value="">Select eligible staff…</option>{[...smtStaff, ...specialOpsStaff].filter((member, index, list) => list.findIndex(item => item.id === member.id) === index).map(member => <option key={member.id} value={member.id}>{member.name} · {member.department}</option>)}</select><button type="submit">Add inspector</button></form>
            <div className="access-inspector-list">{inspectorList.map(inspector => <span key={inspector.staffId}><strong>{inspector.staffName}</strong><button type="button" onClick={() => setDeleteInspectorTarget(inspector.staffId)}>Remove</button></span>)}{inspectorList.length === 0 && <p className="access-empty">No inspectors assigned.</p>}</div>
          </details>
        </div>
      )}
      {activeTab === 'detailed' && canManageAccess && (
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
                  <th style={{ textAlign: 'center' }}>Flights (V/E)</th>
                  <th style={{ textAlign: 'center' }}>Roster (V/E)</th>
                  <th style={{ textAlign: 'center' }}>Leave (V/E)</th>
                  <th style={{ textAlign: 'center' }}>Overtime (V/E)</th>
                  <th style={{ textAlign: 'center' }}>Reports (V/E)</th>
                  <th style={{ textAlign: 'center' }}>Staff (V/E)</th>
                  <th style={{ textAlign: 'center' }}>Settings (V/E)</th>
                  <th>Incharge</th>
                </tr>
              </thead>
              <tbody>
                {staffList.filter(s => isDev || getStaffRole(s) !== 'developer').map(s => (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.department}</td>
                    <td style={{ textTransform: 'uppercase', fontSize: '10px', fontWeight: 700 }}>{s.isSmt ? 'SMT' : 'Staff'}</td>
                    <td style={{ textAlign: 'center' }}>{(isRoleAutoGranted(s, 'rampsheetViewAccess') || s.rampsheetViewAccess) ? '✅' : '❌'} / {(isRoleAutoGranted(s, 'rampsheetEditAccess') || s.rampsheetEditAccess) ? '✅' : '❌'}</td>
                    <td style={{ textAlign: 'center' }}>{(isRoleAutoGranted(s, 'rwyLightViewAccess') || s.rwyLightViewAccess) ? '✅' : '❌'} / {(isRoleAutoGranted(s, 'rwyLightEditAccess') || s.rwyLightEditAccess) ? '✅' : '❌'}</td>
                    <td style={{ textAlign: 'center' }}>{(isRoleAutoGranted(s, 'birdCountViewAccess') || s.birdCountViewAccess) ? '✅' : '❌'} / {(isRoleAutoGranted(s, 'birdCountEditAccess') || s.birdCountEditAccess) ? '✅' : '❌'}</td>
                    <td style={{ textAlign: 'center' }}>{(isRoleAutoGranted(s, 'opsBoardViewAccess') || s.opsBoardViewAccess) ? '✅' : '❌'} / {(isRoleAutoGranted(s, 'opsBoardEditAccess') || s.opsBoardEditAccess) ? '✅' : '❌'}</td>
                    <td style={{ textAlign: 'center' }}>{(isRoleAutoGranted(s, 'flightsViewAccess') || s.flightsViewAccess) ? '✅' : '❌'} / {(isRoleAutoGranted(s, 'flightsEditAccess') || s.flightsEditAccess) ? '✅' : '❌'}</td>
                    <td style={{ textAlign: 'center' }}>{(isRoleAutoGranted(s, 'rosterViewAccess') || s.rosterViewAccess) ? '✅' : '❌'} / {(isRoleAutoGranted(s, 'rosterEditAccess') || s.rosterEditAccess) ? '✅' : '❌'}</td>
                    <td style={{ textAlign: 'center' }}>{(isRoleAutoGranted(s, 'leaveViewAccess') || s.leaveViewAccess) ? '✅' : '❌'} / {(isRoleAutoGranted(s, 'leaveEditAccess') || s.leaveEditAccess) ? '✅' : '❌'}</td>
                    <td style={{ textAlign: 'center' }}>{(isRoleAutoGranted(s, 'overtimeViewAccess') || s.overtimeViewAccess) ? '✅' : '❌'} / {(isRoleAutoGranted(s, 'overtimeEditAccess') || s.overtimeEditAccess) ? '✅' : '❌'}</td>
                    <td style={{ textAlign: 'center' }}>{(isRoleAutoGranted(s, 'reportsViewAccess') || s.reportsViewAccess) ? '✅' : '❌'} / {(isRoleAutoGranted(s, 'reportsEditAccess') || s.reportsEditAccess) ? '✅' : '❌'}</td>
                    <td style={{ textAlign: 'center' }}>{(isRoleAutoGranted(s, 'staffViewAccess') || s.staffViewAccess) ? '✅' : '❌'} / {(isRoleAutoGranted(s, 'staffEditAccess') || s.staffEditAccess) ? '✅' : '❌'}</td>
                    <td style={{ textAlign: 'center' }}>{(isRoleAutoGranted(s, 'settingsViewAccess') || s.settingsViewAccess) ? '✅' : '❌'} / {(isRoleAutoGranted(s, 'settingsEditAccess') || s.settingsEditAccess) ? '✅' : '❌'}</td>
                    <td style={{ textAlign: 'center', color: s.isIncharge ? '#16a34a' : '#cbd5e1' }}>{s.isIncharge ? '✅' : '❌'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}

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

      {completedReset && (
        <div className="modal-backdrop" onClick={() => setCompletedReset(null)}>
          <div className="modal-content reset-share-modal" onClick={event => event.stopPropagation()}>
            <span className="reset-share-kicker">Forgot-password request approved</span>
            <h3>Temporary login details</h3>
            <p>Copy the complete message below and send it securely to the user.</p>
            <textarea readOnly value={resetShareMessage} rows={11} onFocus={event => event.currentTarget.select()} />
            <div className="reset-share-details"><span>Password length</span><strong>{completedReset.temporaryPassword.length} characters</strong></div>
            <div className="modal-actions"><button className="cancel-btn" onClick={() => setCompletedReset(null)}>Close</button><button className="submit-btn" onClick={() => void copyResetMessage()}>Copy complete message</button></div>
          </div>
        </div>
      )}
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
