import { useState, useEffect, useCallback } from 'react';
import { auth } from '../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import ChangePasswordModal from './ChangePasswordModal';
import { ConfirmDialog } from '../components/Dialogs';

const ALL_LEAVES = ['ANNUAL LEAVE', 'SICK LEAVE', 'SICK LEAVE / MC', 'NO PAY LEAVE', 'DUTY TRAVEL', 'PATERNITY LEAVE', 'MATERNITY LEAVE', 'PRE-MATERNITY LEAVE', 'FAMILY RESPONSIBILITY LEAVE (FRL)'];
const DEPARTMENTS = ['Ground Operations', 'Maintenance', 'Security', 'Fire & Rescue', 'Administration', 'Safety'];
const STAFF_CREDENTIALS = [ { email: 'sn-0034@funadhooairport.com', password: 'Fnd@2026', name: 'Abdulla Adam' } /* ... */ ]; // Add your full list here

function SettingsPage() {
  const { profile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'rules' | 'incharges' | 'detailed' | 'console'>('general');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  const isDev = profile?.role === 'developer';
  const isManager = profile?.role === 'manager' || profile?.role === 'admin';
  const isSMT = profile?.role === 'smt' || profile?.isSMT === true;
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

  const [tempAccessList, setTempAccessList] = useState<any[]>([]);
  const [tempStaffId, setTempStaffId] = useState('');
  const [tempDept, setTempDept] = useState('Maintenance');
  const [tempStart, setTempStart] = useState('');
  const [tempEnd, setTempEnd] = useState('');

  const [inspectorStaffId, setInspectorStaffId] = useState('');
  const [inspectorList, setInspectorList] = useState<any[]>([]);
  
  const currentUser = auth.currentUser;

  const fetchSettings = useCallback(async () => {
    try {
      const [rulesData, usersData, tempAccessData, staffData, inspectorsData] = await Promise.all([
        apiFetch('/settings/ot_rules'), apiFetch('/users'), apiFetch('/temp-access'), apiFetch('/staff'), apiFetch('/lights-inspectors')
      ]);
      if (rulesData) setOtRules(rulesData);
      setActiveUsers(usersData); setTempAccessList(tempAccessData);
      setStaffList(staffData); setInspectorList(inspectorsData);
    } catch (err: any) { console.error("Failed to load settings", err); }
  }, []);

  useEffect(() => {
    fetchSettings();
    const interval = setInterval(fetchSettings, 15000);
    return () => clearInterval(interval);
  }, [fetchSettings]);

  const saveRules = async (e: any) => { e.preventDefault(); setSavingRules(true); try { await apiFetch('/settings/ot_rules', { method: 'POST', body: JSON.stringify(otRules) }); toast.success('System rules updated!'); } catch (err: any) { toast.error('Error: ' + err.message); } setSavingRules(false); };
  const toggleDeductLeave = (l: string) => { setOtRules(prev => { const exists = prev.deductLeaves.includes(l); return { ...prev, deductLeaves: exists ? prev.deductLeaves.filter(x => x !== l) : [...prev.deductLeaves, l] }; }); };
  
  const handleAddTempAccess = async (e: any) => { e.preventDefault(); const staff = staffList.find(s => s.id === tempStaffId); if (!staff || !tempStart || !tempEnd) { toast.error("Fill all fields"); return; } try { await apiFetch('/temp-access', { method: 'POST', body: JSON.stringify({ email: staff.email, targetDept: tempDept, startDate: tempStart, endDate: tempEnd }) }); toast.success('Temporary access granted'); setTempStart(''); setTempEnd(''); fetchSettings(); } catch (err: any) { toast.error(err.message); } };
  const handleRemoveTempAccess = (id: string) => setDeleteTempTarget(id);
  const handleAddInspector = async (e: any) => { e.preventDefault(); const staff = staffList.find(s => s.id === inspectorStaffId); if (!staff) { toast.error("Select a staff member"); return; } try { await apiFetch('/lights-inspectors', { method: 'POST', body: JSON.stringify({ staffId: staff.id, staffName: staff.name, staffSN: staff.sn }) }); toast.success('Inspector added'); setInspectorStaffId(''); fetchSettings(); } catch (err: any) { toast.error(err.message); } };
  const handleRemoveInspector = (staffId: string) => setDeleteInspectorTarget(staffId);
  const handleSendReset = (email: string) => setResetPwTarget(email);
  const handleRemoveUser = (userId: string, email: string) => setDeleteUserTarget({ id: userId, email });

  const toggleIncharge = async (staffId: string, currentVal: boolean) => {
    try {
      const staffRec = staffList.find(s => s.id === staffId);
      const updated = { ...staffRec, isIncharge: !currentVal };
      await apiFetch(`/staff/${staffId}`, { method: 'PUT', body: JSON.stringify(updated) });
      toast.success(`Incharge status updated for ${staffRec.name}`);
      fetchSettings();
    } catch (err: any) { toast.error(err.message); }
  };

  const toggleSpecialAccess = async (staffId: string, currentVal: boolean) => {
    try {
      const staffRec = staffList.find(s => s.id === staffId);
      const updated = { ...staffRec, specialOpsAccess: !currentVal };
      await apiFetch(`/staff/${staffId}`, { method: 'PUT', body: JSON.stringify(updated) });
      toast.success(`Special Ops Access updated for ${staffRec.name}`);
      fetchSettings();
    } catch (err: any) { toast.error(err.message); }
  };

  let allMergedUsers: any[] = STAFF_CREDENTIALS.map(c => ({ email: c.email, name: c.name, password: c.password, role: 'staff', department: '—', status: 'Default', id: null, position: '—' }));
  activeUsers.forEach(a => { const idx = allMergedUsers.findIndex(u => u.email.toLowerCase() === (a.email || '').toLowerCase()); if (idx >= 0) { allMergedUsers[idx] = { ...allMergedUsers[idx], role: a.role || 'staff', department: a.department || '—', status: 'Active', id: a.id, position: a.position || '—' }; } else { allMergedUsers.push({ email: a.email || '', name: a.name || (a.email || '').split('@')[0], password: '—', role: a.role || 'staff', department: a.department || '—', status: 'Active', id: a.id, position: a.position || '—' }); } });
  const filteredUsers = allMergedUsers.filter((u: any) => (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())).sort((a: any, b: any) => (a.email || '').localeCompare(b.email || ''));

  return (
    <div className="page-content" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div className="staff-header" style={{ justifyContent: 'center', marginBottom: '20px' }}><h2 style={{ fontSize: '24px' }}>⚙️ Settings</h2></div>

      <div className="ops-tabs" style={{ justifyContent: 'center', marginBottom: '24px', margin: '0 auto 24px auto' }}>
        <button className={`ops-tab-btn ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')}>👤 General</button>
        {canManageAccess && <button className={`ops-tab-btn ${activeTab === 'rules' ? 'active' : ''}`} onClick={() => setActiveTab('rules')}>⚙️ Rules & Users</button>}
        {canManageAccess && <button className={`ops-tab-btn ${activeTab === 'incharges' ? 'active' : ''}`} onClick={() => setActiveTab('incharges')}>👑 Incharges & Access</button>}
        {isDev && <button className={`ops-tab-btn ${activeTab === 'detailed' ? 'active' : ''}`} onClick={() => setActiveTab('detailed')}>📋 Access Details</button>}
        {isDev && <button className={`ops-tab-btn ${activeTab === 'console' ? 'active' : ''}`} onClick={() => setActiveTab('console')}>💻 Console</button>}
      </div>

      {activeTab === 'general' && (
        <>
          <div className="dash-card mb-4 border-l-4 border-slate-500" style={{ textAlign: 'center', padding: '30px' }}>
            <h3 style={{ marginBottom: '16px' }}>👤 Account Information</h3>
            <p style={{ margin: '0 0 8px', color: '#475569', fontSize: '16px' }}>Logged in as: <strong style={{ color: '#0f172a', fontSize: '18px' }}>{profile?.email}</strong></p>
            <p style={{ margin: '0 0 20px', color: '#475569', fontSize: '14px' }}>Role: <span style={{ textTransform: 'uppercase', fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '4px 10px', borderRadius: '12px' }}>{profile?.role}</span></p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="change-pw-btn" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => setShowPasswordModal(true)}>🔐 Change Password</button>
              <button className="logout-btn" style={{ width: 'auto', padding: '10px 20px' }} onClick={logout}>Log Out</button>
            </div>
          </div>
        </>
      )}

      {activeTab === 'incharges' && canManageAccess && (
        <div className="dash-card border-l-4 border-purple-500">
          <h3>👑 Department Incharges & Access</h3>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Assign Incharges for departments and grant special access to specific staff members.</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 16px', color: '#1e293b' }}>Assign SMT Incharge</h4>
              {DEPARTMENTS.map(dept => {
                const smts = staffList.filter(s => s.department === dept && s.isSMT);
                if (smts.length === 0) return null;
                return (
                  <div key={dept} style={{ marginBottom: '16px', borderBottom: '1px dashed #cbd5e1', paddingBottom: '12px' }}>
                    <strong style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>{dept}</strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {smts.map(smt => (
                        <label key={smt.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={smt.isIncharge === true} onChange={() => toggleIncharge(smt.id, smt.isIncharge === true)} style={{ width: '16px', height: '16px' }} />
                          {smt.name} ({smt.position})
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 16px', color: '#1e293b' }}>Special Operations Access (Staff)</h4>
              <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>Grant ground operation staff access to view and edit Ops Boards without being SMT.</p>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {staffList.filter(s => !s.isSMT).map(s => (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', padding: '4px 0' }}>
                    <input type="checkbox" checked={s.specialOpsAccess === true} onChange={() => toggleSpecialAccess(s.id, s.specialOpsAccess === true)} style={{ width: '16px', height: '16px' }} />
                    {s.name} <span style={{ color: '#94a3b8', fontSize: '11px' }}>({s.department})</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'rules' && canManageAccess && (
        <div className="dash-card border-l-4 border-blue-500">
          {/* ... (Keep your Overtime, Temp Access, and Lights Inspectors forms here) ... */}
          <h3>⚙️ System Rules & Access Control</h3>
        </div>
      )}

      {activeTab === 'detailed' && isDev && (<div className="dash-card border-l-4 border-purple-500"><h3>📋 Detailed Access Sheet</h3></div>)}
      {activeTab === 'console' && isDev && (<div className="dash-card border-l-4 border-slate-800" style={{ background: '#0f172a', color: '#e2e8f0', fontFamily: 'monospace' }}><h3 style={{ color: '#38bdf8' }}>💻 System Console</h3></div>)}

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
      
      {/* Keep your ConfirmDialogs here */}
    </div>
  );
}

export default SettingsPage;