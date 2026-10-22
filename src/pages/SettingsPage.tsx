import { useState, useEffect } from 'react';
import { db, auth } from '../firebase'; // Imported auth
import { sendPasswordResetEmail } from 'firebase/auth'; // Imported reset function
import { doc, getDoc, setDoc, collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import ChangePasswordModal from './ChangePasswordModal';

function SettingsPage() {
  const { profile, logout } = useAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const isDeveloper = profile?.role === 'developer';
  const isManagement = ['developer', 'manager', 'owner', 'admin', 'smt'].includes(profile?.role || '');

  const [otRates, setOtRates] = useState({ weekday: 1.25, friday: 1.5, holiday: 1.5 });
  const [savingRates, setSavingRates] = useState(false);
  const [counts, setCounts] = useState({ staff: 0, rosterEntries: 0, leaveRequests: 0, users: 0 });

  // Password reset state
  const [resetEmail, setResetEmail] = useState('');
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const snap = await getDoc(doc(db, 'settings', 'ot_rates'));
      if (snap.exists()) setOtRates(snap.data() as any);
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

  const saveOtRates = async (e: any) => {
    e.preventDefault();
    setSavingRates(true);
    try {
      await setDoc(doc(db, 'settings', 'ot_rates'), otRates);
      toast.success('Overtime rates updated!');
    } catch (err: any) { toast.error('Error: ' + err.message); }
    setSavingRates(false);
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
      if (err.code === 'auth/user-not-found') {
        toast.error('No user found with this email address.');
      } else {
        toast.error(err.message);
      }
    }
    setResetting(false);
  };

  return (
    <div className="page-content" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="staff-header" style={{ justifyContent: 'center', marginBottom: '30px' }}>
        <h2 style={{ fontSize: '24px' }}>⚙️ Settings</h2>
      </div>

      {/* ACCOUNT INFO - CENTERED */}
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

      {/* OT RATES BOX */}
      {isDeveloper && (
        <div className="dash-card mb-4 border-l-4 border-blue-500" style={{ padding: '24px' }}>
          <h3>⚙️ Overtime Rates (Developer Only)</h3>
          <form onSubmit={saveOtRates} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap', marginTop: '16px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '6px' }}>Weekday Rate</label>
              <input type="number" step="0.01" value={otRates.weekday} onChange={(e) => setOtRates({ ...otRates, weekday: Number(e.target.value) })} style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', width: '100px', fontFamily: 'inherit' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '6px' }}>Friday Rate</label>
              <input type="number" step="0.01" value={otRates.friday} onChange={(e) => setOtRates({ ...otRates, friday: Number(e.target.value) })} style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', width: '100px', fontFamily: 'inherit' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '6px' }}>Holiday Rate</label>
              <input type="number" step="0.01" value={otRates.holiday} onChange={(e) => setOtRates({ ...otRates, holiday: Number(e.target.value) })} style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', width: '100px', fontFamily: 'inherit' }} />
            </div>
            <button type="submit" disabled={savingRates} className="quick-btn" style={{ background: '#2563eb', color: 'white', padding: '10px 20px' }}>
              {savingRates ? 'Saving...' : 'Save Rates'}
            </button>
          </form>
        </div>
      )}

      {isManagement && (
        <div className="dash-card mb-4">
          <h3>🕒 Standard Shift Schedules</h3>
          <table className="mini-table">
            <thead><tr><th>Role</th><th>Shift Time</th><th>Days</th><th>Notes</th></tr></thead>
            <tbody>
              <tr><td><strong>Manager / Admin Officer</strong></td><td>08:00 - 16:00</td><td>Sun - Thu</td><td>Calendar holidays (Fri/Sat) are off.</td></tr>
              <tr><td><strong>Safety Officer</strong></td><td>08:00 - 16:00</td><td>Tue - Sun</td><td>Monday OFF. May change due to flight ops.</td></tr>
              <tr><td><strong>Ground Ops / Security</strong></td><td>06:00 - 14:00 / 08:00 - 16:00</td><td>Rotating</td><td>Refer to Duty Roster.</td></tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="dash-card mb-4">
        <h3>📋 Leave Entitlements</h3>
        <table className="mini-table">
          <thead><tr><th>Leave Type</th><th>Entitlement</th><th>Fridays Counted?</th><th>Gender</th></tr></thead>
          <tbody>
            <tr><td>Annual Leave</td><td>30 days</td><td>❌ No (shown on roster, not deducted)</td><td>All</td></tr>
            <tr><td>Sick Leave</td><td>15 days</td><td>✅ Yes</td><td>All</td></tr>
            <tr><td>Sick / MC</td><td>15 days</td><td>✅ Yes</td><td>All</td></tr>
            <tr><td>Family Responsibility</td><td>10 days</td><td>✅ Yes</td><td>All</td></tr>
            <tr><td>Pre-Maternity</td><td>15 days</td><td>✅ Yes (Friday & off days)</td><td>Female</td></tr>
            <tr><td>Maternity</td><td>180 days (6 mo)</td><td>✅ Yes (Friday & off days)</td><td>Female</td></tr>
            <tr><td>Paternity</td><td>30 days (1 mo)</td><td>✅ Yes (Friday & off days)</td><td>Male</td></tr>
            <tr><td>No Pay</td><td>365 days</td><td>✅ Yes (Friday & off days)</td><td>All</td></tr>
            <tr><td>Duty Travel</td><td>No limit</td><td>✅ Yes</td><td>All</td></tr>
          </tbody>
        </table>
      </div>

      {isDeveloper && (
        <div className="dash-card border-l-4 border-red-500">
          <h3>🔐 Developer Tools</h3>
          <div className="grid grid-cols-2 gap-4 text-sm mt-2 mb-4">
            <div>Staff Records: <strong>{counts.staff}</strong></div>
            <div>Roster Entries: <strong>{counts.rosterEntries}</strong></div>
            <div>Leave Requests: <strong>{counts.leaveRequests}</strong></div>
            <div>Active Users: <strong>{counts.users}</strong></div>
          </div>
          
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: '16px' }}>
            <h4 style={{ margin: '0 0 8px', color: '#dc2626' }}>Send User Password Reset</h4>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
              Send a reset link to a user's email address (uses Firebase Auth).
            </p>
            <form onSubmit={handleSendReset} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input 
                type="email" 
                placeholder="user@funadhooairport.com" 
                value={resetEmail} 
                onChange={e => setResetEmail(e.target.value)} 
                style={{ flex: 1, padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontFamily: 'inherit', minWidth: '200px' }}
                required
              />
              <button type="submit" disabled={resetting} className="quick-btn" style={{ background: '#dc2626', color: 'white', padding: '10px 20px' }}>
                {resetting ? 'Sending...' : 'Send Reset'}
              </button>
            </form>
          </div>

          <div style={{ marginTop: '24px' }}>
            <a href="https://console.firebase.google.com/project/fnd-ops-management/firestore" target="_blank" rel="noreferrer" className="quick-btn inline-block text-decoration-none">🔗 Open Firebase Console</a>
          </div>
        </div>
      )}

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </div>
  );
}

export default SettingsPage;