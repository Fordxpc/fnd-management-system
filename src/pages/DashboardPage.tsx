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

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'staff'), (s) => setStaff(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(collection(db, 'roster_entries'), (s) => setRoster(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(collection(db, 'leave_requests'), (s) => setLeaveReqs(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u4 = onSnapshot(collection(db, 'overtime_entries'), (s) => setOtEntries(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  const isManager = ['developer', 'manager', 'owner', 'admin', 'smt'].includes(profile?.role || '');
  const todayStr = formatDate(new Date());
  const thisMonth = todayStr.slice(0, 7);
  const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

  const myStaff = staff.find((s) => (s.email || '').toLowerCase() === (user?.email || '').toLowerCase());

  const activeStaff = staff.filter((s) => s.status !== 'inactive');
  const todayShifts = roster.filter((r) => r.date === todayStr && r.status === 'scheduled');
  const todayLeave = roster.filter((r) => r.date === todayStr && r.status && r.status !== 'scheduled' && r.status !== 'OFF DAY');
  const pendingLeave = leaveReqs.filter((r) => r.status === 'pending');

  // Department stats for charts
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

  // Today's duty grouped by dept
  const dutyByDept: { [key: string]: any[] } = {};
  todayShifts.forEach(r => {
    const d = r.staffDepartment || 'Unknown';
    if (!dutyByDept[d]) dutyByDept[d] = [];
    dutyByDept[d].push(r);
  });

  // On leave grouped by dept
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

      {/* Stat Cards */}
      <div className="dash-stats">
        <div className="stat-card" onClick={() => onNavigate && onNavigate('staff')}>
          <div className="stat-icon bg-blue-100 text-blue-800">👥</div>
          <div><div className="stat-value">{activeStaff.length}</div><div className="stat-label">Active Staff</div></div>
        </div>
        <div className="stat-card" onClick={() => onNavigate && onNavigate('leave')}>
          <div className="stat-icon bg-amber-100 text-amber-800">🌴</div>
          <div><div className="stat-value">{pendingLeave.length}</div><div className="stat-label">Pending Leave</div></div>
        </div>
        <div className="stat-card" onClick={() => onNavigate && onNavigate('roster')}>
          <div className="stat-icon bg-green-100 text-green-800">📅</div>
          <div><div className="stat-value">{todayShifts.length}</div><div className="stat-label">On Duty Today</div></div>
        </div>
      </div>

      {/* Awaiting Approvals Widget */}
      {isManager && pendingLeave.length > 0 && (
        <div className="dash-card mb-4 border-l-4 border-amber-500">
          <h3>⚠️ Awaiting Approvals ({pendingLeave.length})</h3>
          <div className="flex gap-2 flex-wrap">
            {pendingLeave.slice(0, 5).map(r => (
              <div key={r.id} className="p-2 bg-slate-50 rounded border text-xs">
                <strong>{r.staffName}</strong> requested {r.leaveType} ({r.days} days)
              </div>
            ))}
            {pendingLeave.length > 5 && <span className="text-xs self-center">+{pendingLeave.length - 5} more...</span>}
          </div>
          <button className="quick-btn mt-3" onClick={() => onNavigate && onNavigate('leave')}>Review Now</button>
        </div>
      )}

      <div className="dash-grid mb-4">
        {/* Department Stats Chart */}
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

        {/* Leave Types Chart */}
        <div className="dash-card">
          <h3>🌴 Approved Leave Types</h3>
          <div style={{ width: '100%', height: 200 }}>
            {leaveTypeData.length === 0 ? <p className="text-center text-slate-400 mt-10">No approved leaves yet.</p> : (
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
        {/* Today's Duty by Dept */}
        <div className="dash-card">
          <h3>📅 Today's Duty (By Dept)</h3>
          {Object.keys(dutyByDept).length === 0 ? <p className="text-sm text-slate-500">No scheduled shifts today.</p> : (
            <div className="space-y-3">
              {Object.entries(dutyByDept).map(([dept, entries]) => (
                <div key={dept}>
                  <div className="text-xs font-bold text-slate-500 border-b pb-1 mb-1">{dept} ({entries.length})</div>
                  <div className="text-xs text-slate-700">{entries.map((e: any) => e.staffName).join(', ')}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* On Leave by Dept */}
        <div className="dash-card">
          <h3>🌴 On Leave Today (By Dept)</h3>
          {Object.keys(leaveByDept).length === 0 ? <p className="text-sm text-slate-500">No one is on leave today.</p> : (
            <div className="space-y-3">
              {Object.entries(leaveByDept).map(([dept, entries]) => (
                <div key={dept}>
                  <div className="text-xs font-bold text-red-500 border-b pb-1 mb-1">{dept} ({entries.length})</div>
                  <div className="text-xs text-slate-700">{entries.map((e: any) => `${e.staffName} (${e.status})`).join(', ')}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;