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

  const togglePermission = async (staffId: string, field: string, currentVal: boolean) => {
    try {
      const staffRec = staffList.find(s => s.id === staffId);
      if (!staffRec) return;
      const updated = { ...staffRec, [field]: !currentVal };
      await apiFetch(`/staff/${staffId}`, { method: 'PUT', body: JSON.stringify(updated) });
      toast.success(`Access updated for ${staffRec.name}`);
      fetchSettings();
    } catch (err: any) { toast.error(err.message); }
  };

  // 🚨 THIS IS THE FIX: Look up the real name from the staffList
  let allMergedUsers: any[] = [];
  activeUsers.forEach(a => { 
    if (!a.email) return; 
    const emailLower = a.email.toLowerCase();
    const snPart = emailLower.split('@')[0];
    
    // Find matching staff member to get the real name
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
              <h4 style={{ margin: 0, color: '#1e293b', marginBottom: '12px' }}>👥 Master User List ({activeUsers.length})</h4>
              <input type="text" placeholder="🔍 Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', width: '100%', maxWidth: '300px', marginBottom: '12px', fontSize: '13px' }} />
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="mini-table" style={{ margin: 0, width: '100%' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f8fafc' }}>
                    <tr><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.email}>
                        <td><strong>{u.name}</strong></td>
                        <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{u.email}</td>
                        <td><span style={{ textTransform: 'uppercase', fontWeight: 700, fontSize: '11px', background: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>{u.role}</span></td>
                        <td>
                          <button className="edit-btn" onClick={() => setEditingUser(u)} style={{ padding: '4px 8px', fontSize: '11px', marginRight: '6px' }}>✏️ Edit</button>
                          <button className="delete-btn" onClick={() => setDeleteUserTarget({ id: u.id!, email: u.email })} style={{ padding: '4px 8px', fontSize: '11px' }}>Remove</button>
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

      {/* Keep the rest of the tabs (incharges, detailed, console) as they were in your file */}

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}

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
            toast.success(`${deleteUserTarget.email} removed.`);
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