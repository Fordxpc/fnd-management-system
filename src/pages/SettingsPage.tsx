import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth';

function SettingsPage() {
  const { profile, user } = useAuth();
  const isDeveloper = profile?.role === 'developer';

  const [otRates, setOtRates] = useState({ weekday: 1.25, friday: 1.5, holiday: 1.5 });
  const [savingRates, setSavingRates] = useState(false);
  const [counts, setCounts] = useState({ staff: 0, rosterEntries: 0, leaveRequests: 0, users: 0 });

  useEffect(() => {
    // Load settings
    const loadSettings = async () => {
      const snap = await getDoc(doc(db, 'settings', 'ot_rates'));
      if (snap.exists()) setOtRates(snap.data() as any);
    };
    loadSettings();

    // Load counts
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
      alert('✅ Overtime rates updated!');
    } catch (err: any) { alert('Error: ' + err.message); }
    setSavingRates(false);
  };

  return (
    <div className="page-content">
      <div className="staff-header"><h2>Settings</h2></div>

      {isDeveloper && (
        <div className="dash-card mb-4 border-l-4 border-blue-500">
          <h3>⚙️ Overtime Rates (Developer Only)</h3>
          <form onSubmit={saveOtRates} className="flex gap-4 items-end flex-wrap mt-3">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Weekday Rate</label>
              <input type="number" step="0.01" value={otRates.weekday} onChange={(e) => setOtRates({ ...otRates, weekday: Number(e.target.value) })} className="p-2 border rounded w-24" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Friday Rate</label>
              <input type="number" step="0.01" value={otRates.friday} onChange={(e) => setOtRates({ ...otRates, friday: Number(e.target.value) })} className="p-2 border rounded w-24" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">Holiday Rate</label>
              <input type="number" step="0.01" value={otRates.holiday} onChange={(e) => setOtRates({ ...otRates, holiday: Number(e.target.value) })} className="p-2 border rounded w-24" />
            </div>
            <button type="submit" disabled={savingRates} className="quick-btn bg-blue-600 text-white">{savingRates ? 'Saving...' : 'Save Rates'}</button>
          </form>
        </div>
      )}

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

      <div className="dash-card mb-4">
        <h3>📋 Leave Entitlements</h3>
        <table className="mini-table">
          <thead><tr><th>Leave Type</th><th>Entitlement</th><th>Fridays Counted?</th><th>Gender</th></tr></thead>
          <tbody>
            <tr><td>Annual Leave</td><td>30 days</td><td>❌ No</td><td>All</td></tr>
            <tr><td>Sick Leave</td><td>15 days</td><td>✅ Yes</td><td>All</td></tr>
            <tr><td>Sick / MC</td><td>15 days</td><td>✅ Yes</td><td>All</td></tr>
            <tr><td>Family Responsibility</td><td>10 days</td><td>✅ Yes</td><td>All</td></tr>
            <tr><td>Pre-Maternity</td><td>15 days</td><td>✅ Yes</td><td>Female</td></tr>
            <tr><td>Maternity</td><td>180 days (6 mo)</td><td>✅ Yes</td><td>Female</td></tr>
            <tr><td>Paternity</td><td>30 days (1 mo)</td><td>✅ Yes</td><td>Male</td></tr>
            <tr><td>No Pay</td><td>365 days</td><td>✅ Yes</td><td>All</td></tr>
            <tr><td>Duty Travel</td><td>No limit</td><td>✅ Yes</td><td>All</td></tr>
          </tbody>
        </table>
      </div>

      {isDeveloper && (
        <div className="dash-card">
          <h3>🔐 Database Stats</h3>
          <div className="grid grid-cols-2 gap-4 text-sm mt-2">
            <div>Staff Records: <strong>{counts.staff}</strong></div>
            <div>Roster Entries: <strong>{counts.rosterEntries}</strong></div>
            <div>Leave Requests: <strong>{counts.leaveRequests}</strong></div>
            <div>Active Users: <strong>{counts.users}</strong></div>
          </div>
          <a href="https://console.firebase.google.com/project/fnd-ops-management/firestore" target="_blank" rel="noreferrer" className="quick-btn inline-block mt-4 text-decoration-none">🔗 Open Firebase Console</a>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;