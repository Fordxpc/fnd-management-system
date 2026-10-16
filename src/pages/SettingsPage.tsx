import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth';

const DEVELOPER_ROLES = ['developer'];

const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

function SettingsPage() {
  const { profile, user } = useAuth();
  const isDeveloper = DEVELOPER_ROLES.includes(profile?.role || '');

  const [counts, setCounts] = useState({
    staff: 0,
    rosterEntries: 0,
    leaveRequests: 0,
    overtime: 0,
    holidays: 0,
    users: 0,
  });

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, 'staff'), (s) =>
        setCounts((c) => ({ ...c, staff: s.size }))
      ),
      onSnapshot(collection(db, 'roster_entries'), (s) =>
        setCounts((c) => ({ ...c, rosterEntries: s.size }))
      ),
      onSnapshot(collection(db, 'leave_requests'), (s) =>
        setCounts((c) => ({ ...c, leaveRequests: s.size }))
      ),
      onSnapshot(collection(db, 'overtime_entries'), (s) =>
        setCounts((c) => ({ ...c, overtime: s.size }))
      ),
      onSnapshot(collection(db, 'holidays'), (s) =>
        setCounts((c) => ({ ...c, holidays: s.size }))
      ),
      onSnapshot(collection(db, 'users'), (s) =>
        setCounts((c) => ({ ...c, users: s.size }))
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const exportAllData = async () => {
    // Simple client-side export of the current view via CSV will require Firebase SDK.
    // Instead, point the user to Firebase Console for a full backup.
    alert(
      'Full database backup is done through Firebase Console:\n\n' +
      '1. Firebase Console → Firestore Database → ⋮ menu → Export/Import\n' +
      '2. Requires enabling Google Cloud Storage (may ask for billing)\n\n' +
      'For lightweight backup: use Firebase Console → Firestore → Manual download of each collection.'
    );
  };

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>Settings</h2>
      </div>

      {/* Company Info */}
      <div className="dash-card">
        <h3>🏢 Company Information</h3>
        <table className="mini-table">
          <tbody>
            <tr>
              <td style={{ fontWeight: 600, width: '200px' }}>Company Name</td>
              <td>Funadhoo Airport (FND)</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>System</td>
              <td>Staff Duty, Leave & Overtime Management</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Roster Period</td>
              <td>16th of each month → 15th of next month</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Week Start</td>
              <td>Saturday (roster grid)</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Departments */}
      <div className="dash-card" style={{ marginTop: '16px' }}>
        <h3>🏢 Departments</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['Ground Operations', 'Maintenance', 'Security', 'Fire & Rescue', 'Administration'].map(
            (d) => (
              <span
                key={d}
                style={{
                  padding: '8px 14px',
                  background: '#eff6ff',
                  color: '#1e40af',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                {d}
              </span>
            )
          )}
        </div>
      </div>

      {/* Leave Types */}
      <div className="dash-card" style={{ marginTop: '16px' }}>
        <h3>🌴 Leave Types & Entitlements</h3>
        <table className="mini-table">
          <thead>
            <tr>
              <th>Leave Type</th>
              <th>Entitlement</th>
              <th>Fridays/Holidays</th>
              <th>Gender</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Annual Leave</td><td>30 days</td><td>Excluded (still marked)</td><td>All</td></tr>
            <tr><td>Sick Leave</td><td>15 days</td><td>Counted</td><td>All</td></tr>
            <tr><td>Sick Leave / MC</td><td>15 days</td><td>Counted</td><td>All</td></tr>
            <tr><td>Family Responsibility Leave</td><td>10 days</td><td>Counted</td><td>All</td></tr>
            <tr><td>Pre-Maternity Leave</td><td>15 days</td><td>Counted</td><td>Female</td></tr>
            <tr><td>Maternity Leave</td><td>180 days (6 months)</td><td>Counted</td><td>Female</td></tr>
            <tr><td>Paternity Leave</td><td>30 days (1 month)</td><td>Counted</td><td>Male</td></tr>
            <tr><td>No Pay Leave</td><td>365 days (up to 1 year)</td><td>Counted</td><td>All</td></tr>
          </tbody>
        </table>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '10px' }}>
          <strong>Renewal:</strong> Annual leave renews yearly on each staff member's join-date
          anniversary after 2 years of service. New hires get a one-time 30-day allocation for
          their first 2 years.
        </p>
      </div>

      {/* Overtime Rules */}
      <div className="dash-card" style={{ marginTop: '16px' }}>
        <h3>⏰ Overtime Rules</h3>
        <table className="mini-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Rate</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Weekday OT</td><td>1.25×</td></tr>
            <tr><td>Friday / Off-day OT</td><td>1.5×</td></tr>
            <tr><td>Public Holiday OT</td><td>1.5×</td></tr>
          </tbody>
        </table>
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '10px' }}>
          <strong>Weekly threshold:</strong> 48 hours must be worked before overtime is eligible.
        </p>
      </div>

      {/* Database stats (developer only) */}
      {isDeveloper && (
        <div className="dash-card" style={{ marginTop: '16px' }}>
          <h3>🔐 Developer Tools — Database Stats</h3>
          <table className="mini-table">
            <tbody>
              <tr><td style={{ fontWeight: 600 }}>Staff records</td><td>{counts.staff}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Roster entries</td><td>{counts.rosterEntries}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Leave requests</td><td>{counts.leaveRequests}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Overtime entries</td><td>{counts.overtime}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Holidays</td><td>{counts.holidays}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>Active users</td><td>{counts.users}</td></tr>
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
            <button className="quick-btn" onClick={exportAllData}>
              💾 Backup Info
            </button>
            <a
              href="https://console.firebase.google.com/project/fnd-ops-management/firestore"
              target="_blank"
              rel="noreferrer"
              className="quick-btn"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
            >
              🔗 Open Firebase Console
            </a>
          </div>
        </div>
      )}

      {/* Account info */}
      <div className="dash-card" style={{ marginTop: '16px' }}>
        <h3>👤 My Account</h3>
        <table className="mini-table">
          <tbody>
            <tr><td style={{ fontWeight: 600, width: '200px' }}>Email</td><td>{user?.email}</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Role</td><td>{profile?.role}</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Department</td><td>{profile?.department || '—'}</td></tr>
            <tr><td style={{ fontWeight: 600 }}>Session started</td><td>{formatDate(new Date())}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SettingsPage;