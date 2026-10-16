import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth';

const DEPARTMENTS = ['Ground Operations', 'Maintenance', 'Security', 'Fire & Rescue', 'Administration'];
const MANAGEMENT_ROLES = ['developer', 'manager', 'owner', 'admin', 'smt'];

const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDisplay = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

interface Props {
  onNavigate?: (page: string) => void;
}

function DashboardPage({ onNavigate }: Props) {
  const { profile, user } = useAuth();
  const [staff, setStaff] = useState<any[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  const [leaveReqs, setLeaveReqs] = useState<any[]>([]);
  const [otEntries, setOtEntries] = useState<any[]>([]);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'staff'), (snap) =>
      setStaff(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const u2 = onSnapshot(collection(db, 'roster_entries'), (snap) =>
      setRoster(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const u3 = onSnapshot(collection(db, 'leave_requests'), (snap) =>
      setLeaveReqs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const u4 = onSnapshot(collection(db, 'overtime_entries'), (snap) =>
      setOtEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, []);

  const isManager = MANAGEMENT_ROLES.includes(profile?.role || '');
  const todayStr = formatDate(new Date());
  const thisMonth = todayStr.slice(0, 7);
  const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    new Date().getDay()
  ];

  const myStaff = staff.find(
    (s) => (s.email || '').toLowerCase() === (user?.email || '').toLowerCase()
  );

  // ===== Stats =====
  const activeStaff = staff.filter((s) => s.status !== 'inactive');
  const todayShifts = roster.filter((r) => r.date === todayStr && r.status === 'scheduled');
  const todayOff = roster.filter((r) => r.date === todayStr && r.status === 'OFF DAY');
  const todayLeave = roster.filter(
    (r) => r.date === todayStr && r.status && r.status !== 'scheduled' && r.status !== 'OFF DAY'
  );
  const pendingLeave = leaveReqs.filter((r) => r.status === 'pending');
  const thisMonthOT = otEntries.filter((e) => (e.date || '').startsWith(thisMonth));
  const monthOTHours = thisMonthOT.reduce((s, e) => s + (e.hours || 0), 0);

  // Department breakdown
  const deptCounts: { [k: string]: number } = {};
  DEPARTMENTS.forEach((d) => {
    deptCounts[d] = activeStaff.filter((s) => s.department === d).length;
  });

  // Today's roster grouped by shift
  const todayByShift: { [k: string]: any[] } = {};
  todayShifts.forEach((r) => {
    const key = r.shiftTime || 'Other';
    if (!todayByShift[key]) todayByShift[key] = [];
    todayByShift[key].push(r);
  });

  // My upcoming shifts (next 7 days) if user is staff
  const myUpcoming = myStaff
    ? roster
        .filter(
          (r) =>
            r.staffId === myStaff.id &&
            r.date >= todayStr &&
            r.date <= formatDate(new Date(Date.now() + 7 * 86400000))
        )
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    : [];

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="page-content">
      {/* Welcome banner */}
      <div className="dash-welcome">
        <div>
          <h2 style={{ margin: 0, color: '#1e293b' }}>
            {greeting}, {myStaff?.name || user?.email?.split('@')[0]}
          </h2>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '13px' }}>
            {todayName}, {formatDisplay(todayStr)} ·{' '}
            <strong>{String(profile?.role || 'staff').toUpperCase()}</strong>
            {profile?.department ? ` · ${profile.department}` : ''}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="dash-stats">
        <div className="stat-card" onClick={() => onNavigate && onNavigate('staff')}>
          <div className="stat-icon" style={{ background: '#dbeafe', color: '#1e40af' }}>👥</div>
          <div>
            <div className="stat-value">{activeStaff.length}</div>
            <div className="stat-label">Active Staff</div>
          </div>
        </div>
        <div className="stat-card" onClick={() => onNavigate && onNavigate('roster')}>
          <div className="stat-icon" style={{ background: '#dcfce7', color: '#065f46' }}>📅</div>
          <div>
            <div className="stat-value">{todayShifts.length}</div>
            <div className="stat-label">On Duty Today</div>
          </div>
        </div>
        <div className="stat-card" onClick={() => onNavigate && onNavigate('leave')}>
          <div className="stat-icon" style={{ background: '#fef3c7', color: '#92400e' }}>🌴</div>
          <div>
            <div className="stat-value">{pendingLeave.length}</div>
            <div className="stat-label">Pending Leave</div>
          </div>
        </div>
        <div className="stat-card" onClick={() => onNavigate && onNavigate('overtime')}>
          <div className="stat-icon" style={{ background: '#e9d5ff', color: '#6b21a8' }}>⏰</div>
          <div>
            <div className="stat-value">{monthOTHours.toFixed(1)}</div>
            <div className="stat-label">OT Hours ({thisMonth})</div>
          </div>
        </div>
      </div>

      <div className="dash-grid">
        {/* Department breakdown */}
        <div className="dash-card">
          <h3>🏢 Staff by Department</h3>
          <div className="dept-breakdown">
            {DEPARTMENTS.map((d) => {
              const count = deptCounts[d] || 0;
              const max = Math.max(...Object.values(deptCounts), 1);
              const pct = (count / max) * 100;
              return (
                <div key={d} className="dept-row">
                  <div className="dept-label">{d}</div>
                  <div className="dept-bar-track">
                    <div className="dept-bar-fill" style={{ width: `${pct}%` }}></div>
                  </div>
                  <div className="dept-count">{count}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Today's duty */}
        <div className="dash-card">
          <h3>
            📅 Today&apos;s Duty — {todayName}
          </h3>
          {todayShifts.length === 0 && todayOff.length === 0 && todayLeave.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px' }}>
              <p>No roster entries for today.</p>
            </div>
          ) : (
            <>
              {Object.keys(todayByShift).length > 0 && (
                <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                  {Object.entries(todayByShift).map(([shift, entries]) => (
                    <div key={shift} style={{ marginBottom: '10px' }}>
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#475569',
                          padding: '4px 0',
                          borderBottom: '1px solid #e2e8f0',
                        }}
                      >
                        {shift} · {entries.length} staff
                      </div>
                      <div style={{ fontSize: '12px', color: '#1e293b', padding: '6px 0' }}>
                        {entries.map((e) => e.staffName).join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {todayLeave.length > 0 && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#991b1b' }}>
                    On Leave ({todayLeave.length})
                  </div>
                  <div style={{ fontSize: '12px', color: '#1e293b', padding: '4px 0' }}>
                    {todayLeave.map((e) => `${e.staffName} (${e.status})`).join(', ')}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Manager quick actions */}
      {isManager && (
        <div className="dash-card" style={{ marginTop: '16px' }}>
          <h3>⚡ Quick Actions</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="quick-btn" onClick={() => onNavigate && onNavigate('roster')}>
              📅 Manage Roster
            </button>
            <button className="quick-btn" onClick={() => onNavigate && onNavigate('leave')}>
              🌴 Review Leave
            </button>
            <button className="quick-btn" onClick={() => onNavigate && onNavigate('staff')}>
              👥 Manage Staff
            </button>
            <button className="quick-btn" onClick={() => onNavigate && onNavigate('overtime')}>
              ⏰ Overtime Sheet
            </button>
            <button className="quick-btn" onClick={() => onNavigate && onNavigate('holidays')}>
              🎉 Holidays
            </button>
          </div>
        </div>
      )}

      {/* My upcoming shifts (staff view) */}
      {!isManager && myUpcoming.length > 0 && (
        <div className="dash-card" style={{ marginTop: '16px' }}>
          <h3>🗓️ My Upcoming Shifts (next 7 days)</h3>
          <table className="mini-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th>Shift</th>
              </tr>
            </thead>
            <tbody>
              {myUpcoming.map((r) => (
                <tr key={r.id}>
                  <td>{formatDisplay(r.date)}</td>
                  <td>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
                      new Date(r.date + 'T00:00:00').getDay()
                    ]}
                  </td>
                  <td>
                    {r.status === 'scheduled' ? r.shiftTime : r.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;