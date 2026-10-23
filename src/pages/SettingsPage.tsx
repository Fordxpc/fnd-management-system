import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import ChangePasswordModal from './ChangePasswordModal';

const ALL_LEAVES = ['ANNUAL LEAVE', 'SICK LEAVE', 'SICK LEAVE / MC', 'NO PAY LEAVE', 'DUTY TRAVEL', 'PATERNITY LEAVE', 'MATERNITY LEAVE', 'PRE-MATERNITY LEAVE', 'FAMILY RESPONSIBILITY LEAVE (FRL)'];

function SettingsPage() {
  const { profile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'general' | 'rules'>('general');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  const isDev = profile?.role === 'developer';
  const isManager = profile?.role === 'manager';
  const isManagement = isDev || isManager || ['owner', 'admin', 'smt'].includes(profile?.role || '');

  const [otRules, setOtRules] = useState({ adminHours: 40, regularHours: 48, deductLeaves: ['SICK LEAVE', 'SICK LEAVE / MC'] });
  const [savingRules, setSavingRules] = useState(false);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [resetting, setResetting] = useState<string | null>(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    const loadSettings = async () => {
      const snap = await getDoc(doc(db, 'settings', 'ot_rules'));
      if (snap.exists()) setOtRules(snap.data() as any);
    };
    loadSettings();

    const unsub = onSnapshot(collection(db, 'users'), (s) => {
      setUsersList(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
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

  return (
    <div className="page-content" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="staff-header" style={{ justifyContent: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '24px' }}>⚙️ Settings</h2>
      </div>

      <div className="ops-tabs" style={{ justifyContent: 'center', marginBottom: '24px', margin: '0 auto 24px auto' }}>
        <button className={`ops-tab-btn ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')}>👤 General & Account</button>
        {(isDev || isManager) && (
          <button className={`ops-tab-btn ${activeTab === 'rules' ? 'active' : ''}`} onClick={() => setActiveTab('rules')}>⚙️ System Rules & Users</button>
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

      {activeTab === 'rules' && (isDev || isManager) && (
        <div className="dash-card border-l-4 border-blue-500">
          <h3>⚙️ System Rules & Access Control</h3>
          
          <form onSubmit={saveRules} style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '24px', marginTop: '16px' }}>
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

          {/* ALL USERS LOGIN DETAILS */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '20px', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 12px', color: '#1e293b' }}>👥 All User Logins ({usersList.length})</h4>
            <div style={{ overflowX: 'auto' }}>
              <table className="mini-table">
                <thead><tr><th>Email</th><th>Role</th><th>Dept</th><th>Actions</th></tr></thead>
                <tbody>
                  {usersList.map(u => (
                    <tr key={u.id}>
                      <td><strong>{u.email}</strong></td>
                      <td><span style={{ textTransform: 'uppercase', fontWeight: 700, fontSize: '11px', background: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>{u.role}</span></td>
                      <td>{u.department || '—'}</td>
                      <td>
                        <button 
                          className="reset-pw-btn" 
                          disabled={resetting === u.email}
                          onClick={() => handleSendReset(u.email)}
                          style={{ padding: '4px 10px', fontSize: '11px' }}
                        >
                          {resetting === u.email ? 'Sending...' : '📧 Reset PW'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </div>
  );
}

export default SettingsPage;