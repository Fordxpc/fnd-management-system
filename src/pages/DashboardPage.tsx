import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../auth';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const DEPARTMENTS = ['Ground Operations', 'Maintenance', 'Security', 'Fire & Rescue', 'Administration'];
const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#8b5cf6'];

const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

interface Props { onNavigate?: (page: string) => void; }

function DashboardPage({ onNavigate }: Props) {
  const { profile, user } = useAuth();
  const [staff, setStaff] = useState<any[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  const [leaveReqs, setLeaveReqs] = useState<any[]>([]);
  const [otEntries, setOtEntries] = useState<any[]>([]);

  // Track which department accordions are open (default to open)
  const [openDepts, setOpenDepts] = useState<{ [key: string]: boolean }>({});
  const [openLeaveDepts, setOpenLeaveDepts] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'staff'), (s) => setStaff(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(collection(db, 'roster_entries'), (s) => setRoster(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(collection(db, 'leave_requests'), (s) => setLeaveReqs(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u4 = onSnapshot(collection(db, 'overtime_entries'), (s) => setOtEntries(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const toggleDept = (dept: string) => {
    setOpenDepts(prev => ({ ...prev, [dept]: prev[dept] === false ? true : false }));
  };

  const toggleLeaveDept = (dept: string) => {
    setOpenLeaveDepts(prev => ({ ...prev, [dept]: prev[dept] === false ? true : false }));
  };

  const isManager = ['developer', 'manager', 'owner', 'admin', 'smt'].includes(profile?.role || '');
  const todayStr = formatDate(new Date());
  const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
  const dayOfWeek = new Date().getDay(); // 0=Sun, 1=Mon, ..., 4=Thu

  const myStaff = staff.find((s) => (s.email || '').toLowerCase() === (user?.email || '').toLowerCase());

  const activeStaff = staff.filter((s) => s.status !== 'inactive');
  const todayShifts = roster.filter((r) => r.date === todayStr && r.status === 'scheduled');
  const todayLeave = roster.filter((r) => r.date === todayStr && r.status && r.status !== 'scheduled' && r.status !== 'OFF DAY');
  const pendingLeave = leaveReqs.filter((r) => r.status === 'pending');

  // 1. Group Operational Staff from Roster
  const dutyByDept: { [key: string]: any[] } = {};
  todayShifts.forEach(r => {
    const d = r.staffDepartment || 'Unknown';
    if (!dutyByDept[d]) dutyByDept[d] = [];
    dutyByDept[d].push(r);
  });

  // 2. Inject Administration & Managers (Sun-Thu only)
  const isAdminWorkDay = dayOfWeek >= 0 && dayOfWeek <= 4;
  if (isAdminWorkDay) {
    const onLeaveIds = new Set(todayLeave.map(r => r.staffId));
    const adminStaff = activeStaff.filter(s => s.department === 'Administration' && !onLeaveIds.has(s.id));
    
    if (adminStaff.length > 0) {
      if (!dutyByDept['Administration']) dutyByDept['Administration'] = [];
      adminStaff.forEach(s => {
        // Safety Officer is OFF on Monday (dayOfWeek 1)
        if (s.position === 'Assistant Safety Officer' && dayOfWeek === 1) return;
        
        dutyByDept['Administration'].push({
          id: s.id,
          staffName: s.name,
          shiftTime: '08:00 - 16:00',
          status: 'scheduled',
          isAdmin: true
        });
      });
    }
  }

  // Group Leave by Dept
  const leaveByDept: { [key: string]: any[] } = {};
  todayLeave.forEach(r => {
    const d = r.staffDepartment || 'Unknown';
    if (!leaveByDept[d]) leaveByDept[d] = [];
    leaveByDept[d].push(r);
  });

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
        {/* TODAY'S DUTY */}
        <div className="dash-card">
          <h3>📅 Today's Duty (By Dept)</h3>
          {Object.keys(dutyByDept).length === 0 ? <p style={{ fontSize: '13px', color: '#64748b' }}>No scheduled shifts today.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(dutyByDept).map(([dept, entries]) => {
                const isOpen = openDepts[dept] !== false; // Default open
                return (
                  <div key={dept} style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                    <button
                      onClick={() => toggleDept(dept)}
                      style={{
                        width: '100%', display: 'flex', justifyContent: 'space-between',
                        padding: '8px 12px', backgroundColor: '#f8fafc', border: 'none',
                        fontWeight: 700, fontSize: '12px', color: '#475569', cursor: 'pointer', textAlign: 'left'
                      }}
                    >
                      <span>{dept} <span style={{ color: '#94a3b8', fontWeight: 500 }}>({entries.length})</span></span>
                      <span>{isOpen ? '▼' : '▶'}</span>
                    </button>
                    {isOpen && (
                      <div style={{ padding: '8px 12px', fontSize: '13px', color: '#1e293b' }}>
                        {entries.map((e: any, idx: number) => (
                          <div key={idx} style={{ marginBottom: '2px' }}>
                            {e.staffName} {e.isAdmin && <span style={{ fontSize: '10px', color: '#2563eb', background: '#eff6ff', padding: '2px 4px', borderRadius: '4px', marginLeft: '4px' }}>08:00-16:00</span>}
                            {!e.isAdmin && e.shiftTime && <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>({e.shiftTime})</span>}
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

        {/* ON LEAVE TODAY */}
        <div className="dash-card">
          <h3>🌴 On Leave Today (By Dept)</h3>
          {Object.keys(leaveByDept).length === 0 ? <p style={{ fontSize: '13px', color: '#64748b' }}>No one is on leave today.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(leaveByDept).map(([dept, entries]) => {
                const isOpen = openLeaveDepts[dept] !== false;
                return (
                  <div key={dept} style={{ border: '1px solid #fecaca', borderRadius: '6px', overflow: 'hidden' }}>
                    <button
                      onClick={() => toggleLeaveDept(dept)}
                      style={{
                        width: '100%', display: 'flex', justifyContent: 'space-between',
                        padding: '8px 12px', backgroundColor: '#fef2f2', border: 'none',
                        fontWeight: 700, fontSize: '12px', color: '#991b1b', cursor: 'pointer', textAlign: 'left'
                      }}
                    >
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