import { useState, useEffect, useCallback } from 'react';
import { auth } from '../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import ChangePasswordModal from './ChangePasswordModal';

const ALL_LEAVES = ['ANNUAL LEAVE', 'SICK LEAVE', 'SICK LEAVE / MC', 'NO PAY LEAVE', 'DUTY TRAVEL', 'PATERNITY LEAVE', 'MATERNITY LEAVE', 'PRE-MATERNITY LEAVE', 'FAMILY RESPONSIBILITY LEAVE (FRL)'];
const DEPARTMENTS = ['Ground Operations', 'Maintenance', 'Security', 'Fire & Rescue', 'Administration', 'Safety'];

const STAFF_CREDENTIALS = [
  { email: 'sn-0034@funadhooairport.com', password: 'Fnd@2026', name: 'Abdulla Adam' },
  { email: 'sn-0035@funadhooairport.com', password: 'Fnd@2026', name: 'Abdulla Aslam' },
  { email: 'sn-0036@funadhooairport.com', password: 'Fnd@2026', name: 'Abdulla Mohamed' },
  { email: 'sn-0037@funadhooairport.com', password: 'Fnd@2026', name: 'Adam Faisal' },
  { email: 'sn-0038@funadhooairport.com', password: 'Fnd@2026', name: 'Adam Shakir' },
  { email: 'sn-0039@funadhooairport.com', password: 'Fnd@2026', name: 'Adam Yaeesh' },
  { email: 'sn-0040@funadhooairport.com', password: 'Fnd@2026', name: 'Ahmed Raushaan' },
  { email: 'sn-0041@funadhooairport.com', password: 'Fnd@2026', name: 'Ali Navshad' },
  { email: 'sn-0042@funadhooairport.com', password: 'Fnd@2026', name: 'Aiminath Moosa' },
  { email: 'sn-0044@funadhooairport.com', password: 'Fnd@2026', name: 'Hassan Abdul Rahman' },
  { email: 'sn-0047@funadhooairport.com', password: 'Fnd@2026', name: 'Ismail Nifaaz Adam' },
  { email: 'sn-0048@funadhooairport.com', password: 'Fnd@2026', name: 'Maazin Hassan' },
  { email: 'sn-0049@funadhooairport.com', password: 'Fnd@2026', name: 'Mohamed Zaki' },
  { email: 'sn-0434@funadhooairport.com', password: 'Fnd@2026', name: 'Ismail Shafeeq' },
  { email: 'sn-0435@funadhooairport.com', password: 'Fnd@2026', name: 'Ahmed Naahee' },
  { email: 'sn-0437@funadhooairport.com', password: 'Fnd@2026', name: 'Aminath Shehereeza' },
  { email: 'sn-0439@funadhooairport.com', password: 'Fnd@2026', name: 'Hassan Shujaau' },
  { email: 'sn-0480@funadhooairport.com', password: 'Fnd@2026', name: 'Mohamed Ibrahim' },
  { email: 'sn-0481@funadhooairport.com', password: 'Fnd@2026', name: 'Zimla Ayyoob' },
  { email: 'sn-0484@funadhooairport.com', password: 'Fnd@2026', name: 'Abdul Ghanee Mohamed' },
  { email: 'sn-0725@funadhooairport.com', password: 'Fnd@2026', name: 'Ahmed Aseel' },
  { email: 'sn-0726@funadhooairport.com', password: 'Fnd@2026', name: 'Mohamed Karam' },
  { email: 'sn-0727@funadhooairport.com', password: 'Fnd@2026', name: 'Ahmed Jinah' },
  { email: 'sn-0728@funadhooairport.com', password: 'Fnd@2026', name: 'Ibrahim Khalaf Ahmed' },
  { email: 'sn-0729@funadhooairport.com', password: 'Fnd@2026', name: 'Mohamed Fuadhu' },
  { email: 'sn-0730@funadhooairport.com', password: 'Fnd@2026', name: 'Mohamed Nadheem' },
  { email: 'sn-0731@funadhooairport.com', password: 'Fnd@2026', name: 'Aishath Maiha Adam' },
  { email: 'sn-0732@funadhooairport.com', password: 'Fnd@2026', name: 'Aishath Sahana' },
  { email: 'sn-0733@funadhooairport.com', password: 'Fnd@2026', name: 'Thoriq Mohamed' },
  { email: 'sn-0753@funadhooairport.com', password: 'Fnd@2026', name: 'Mohamed Maayal' },
  { email: 'sn-0754@funadhooairport.com', password: 'Fnd@2026', name: 'Ali Shameem' },
  { email: 'sn-0757@funadhooairport.com', password: 'Fnd@2026', name: 'Mohamed Adam' },
  { email: 'sn-0959@funadhooairport.com', password: 'Fnd@2026', name: 'Vishan Mohamed' },
  { email: 'sn-0961@funadhooairport.com', password: 'Fnd@2026', name: 'Mohamed Hisham' },
  { email: 'sn-0967@funadhooairport.com', password: 'Fnd@2026', name: 'Hassan Malaz' },
  { email: 'sn-0980@funadhooairport.com', password: 'Fnd@2026', name: 'Ismail Kameel' },
  { email: 'sn-0985@funadhooairport.com', password: 'Fnd@2026', name: 'Aishath Nabaa' },
  { email: 'sn-0995@funadhooairport.com', password: 'Fnd@2026', name: 'Mohamed Vishal' },
  { email: 'sn-1007@funadhooairport.com', password: 'Fnd@2026', name: 'Muna Abdhul Qafoor' },
  { email: 'sn-1008@funadhooairport.com', password: 'Fnd@2026', name: 'Aiminath Maha' },
  { email: 'sn-1009@funadhooairport.com', password: 'Fnd@2026', name: 'Hassan Naafis' },
  { email: 'sn-1173@funadhooairport.com', password: 'Fnd@2026', name: 'Mohamed Sameeh' },
];

function SettingsPage() {
  const { profile, logout, lightsInspectors } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'rules' | 'detailed' | 'console'>('general');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  const isDev = profile?.role === 'developer';
  const isManager = profile?.role === 'manager' || profile?.role === 'admin';
  const isSMT = profile?.role === 'smt' || profile?.isSMT === true;
  const canManageAccess = isDev || isManager || isSMT;
  
  const [otRules, setOtRules] = useState({ adminHours: 40, regularHours: 48, deductLeaves: ['SICK LEAVE', 'SICK LEAVE / MC'] });
  const [savingRules, setSavingRules] = useState(false);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [resetting, setResetting] = useState<string | null>(null);

  // Temp Access State
  const [tempAccessList, setTempAccessList] = useState<any[]>([]);
  const [tempStaffId, setTempStaffId] = useState('');
  const [tempDept, setTempDept] = useState('Maintenance');
  const [tempStart, setTempStart] = useState('');
  const [tempEnd, setTempEnd] = useState('');

  // Lights Inspectors State
  const [inspectorStaffId, setInspectorStaffId] = useState('');
  const [inspectorList, setInspectorList] = useState<any[]>([]);
  
  const currentUser = auth.currentUser;

  const fetchSettings = useCallback(async () => {
    try {
      const [rulesData, usersData, tempAccessData, staffData, inspectorsData] = await Promise.all([
        apiFetch('/settings/ot_rules'),
        apiFetch('/users'),
        apiFetch('/temp-access'),
        apiFetch('/staff'),
        apiFetch('/lights-inspectors')
      ]);
      if (rulesData) setOtRules(rulesData);
      setActiveUsers(usersData);
      setTempAccessList(tempAccessData);
      setStaffList(staffData);
      setInspectorList(inspectorsData);
    } catch (err: any) {
      console.error("Failed to load settings", err);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    const interval = setInterval(fetchSettings, 15000);
    return () => clearInterval(interval);
  }, [fetchSettings]);

  const saveRules = async (e: any) => {
    e.preventDefault();
    setSavingRules(true);
    try {
      await apiFetch('/settings/ot_rules', {
        method: 'POST',
        body: JSON.stringify(otRules)
      });
      toast.success('System rules updated!');
    } catch (err: any) { toast.error('Error: ' + err.message); }
    setSavingRules(false);
  };

  const toggleDeductLeave = (l: string) => {
    setOtRules(prev => {
      const exists = prev.deductLeaves.includes(l);
      return { ...prev, deductLeaves: exists ? prev.deductLeaves.filter(x => x !== l) : [...prev.deductLeaves, l] };
    });
  };

  const handleAddTempAccess = async (e: any) => {
    e.preventDefault();
    const staff = staffList.find(s => s.id === tempStaffId);
    if (!staff || !tempStart || !tempEnd) { toast.error("Fill all fields"); return; }
    
    try {
      await apiFetch('/temp-access', { 
        method: 'POST', 
        body: JSON.stringify({ email: staff.email, targetDept: tempDept, startDate: tempStart, endDate: tempEnd }) 
      });
      toast.success('Temporary access granted');
      setTempStart(''); setTempEnd('');
      fetchSettings();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleRemoveTempAccess = async (id: string) => {
    if (!window.confirm("Remove this temporary access?")) return;
    try {
      await apiFetch(`/temp-access/${id}`, { method: 'DELETE' });
      toast.success('Access removed');
      fetchSettings();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleAddInspector = async (e: any) => {
    e.preventDefault();
    const staff = staffList.find(s => s.id === inspectorStaffId);
    if (!staff) { toast.error("Select a staff member"); return; }

    try {
      await apiFetch('/lights-inspectors', {
        method: 'POST',
        body: JSON.stringify({ staffId: staff.id, staffName: staff.name, staffSN: staff.sn })
      });
      toast.success('Inspector added');
      setInspectorStaffId('');
      fetchSettings();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleRemoveInspector = async (staffId: string) => {
    if (!window.confirm("Remove this inspector?")) return;
    try {
      await apiFetch(`/lights-inspectors/${staffId}`, { method: 'DELETE' });
      toast.success('Inspector removed');
      fetchSettings();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleSendReset = async (email: string) => {
    if (!window.confirm(`Send password reset email to ${email}?`)) return;
    setResetting(email);
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success(`Password reset email sent to ${email}`);
    } catch (err: any) {
      toast.error(err.code === 'auth/user-not-found' ? 'No user found with this email.' : err.message);
    }
    setResetting(null);
  };

  const handleRemoveUser = async (userId: string, email: string) => {
    if (!window.confirm(`Are you sure you want to remove ${email} from the database?`)) return;
    try {
      await apiFetch(`/users/${userId}`, { method: 'DELETE' });
      toast.success(`${email} removed from lists.`);
      fetchSettings();
    } catch (err: any) { toast.error('Error: ' + err.message); }
  };

  let allMergedUsers: any[] = STAFF_CREDENTIALS.map(c => ({
    email: c.email, name: c.name, password: c.password, role: 'staff', department: '—', status: 'Default', id: null
  }));

  activeUsers.forEach(a => {
    const idx = allMergedUsers.findIndex(u => u.email.toLowerCase() === (a.email || '').toLowerCase());
    if (idx >= 0) {
      allMergedUsers[idx] = { ...allMergedUsers[idx], role: a.role || 'staff', department: a.department || '—', status: 'Active', id: a.id };
    } else {
      allMergedUsers.push({ email: a.email || '', name: a.name || (a.email || '').split('@')[0], password: '—', role: a.role || 'staff', department: a.department || '—', status: 'Active', id: a.id });
    }
  });

  const filteredUsers = allMergedUsers.filter((u: any) => 
    (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  ).sort((a: any, b: any) => (a.email || '').localeCompare(b.email || ''));

  return (
    <div className="page-content" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div className="staff-header" style={{ justifyContent: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '24px' }}>⚙️ Settings</h2>
      </div>

      <div className="ops-tabs" style={{ justifyContent: 'center', marginBottom: '24px', margin: '0 auto 24px auto' }}>
        <button className={`ops-tab-btn ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')}>👤 General</button>
        {(isDev || isManager || isSMT) && (
          <button className={`ops-tab-btn ${activeTab === 'rules' ? 'active' : ''}`} onClick={() => setActiveTab('rules')}>⚙️ Rules & Users</button>
        )}
        {isDev && (
          <button className={`ops-tab-btn ${activeTab === 'detailed' ? 'active' : ''}`} onClick={() => setActiveTab('detailed')}>📋 Access Details</button>
        )}
        {isDev && (
          <button className={`ops-tab-btn ${activeTab === 'console' ? 'active' : ''}`} onClick={() => setActiveTab('console')}>💻 Console</button>
        )}
      </div>

      {activeTab === 'general' && (
        <>
          <div className="dash-card mb-4 border-l-4 border-slate-500" style={{ textAlign: 'center', padding: '30px' }}>
            <h3 style={{ marginBottom: '16px' }}>👤 Account Information</h3>
            <p style={{ margin: '0 0 8px', color: '#475569', fontSize: '16px' }}>
              Logged in as: <strong style={{ color: '#0f172a', fontSize: '18px' }}>{profile?.email}</strong>
            </p>
            <p style={{ margin: '0 0 20px', color: '#475569', fontSize: '14px' }}>
              Role: <span style={{ textTransform: 'uppercase', fontWeight: 800, color: '#2563eb', background: '#eff6ff', padding: '4px 10px', borderRadius: '12px' }}>{profile?.role}</span>
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="change-pw-btn" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => setShowPasswordModal(true)}>🔐 Change Password</button>
              <button className="logout-btn" style={{ width: 'auto', padding: '10px 20px' }} onClick={logout}>Log Out</button>
            </div>
          </div>
          
          {isDev && (
            <div className="dash-card border-l-4 border-red-500">
              <h3>🔐 Current Session Details</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', color: '#475569', marginTop: '12px' }}>
                <div><strong>Auth UID:</strong> <br/><span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{currentUser?.uid}</span></div>
                <div><strong>Email:</strong> <br/>{currentUser?.email}</div>
                <div><strong>Last Login:</strong> <br/>{currentUser?.metadata.lastSignInTime}</div>
                <div><strong>Account Created:</strong> <br/>{currentUser?.metadata.creationTime}</div>
              </div>
            </div>
          )}
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

            <h4 style={{ margin: '0 0 8px', color: '#1e293b' }}>Deduction Leaves</h4>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>If a staff member takes these leaves during the week, deduct 8 hours from their target.</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
              {ALL_LEAVES.map(l => (
                <label key={l} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', background: otRules.deductLeaves.includes(l) ? '#dbeafe' : '#fff', padding: '6px 12px', borderRadius: '20px', border: '1px solid #cbd5e1', cursor: 'pointer', color: '#1e293b' }}>
                  <input type="checkbox" checked={otRules.deductLeaves.includes(l)} onChange={() => toggleDeductLeave(l)} />
                  {l}
                </label>
              ))}
            </div>
            <button type="submit" disabled={savingRules} className="quick-btn" style={{ background: '#2563eb', color: 'white' }}>{savingRules ? 'Saving...' : 'Save Rules'}</button>
          </form>

          {/* TEMP ACCESS SECTION */}
          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 16px', color: '#1e293b' }}>🔑 Temporary Cross-Department Access</h4>
            <form onSubmit={handleAddTempAccess} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>Staff Name</label>
                <select value={tempStaffId} onChange={e => setTempStaffId(e.target.value)} required style={{ display: 'block', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#1e293b', maxWidth: '250px' }}>
                  <option value="">Search Staff...</option>
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.department})</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>Target Department</label>
                <select value={tempDept} onChange={e => setTempDept(e.target.value)} style={{ display: 'block', padding: '8px', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>Start Date</label><input type="date" value={tempStart} onChange={e => setTempStart(e.target.value)} required style={{ display: 'block', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#1e293b' }} /></div>
              <div><label style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>End Date</label><input type="date" value={tempEnd} onChange={e => setTempEnd(e.target.value)} required style={{ display: 'block', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#1e293b' }} /></div>
              <button type="submit" className="quick-btn" style={{ background: '#8b5cf6', color: 'white' }}>Grant Access</button>
            </form>
            
            {tempAccessList.length > 0 && (
              <table className="mini-table">
                <thead><tr><th>Email</th><th>Dept</th><th>Start</th><th>End</th><th>Actions</th></tr></thead>
                <tbody>
                  {tempAccessList.map(t => (
                    <tr key={t.id}>
                      <td>{t.email}</td><td>{t.targetDept}</td><td>{t.startDate}</td><td>{t.endDate}</td>
                      <td><button onClick={() => handleRemoveTempAccess(t.id)} className="delete-btn">Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* LIGHTS INSPECTORS SECTION */}
          <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 16px', color: '#1e293b' }}>🚨 RWY Lights Inspectors</h4>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>Selected staff members will have access to fill out the Runway Lights inspection sheet.</p>
            
            <form onSubmit={handleAddInspector} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>Select Staff</label>
                <select value={inspectorStaffId} onChange={e => setInspectorStaffId(e.target.value)} required style={{ display: 'block', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#1e293b', maxWidth: '250px' }}>
                  <option value="">Search Staff...</option>
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.department})</option>)}
                </select>
              </div>
              <button type="submit" className="quick-btn" style={{ background: '#dc2626', color: 'white' }}>Add Inspector</button>
            </form>

            {inspectorList.length > 0 && (
              <table className="mini-table">
                <thead><tr><th>Staff Name</th><th>SN</th><th>Actions</th></tr></thead>
                <tbody>
                  {inspectorList.map(i => (
                    <tr key={i.staffId}>
                      <td><strong>{i.staffName}</strong></td>
                      <td>{i.staffSN || '—'}</td>
                      <td><button onClick={() => handleRemoveInspector(i.staffId)} className="delete-btn">Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {isDev && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '20px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h4 style={{ margin: 0, color: '#1e293b' }}>👥 Master User List ({allMergedUsers.length})</h4>
                </div>
                <input 
                  type="text" placeholder="🔍 Search name or email..." value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', width: '250px', fontSize: '13px', color: '#1e293b' }}
                />
              </div>
              
              <div style={{ maxHeight: '500px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                <table className="mini-table" style={{ margin: 0 }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 1 }}>
                    <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Password</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>No users found matching "{searchQuery}"</td></tr>
                    ) : filteredUsers.map(u => (
                      <tr key={u.email}>
                        <td><strong>{u.name}</strong></td>
                        <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{u.email}</td>
                        <td><span style={{ textTransform: 'uppercase', fontWeight: 700, fontSize: '11px', background: u.role === 'developer' ? '#fee2e2' : u.role === 'smt' ? '#fef3c7' : '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>{u.role}</span></td>
                        <td>
                          <span style={{ 
                            fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                            background: u.status === 'Active' ? '#dcfce7' : '#f1f5f9',
                            color: u.status === 'Active' ? '#166534' : '#475569'
                          }}>
                            {u.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '12px', color: '#dc2626', fontWeight: 700 }}>
                          {u.password !== '—' ? u.password : <span style={{ color: '#94a3b8', fontStyle: 'italic', fontWeight: 400 }}>Hidden</span>}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="reset-pw-btn" disabled={resetting === u.email} onClick={() => handleSendReset(u.email)} style={{ padding: '4px 8px', fontSize: '11px', marginRight: '6px' }}>
                            {resetting === u.email ? '...' : '📧 Reset'}
                          </button>
                          {u.id && (
                            <button className="delete-btn" onClick={() => handleRemoveUser(u.id!, u.email)} style={{ padding: '4px 8px', fontSize: '11px' }}>Remove</button>
                          )}
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

      {activeTab === 'detailed' && isDev && (
        <div className="dash-card border-l-4 border-purple-500">
          <h3>📋 Detailed Access Sheet</h3>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Overview of all system permissions and field settings.</p>
          <table className="mini-table">
            <thead><tr><th>Role</th><th>Settings</th><th>Users</th><th>Roster</th><th>Leave</th><th>Reports</th><th>Ramp Check</th></tr></thead>
            <tbody>
              <tr><td><strong>Developer</strong></td><td>✅ Full</td><td>✅ Full</td><td>✅ Full</td><td>✅ Full</td><td>✅ Full</td><td>✅ Full</td></tr>
              <tr><td><strong>Manager / Admin</strong></td><td>✅ View</td><td>✅ Full</td><td>✅ Full</td><td>✅ Full</td><td>✅ Full</td><td>✅ Full</td></tr>
              <tr><td><strong>SMT</strong></td><td>❌ No</td><td>✅ View</td><td>✅ Own Dept</td><td>✅ Own Dept</td><td>✅ View</td><td>✅ View</td></tr>
              <tr><td><strong>Staff</strong></td><td>❌ No</td><td>❌ No</td><td>✅ View Own</td><td>✅ View Own</td><td>❌ No</td><td>❌ No</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'console' && isDev && (
        <div className="dash-card border-l-4 border-slate-800" style={{ background: '#0f172a', color: '#e2e8f0', fontFamily: 'monospace' }}>
          <h3 style={{ color: '#38bdf8' }}>💻 System Console</h3>
          <div style={{ maxHeight: '400px', overflowY: 'auto', fontSize: '12px' }}>
            <p><span style={{ color: '#4ade80' }}>[OK]</span> Cloudflare D1 Database Connected</p>
            <p><span style={{ color: '#4ade80' }}>[OK]</span> Auth Provider loaded</p>
            <p><span style={{ color: '#facc15' }}>[INFO]</span> Active Staff Records: {activeUsers.length}</p>
            <p><span style={{ color: '#facc15' }}>[INFO]</span> UID: {currentUser?.uid}</p>
            <p><span style={{ color: '#facc15' }}>[INFO]</span> Current Token Expiry: {currentUser?.metadata?.lastSignInTime}</p>
            <p><span style={{ color: '#38bdf8' }}>[LOG]</span> Waiting for developer input...</p>
          </div>
        </div>
      )}

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </div>
  );
}

export default SettingsPage;