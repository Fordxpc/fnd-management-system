import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import ChangePasswordModal from './ChangePasswordModal';

const ALL_LEAVES = [
  'ANNUAL LEAVE', 'SICK LEAVE', 'SICK LEAVE / MC', 'NO PAY LEAVE', 'DUTY TRAVEL',
  'PATERNITY LEAVE', 'MATERNITY LEAVE', 'PRE-MATERNITY LEAVE', 'FAMILY RESPONSIBILITY LEAVE (FRL)',
];

function SettingsPage() {
  const { profile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'rules'>('general');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  const isDev = profile?.role === 'developer';
  const isManager = profile?.role === 'manager';
  const isManagement = isDev || isManager || ['owner', 'admin', 'smt'].includes(profile?.role || '');

  const [otRules, setOtRules] = useState({ adminHours: 40, regularHours: 48, deductLeaves: ['SICK LEAVE', 'SICK LEAVE / MC'] });
  const [savingRules, setSavingRules] = useState(false);
  
  const [counts, setCounts] = useState({ staff: 0, rosterEntries: 0, leaveRequests: 0, users: 0 });
  const [resetEmail, setResetEmail] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const snap = await getDoc(doc(db, 'settings', 'ot_rules'));
      if (snap.exists()) setOtRules(snap.data() as any);
    };
    loadSettings();

    const unsubs = [
      onSnapshot(collection(db, 'staff'), (s) => setCounts(c => ({ ...c, staff: s.size }))),
      onSnapshot(collection(db, 'roster_entries'), (s) => setCounts(c => ({ ...c, rosterEntries: s.size }))),
      onSnapshot(collection(db, 'leave_requests'), (s) => setCounts(c => ({ ...c, leaveRequests: s.size }))),
      onSnapshot(collection(db, 'users'), (s) => setCounts(c => ({ ...c, users: s.size }))),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  const saveRules = async (e: any) => {
    e.preventDefault();
    setSavingRules(true);
    try {
      await setDoc(doc(db, 'settings', 'ot_rules'), otRules);
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

  const handleSendReset = async (e: any) => {
    e.preventDefault();
    if (!resetEmail) return;
    setResetting(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      toast.success(`Password reset email sent to ${resetEmail}`);
      setResetEmail('');
    } catch (err: any) {
      toast.error(err.code === 'auth/user-not-found' ? 'No user found with this email.' : err.message);
    }
    setResetting(false);
  };

  return (
    <div className="page-content" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="staff-header" style={{ justifyContent: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '24px' }}>⚙️ Settings</h2>
      </div>

      {/* TABS */}
      <div className="ops-tabs" style={{ justifyContent: 'center', marginBottom: '24px' }}>
        <button className={`ops-tab-btn ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')}>👤 General & Account</button>
        {(isDev || isManager) && (
          <button className={`ops-tab-btn ${activeTab === 'rules' ? 'active' : ''}`} onClick={() => setActiveTab('rules')}>⚙️ System Rules & Access</button>
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

          <div className="dash-card mb-4">
            <h3>📋 Leave Entitlements</h3>
            <table className="mini-table">
              <thead><tr><th>Leave Type</th><th>Entitlement</th><th>Fridays Counted?</th><th>Gender</th></tr></thead>
              <tbody>
                <tr><td>Annual Leave</td><td>30 days</td><td>❌ No</td><td>All</td></tr>
                <tr><td>Sick Leave</td><td>15 days</td><td>✅ Yes</td><td>All</td></tr>
                <tr><td>Sick / MC</td><td>15 days</td><td>✅ Yes</td><td>All</td></tr>
                <tr><td>Family Responsibility</td><td>10 days</td><td>✅ Yes</td><td>All</td></tr>
                <tr><td>Maternity</td><td>180 days</td><td>✅ Yes</td><td>Female</td></tr>
                <tr><td>Paternity</td><td>30 days</td><td>✅ Yes</td><td>Male</td></tr>
              </tbody>
            </table>
          </div>
          
          {isDev && (
            <div className="dash-card border-l-4 border-red-500">
              <h3>🔐 Developer Tools</h3>
              <div className="grid grid-cols-2 gap-4 text-sm mt-2 mb-4">
                <div>Staff Records: <strong>{counts.staff}</strong></div>
                <div>Roster Entries: <strong>{counts.rosterEntries}</strong></div>
                <div>Leave Requests: <strong>{counts.leaveRequests}</strong></div>
                <div>Active Users: <strong>{counts.users}</strong></div>
              </div>
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <h4 style={{ margin: '0 0 8px', color: '#dc2626' }}>Send User Password Reset</h4>
                <form onSubmit={handleSendReset} style={{ display: 'flex', gap: '8px' }}>
                  <input type="email" placeholder="user@email.com" value={resetEmail} onChange={e => setResetEmail(e.target.value)} style={{ flex: 1, padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }} required />
                  <button type="submit" disabled={resetting} className="quick-btn" style={{ background: '#dc2626', color: 'white' }}>Send Reset</button>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'rules' && (isDev || isManager) && (
        <div className="dash-card border-l-4 border-blue-500">
          <h3>⚙️ System Rules & Access Control</h3>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>These rules govern how OT is calculated and who can edit what.</p>
          
          <form onSubmit={saveRules} style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 16px', color: '#1e293b' }}>Overtime Thresholds</h4>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>Regular Staff Weekly Hours</label>
                <input type="number" value={otRules.regularHours} onChange={e => setOtRules({...otRules, regularHours: Number(e.target.value)})} style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', width: '120px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>Admin Staff Weekly Hours</label>
                <input type="number" value={otRules.adminHours} onChange={e => setOtRules({...otRules, adminHours: Number(e.target.value)})} style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', width: '120px' }} />
              </div>
            </div>

            <h4 style={{ margin: '0 0 8px', color: '#1e293b' }}>Deduction Leaves</h4>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>If a staff member takes these leaves during the week, deduct 8 hours from their target.</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
              {ALL_LEAVES.map(l => (
                <label key={l} style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', background: otRules.deductLeaves.includes(l) ? '#dbeafe' : '#fff', padding: '6px 12px', borderRadius: '20px', border: '1px solid #cbd5e1', cursor: 'pointer' }}>
                  <input type="checkbox" checked={otRules.deductLeaves.includes(l)} onChange={() => toggleDeductLeave(l)} />
                  {l}
                </label>
              ))}
            </div>
            <button type="submit" disabled={savingRules} className="quick-btn" style={{ background: '#2563eb', color: 'white' }}>{savingRules ? 'Saving...' : 'Save Rules'}</button>
          </form>

          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '20px', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 12px', color: '#92400e' }}>📋 Role Access Matrix</h4>
            <table className="mini-table" style={{ background: 'transparent' }}>
              <thead><tr><th>Feature</th><th>Developer / Manager</th><th>Operations / Safety SMT</th><th>Other SMT</th><th>Normal Staff</th></tr></thead>
              <tbody>
                <tr><td>Dashboard</td><td>View</td><td>View</td><td>View</td><td>View</td></tr>
                <tr><td>Flight Schedule</td><td>Edit</td><td>Edit</td><td>Edit</td><td>View</td></tr>
                <tr><td>Ops Board / FOD</td><td>Edit</td><td>Edit</td><td>View</td><td>View (Own Dept Only)</td></tr>
                <tr><td>Ramp Check Sheet</td><td>Edit</td><td>Edit</td><td>View</td><td>Hidden</td></tr>
                <tr><td>Roster</td><td>Edit All</td><td>Edit Own Dept</td><td>Edit Own Dept</td><td>View Own Dept</td></tr>
                <tr><td>Staff List</td><td>Edit</td><td>View</td><td>View</td><td>Hidden</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </div>
  );
}

export default SettingsPage;