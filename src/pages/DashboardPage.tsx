import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
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

// Open-Meteo Weather Codes to Text/Icon mapping
const getWeatherInfo = (code: number) => {
  if (code === 0) return { text: 'Clear Sky', icon: '☀️' };
  if (code >= 1 && code <= 3) return { text: 'Partly Cloudy', icon: '⛅' };
  if (code >= 45 && code <= 48) return { text: 'Fog', icon: '🌫️' };
  if (code >= 51 && code <= 67) return { text: 'Rain', icon: '🌧️' };
  if (code >= 80 && code <= 82) return { text: 'Showers', icon: '🌦️' };
  if (code >= 95) return { text: 'Thunderstorm', icon: '⛈️' };
  return { text: 'Clear', icon: '☀️' };
};

interface Props { onNavigate?: (page: string) => void; }

function DashboardPage({ onNavigate }: Props) {
  const { profile, user } = useAuth();
  const [staff, setStaff] = useState<any[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  const [leaveReqs, setLeaveReqs] = useState<any[]>([]);
  const [otEntries, setOtEntries] = useState<any[]>([]);
  const [flights, setFlights] = useState<any[]>([]);
  const [liveRamp, setLiveRamp] = useState<any>(null);
  
  // FOD & Weather states
  const [todayFOD, setTodayFOD] = useState<any[]>([]);
  const [weather, setWeather] = useState<any>(null);

  const [openDepts, setOpenDepts] = useState<{ [key: string]: boolean }>({});
  const [openLeaveDepts, setOpenLeaveDepts] = useState<{ [key: string]: boolean }>({});
  const [showMyBalance, setShowMyBalance] = useState(true);
  const [showMyOT, setShowMyOT] = useState(true);

  const todayStr = formatDate(new Date());
  const thisMonth = todayStr.slice(0, 7);
  const nowTime = new Date().toTimeString().slice(0, 5);
  const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'staff'), (s) => setStaff(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(collection(db, 'roster_entries'), (s) => setRoster(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(collection(db, 'leave_requests'), (s) => setLeaveReqs(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u4 = onSnapshot(collection(db, 'overtime_entries'), (s) => setOtEntries(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u5 = onSnapshot(collection(db, 'flights'), (s) => setFlights(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u6 = onSnapshot(doc(db, 'ramp_live_draft', 'current'), (docSnap) => {
      if (docSnap.exists()) setLiveRamp(docSnap.data());
      else setLiveRamp(null);
    });
    const u7 = onSnapshot(collection(db, 'fod_collections'), (s) => {
      const allFod = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setTodayFOD(allFod.filter((f: any) => f.date === todayStr));
    });

    // Fetch Weather (Funadhoo Airport Lat: 6.1614, Lon: 73.2864)
    fetch('https://api.open-meteo.com/v1/forecast?latitude=6.1614&longitude=73.2864&current_weather=true')
      .then(res => res.json())
      .then(data => setWeather(data.current_weather))
      .catch(err => console.error("Weather fetch failed", err));

    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); };
  }, [todayStr]);

  const toggleDept = (dept: string) => setOpenDepts(prev => ({ ...prev, [dept]: prev[dept] === false ? true : false }));
  const toggleLeaveDept = (dept: string) => setOpenLeaveDepts(prev => ({ ...prev, [dept]: prev[dept] === false ? true : false }));

  const isManager = ['developer', 'manager', 'owner', 'admin', 'smt'].includes(profile?.role || '');
  const myStaff = staff.find((s) => (s.email || '').toLowerCase() === (user?.email || '').toLowerCase());
  const activeStaff = staff.filter((s) => s.status !== 'inactive');
  const todayShifts = roster.filter((r) => r.date === todayStr && r.status === 'scheduled');
  const todayLeave = roster.filter((r) => r.date === todayStr && r.status && r.status !== 'scheduled' && r.status !== 'OFF DAY');
  const pendingLeave = leaveReqs.filter((r) => r.status === 'pending');

  // Total FOD today
  const totalFODGrams = todayFOD.reduce((sum, f) => sum + (Number(f.grams) || 0), 0);

  // --- Today's Flights ---
  const todaysFlights = flights.filter(f => f.date === todayStr).sort((a, b) => (a.departureTime || '00:00').localeCompare(b.departureTime || '00:00'));

  // --- Find Next Flight ---
  const upcomingFlights = flights
    .filter(f => {
      const fTime = f.departureTime || f.arrivalTime || '00:00';
      return f.date > todayStr || (f.date === todayStr && fTime >= nowTime);
    })
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      const aTime = a.departureTime || a.arrivalTime || '00:00';
      const bTime = b.departureTime || b.arrivalTime || '00:00';
      return aTime.localeCompare(bTime);
    });
  const nextFlight = upcomingFlights.length > 0 ? upcomingFlights[0] : null;

  // --- LIVE STATUS LOGIC FROM RAMP CHECK SHEET ---
  let liveStatus = nextFlight?.status || 'On Time';
  if (nextFlight && liveRamp && liveRamp.fltNo === nextFlight.flightNo) {
    if (liveRamp.atd) liveStatus = 'Departed';
    else if (liveRamp.boarding) liveStatus = 'Boarding';
    else if (liveRamp.ata) liveStatus = 'Landed';
    else if (liveRamp.eta || liveRamp.sta) liveStatus = 'Expected';
  }

  // --- My Leave Balance ---
  let myLeaveUsed = 0;
  if (myStaff) {
    const years = getYearsOfService(myStaff.joinDate || '');
    const renews = years >= 2;
    leaveReqs.filter(r => r.staffId === myStaff.id && r.status === 'approved' && r.leaveType === 'ANNUAL LEAVE').forEach(r => {
      if (!renews) myLeaveUsed += r.days || 0; 
      else if ((r.startDate || '').startsWith(new Date().getFullYear().toString())) myLeaveUsed += r.days || 0;
    });
  }
  const myBalance = ANNUAL_LEAVE_TOTAL - myLeaveUsed;

  // --- My OT Stats ---
  const myOTThisMonth = myStaff ? otEntries.filter(e => e.staffId === myStaff.id && (e.date || '').startsWith(thisMonth)) : [];
  const myOTWeekday = myOTThisMonth.filter(e => e.otType === 'Weekday OT' || !e.otType).reduce((sum, e) => sum + (e.hours || 0), 0);
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        
        {/* NEXT FLIGHT WIDGET */}
        <div className="dash-card" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)', color: 'white', border: 'none', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: '#93c5fd', margin: 0 }}>✈️ Next Flight</h3>
            {nextFlight && <span style={{ fontSize: '12px', background: liveStatus === 'Departed' ? '#64748b' : liveStatus === 'Boarding' ? '#f59e0b' : liveStatus === 'Landed' ? '#059669' : '#2563eb', padding: '6px 12px', borderRadius: '20px', fontWeight: 800, transition: 'all 0.3s' }}>{liveStatus}</span>}
          </div>
          
          {nextFlight ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '12px', marginBottom: '12px' }}>
                <div style={{ fontSize: '32px', fontWeight: 900, lineHeight: 1 }}>{nextFlight.flightNo}</div>
                <div style={{ fontSize: '13px', background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>{nextFlight.aircraft}</div>
                <div style={{ fontSize: '12px', background: '#3b82f6', padding: '4px 10px', borderRadius: '6px', fontWeight: 700 }}>{nextFlight.type || 'Scheduled'}</div>
              </div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#93c5fd' }}>{nextFlight.route}</div>
            </div>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: '14px', marginTop: '20px', textAlign: 'center' }}>No upcoming flights scheduled.</div>
          )}
          
          {isManager && (
            <button className="quick-btn" style={{ marginTop: '16px', background: '#3b82f6', color: 'white', border: 'none', width: '100%' }} onClick={() => onNavigate && onNavigate('flights')}>
              Manage Flight Schedule
            </button>
          )}
        </div>

        {/* TODAY'S FLIGHTS & WEATHER */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* LIVE WEATHER */}
          <div className="dash-card" style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
            <div>
              <h3 style={{ color: '#e0f2fe', margin: '0 0 4px', fontSize: '14px' }}>🌤️ Funadhoo Weather</h3>
              {weather ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '32px' }}>{getWeatherInfo(weather.weathercode).icon}</span>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: 900 }}>{weather.temperature}°C</div>
                    <div style={{ fontSize: '12px', color: '#bae6fd' }}>{getWeatherInfo(weather.weathercode).text} · Wind {weather.windspeed} km/h</div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '13px' }}>Loading weather...</div>
              )}
            </div>
            <div style={{ textAlign: 'right', fontSize: '11px', color: '#bae6fd' }}>
              Live Sync<br/>Open-Meteo
            </div>
          </div>

          {/* TODAY'S FLIGHTS LIST */}
          <div className="dash-card" style={{ flex: 1, padding: '16px 20px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '15px' }}>📅 Today's Flights ({todaysFlights.length})</h3>
            {todaysFlights.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#64748b' }}>No flights scheduled for today.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '100px', overflowY: 'auto' }}>
                {todaysFlights.map(f => (
                  <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span style={{ fontWeight: 800, color: '#1e293b' }}>{f.flightNo}</span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{f.route}</span>
                    </div>
                    <span style={{ fontSize: '11px', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>{f.departureTime || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
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
        {/* FOD STAT CARD */}
        <div className="stat-card" onClick={() => onNavigate && onNavigate('opsboard')}>
          <div className="stat-icon" style={{ background: '#fee2e2', color: '#991b1b' }}>🪨</div>
          <div><div className="stat-value">{totalFODGrams}g</div><div className="stat-label">FOD Collected Today</div></div>
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