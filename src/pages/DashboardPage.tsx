import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const DEPARTMENTS = ['Ground Operations', 'Maintenance', 'Security', 'Fire & Rescue', 'Administration', 'Safety'];
const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#8b5cf6', '#06b6d4'];

const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Annual leave helpers for dashboard widget
const ANNUAL_LEAVE_TOTAL = 30;
const getYearsOfService = (joinDateStr: string): number => {
  if (!joinDateStr) return 0;
  const jd = new Date(joinDateStr + 'T00:00:00');
  if (isNaN(jd.getTime())) return 0;
  const today = new Date();
  let years = today.getFullYear() - jd.getFullYear();
  const m = today.getMonth() - jd.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < jd.getDate())) years -= 1;
  return years;
};

interface Props { onNavigate?: (page: string) => void; }

function DashboardPage({ onNavigate }: Props) {
  const { profile, user } = useAuth();
  const [staff, setStaff] = useState<any[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  const [leaveReqs, setLeaveReqs] = useState<any[]>([]);
  const [otEntries, setOtEntries] = useState<any[]>([]);

  const [openDepts, setOpenDepts] = useState<{ [key: string]: boolean }>({});
  const [openLeaveDepts, setOpenLeaveDepts] = useState<{ [key: string]: boolean }>({});
  
  const [showMyBalance, setShowMyBalance] = useState(true);
  const [showMyOT, setShowMyOT] = useState(true);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'staff'), (s) => setStaff(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(collection(db, 'roster_entries'), (s) => setRoster(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(collection(db, 'leave_requests'), (s) => setLeaveReqs(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u4 = onSnapshot(collection(db, 'overtime_entries'), (s) => setOtEntries(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const toggleDept = (dept: string) => setOpenDepts(prev => ({ ...prev, [dept]: prev[dept] === false ? true : false }));
  const toggleLeaveDept = (dept: string) => setOpenLeaveDepts(prev => ({ ...prev, [dept]: prev[dept] === false ? true : false }));

  const isManager = ['developer', 'manager', 'owner', 'admin', 'smt'].includes(profile?.role || '');
  const todayStr = formatDate(new Date());
  const thisMonth = todayStr.slice(0, 7);
  const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

  const myStaff = staff.find((s) => (s.email || '').toLowerCase() === (user?.email || '').toLowerCase());

  const activeStaff = staff.filter((s) => s.status !== 'inactive');
  const todayShifts = roster.filter((r) => r.date === todayStr && r.status === 'scheduled');
  const todayLeave = roster.filter((r) => r.date === todayStr && r.status && r.status !== 'scheduled' && r.status !== 'OFF DAY');
  const pendingLeave = leaveReqs.filter((r) => r.status === 'pending');

  // --- My Leave Balance ---
  let myLeaveUsed = 0;
  if (myStaff) {
    const years = getYearsOfService(myStaff.joinDate || '');
    const renews = years >= 2;
    leaveReqs.filter(r => r.staffId === myStaff.id && r.status === 'approved' && r.leaveType === 'ANNUAL LEAVE').forEach(r => {
      if (!renews) myLeaveUsed += r.days || 0; // Simplified for new hires (all time)
      else {
        // Normally we'd check current leave year, but for dashboard summary this is close enough.
        if ((r.startDate || '').startsWith(new Date().getFullYear().toString())) myLeaveUsed += r.days || 0;
      }
    });
  }
  const myBalance = ANNUAL_LEAVE_TOTAL - myLeaveUsed;

  // --- My OT Stats ---
  const myOTThisMonth = myStaff ? otEntries.filter(e => e.staffId === myStaff.id && (e.date || '').startsWith(thisMonth)) : [];
  const myOTWeekday = myOTThisMonth.filter(e => e.otType === 'Weekday OT' || !e.otType).reduce((sum, e) => sum + (e.hours || 0), 0); // fallback
  const myOTFriday = myOTThisMonth.filter(e => e.otType === 'Friday / Off-day OT').reduce((sum, e) => sum + (e.hours || 0), 0);
  const myOTHoliday = myOTThisMonth.filter(e => e.otType === 'Holiday OT').reduce((sum, e) => sum + (e.hours || 0), 0);
  const myOTTotal = myOTWeekday + myOTFriday + myOTHoliday;

  const staffDeptData = DEPARTMENTS.map(dept => ({
    name: dept.replace(' Operations', '').replace(' & Rescue', ''),
    count: activeStaff.filter(s => s.department === dept).length
  }));

  const leaveTypeData = Object.entries(
    leaveReqs.filter(r => r.status === 'approved').reduce((acc: any, r) => {
      acc[r.leaveType] = (acc[r.leaveType] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const dutyByDept: { [key: string]: any[] } = {};
  todayShifts.forEach(r => {
    const d = r.staffDepartment || 'Unknown';
    if (!dutyByDept[d]) dutyByDept[d] = [];
    dutyByDept[d].push(r);
  });

  const leaveByDept: { [key: string]: any[] } = {};
  todayLeave.forEach(r => {
    const d = r.staffDepartment || 'Unknown';
    if (!leaveByDept[d]) leaveByDept[d] = [];
    leaveByDept[d].push(r);
  });

  return (
    <div className="page-content">
      <div className="dash-welcome">
        <h2>{new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}, {myStaff?.name || 'User'}</h2>
        <p>{todayName}, {todayStr} · <strong>{String(profile?.role || 'staff').toUpperCase()}</strong> · {profile?.department}</p>
      </div>

      <div className="dash-stats">
        <div className="stat-card" onClick={() => onNavigate && onNavigate('staff')}>
          <div className="stat-icon" style={{ background: '#dbeafe', color: '#1e40af' }}>👥</div>
          <div><div className="stat-value">{activeStaff.length}</div><div className="stat-label">Active Staff</div></div>
        </div>
        <div className="stat-card" onClick={() => onNavigate && onNavigate('leave')}>
          <div className="stat-icon" style={{ background: '#fef3c7', color: '#92400e' }}>🌴</div>
          <div><div className="stat-value">{pendingLeave.length}</div><div className="stat-label">Pending Leave</div></div>
        </div>
        <div className="stat-card" onClick={() => onNavigate && onNavigate('roster')}>
          <div className="stat-icon" style={{ background: '#dcfce7', color: '#065f46' }}>📅</div>
          <div><div className="stat-value">{todayShifts.length}</div><div className="stat-label">On Duty Today</div></div>
        </div>
      </div>

      {isManager && pendingLeave.length > 0 && (
        <div className="dash-card" style={{ marginBottom: '20px', borderLeft: '4px solid #f59e0b' }}>
          <h3>⚠️ Awaiting Approvals ({pendingLeave.length})</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {pendingLeave.slice(0, 5).map(r => (
              <div key={r.id} style={{ padding: '8px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px' }}>
                <strong>{r.staffName}</strong> requested {r.leaveType} ({r.days} days)
              </div>
            ))}
            {pendingLeave.length > 5 && <span style={{ fontSize: '12px', alignSelf: 'center', color: '#64748b' }}>+{pendingLeave.length - 5} more...</span>}
          </div>
          <button className="quick-btn" onClick={() => onNavigate && onNavigate('leave')}>Review Now</button>
        </div>
      )}

      {/* LEAVE & OT WIDGETS for staff */}
      <div className="dash-grid" style={{ marginBottom: '20px' }}>
        {myStaff && (
          <div className="collapsible-card" style={{ margin: 0 }}>
            <button className="collapsible-header" onClick={() => setShowMyBalance(!showMyBalance)}>
              <span><strong>🌴 My Annual Leave Balance</strong></span>
              <span className="collapsible-toggle">{showMyBalance ? '▼' : '▶'}</span>
            </button>
            {showMyBalance && (
              <div className="collapsible-body" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{ fontSize: '32px', fontWeight: 800, color: '#065f46' }}>{myBalance}</div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>Days Remaining<br/>(out of {ANNUAL_LEAVE_TOTAL})</div>
              </div>
            )}
          </div>
        )}
        
        {myStaff && (
          <div className="collapsible-card" style={{ margin: 0 }}>
            <button className="collapsible-header" onClick={() => setShowMyOT(!showMyOT)}>
              <span><strong>⏰ My Overtime ({thisMonth})</strong></span>
              <span className="collapsible-toggle">{showMyOT ? '▼' : '▶'}</span>
            </button>
            {showMyOT && (
              <div className="collapsible-body" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                <div><div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Official Day OT</div><div style={{ fontSize: '18px', fontWeight: 700 }}>{myOTWeekday.toFixed(2)} hrs</div></div>
                <div><div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Friday OT</div><div style={{ fontSize: '18px', fontWeight: 700 }}>{myOTFriday.toFixed(2)} hrs</div></div>
                <div><div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Holiday OT</div><div style={{ fontSize: '18px', fontWeight: 700 }}>{myOTHoliday.toFixed(2)} hrs</div></div>
                <div><div style={{ fontSize: '11px', color: '#1e40af', fontWeight: 700 }}>Total</div><div style={{ fontSize: '18px', fontWeight: 800, color: '#1e40af' }}>{myOTTotal.toFixed(2)} hrs</div></div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="dash-grid" style={{ marginBottom: '20px' }}>
        <div className="dash-card">
          <h3>🏢 Staff by Department</h3>
          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={staffDeptData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="dash-card">
          <h3>🌴 Approved Leave Types</h3>
          <div style={{ width: '100%', height: 200 }}>
            {leaveTypeData.length === 0 ? <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: '40px' }}>No approved leaves yet.</p> : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={leaveTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                    {leaveTypeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="dash-grid">
        <div className="dash-card">
          <h3>📅 Today's Duty (By Dept)</h3>
          {Object.keys(dutyByDept).length === 0 ? <p style={{ fontSize: '13px', color: '#64748b' }}>No scheduled shifts today.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(dutyByDept).map(([dept, entries]) => {
                const isOpen = openDepts[dept] !== false;
                return (
                  <div key={dept} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                    <button onClick={() => toggleDept(dept)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', border: 'none', fontWeight: 700, fontSize: '12px', color: '#475569', cursor: 'pointer', textAlign: 'left' }}>
                      <span>{dept} <span style={{ color: '#94a3b8', fontWeight: 500 }}>({entries.length})</span></span>
                      <span>{isOpen ? '▼' : '▶'}</span>
                    </button>
                    {isOpen && (
                      <div style={{ padding: '8px 12px', fontSize: '13px', color: '#1e293b' }}>
                        {entries.map((e: any, idx: number) => (
                          <div key={idx} style={{ marginBottom: '2px' }}>
                            {e.staffName} {e.shiftTime && <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>({e.shiftTime})</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="dash-card">
          <h3>🌴 On Leave Today (By Dept)</h3>
          {Object.keys(leaveByDept).length === 0 ? <p style={{ fontSize: '13px', color: '#64748b' }}>No one is on leave today.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(leaveByDept).map(([dept, entries]) => {
                const isOpen = openLeaveDepts[dept] !== false;
                return (
                  <div key={dept} style={{ border: '1px solid #fecaca', borderRadius: '6px', overflow: 'hidden' }}>
                    <button onClick={() => toggleLeaveDept(dept)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#fef2f2', border: 'none', fontWeight: 700, fontSize: '12px', color: '#991b1b', cursor: 'pointer', textAlign: 'left' }}>
                      <span>{dept} <span style={{ color: '#f87171', fontWeight: 500 }}>({entries.length})</span></span>
                      <span>{isOpen ? '▼' : '▶'}</span>
                    </button>
                    {isOpen && (
                      <div style={{ padding: '8px 12px', fontSize: '13px', color: '#1e293b' }}>
                        {entries.map((e: any, idx: number) => (
                          <div key={idx} style={{ marginBottom: '2px' }}>
                            {e.staffName} <span style={{ fontSize: '11px', color: '#dc2626', marginLeft: '4px' }}>({e.status})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;