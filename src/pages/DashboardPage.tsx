import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { useAuth } from '../auth';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import FlightRadarWidget from '../FlightRadarWidget';

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

const getWeatherInfo = (code: number) => {
  if (code === 0) return { text: 'Clear Sky', icon: '☀️' };
  if (code >= 1 && code <= 3) return { text: 'Partly Cloudy', icon: '⛅' };
  if (code >= 45 && code <= 48) return { text: 'Fog', icon: '🌫️' };
  if (code >= 51 && code <= 67) return { text: 'Rain', icon: '🌧️' };
  if (code >= 80 && code <= 82) return { text: 'Showers', icon: '🌦️' };
  if (code >= 95) return { text: 'Thunderstorm', icon: '⛈️' };
  return { text: 'Clear', icon: '☀️' };
};

interface DashboardProps {
  onNavigate?: (page: string) => void;
}

const DashboardPage: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { profile, user } = useAuth();
  const [staff, setStaff] = useState<any[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  const [leaveReqs, setLeaveReqs] = useState<any[]>([]);
  const [otEntries, setOtEntries] = useState<any[]>([]);
  const [flights, setFlights] = useState<any[]>([]);
  const [liveRamp, setLiveRamp] = useState<any>(null);
  const [todayFOD, setTodayFOD] = useState<any[]>([]);
  const [todayBirdCount, setTodayBirdCount] = useState<number>(0);
  const [weather, setWeather] = useState<any>(null);

  const [openDepts, setOpenDepts] = useState<{ [key: string]: boolean }>({});
  const [openLeaveDepts, setOpenLeaveDepts] = useState<{ [key: string]: boolean }>({});
  const [showMyBalance, setShowMyBalance] = useState(true);
  const [showMyOT, setShowMyOT] = useState(true);

  const todayStr = formatDate(new Date());
  const thisMonth = todayStr.slice(0, 7);
  const nowTime = new Date().toTimeString().slice(0, 5);
  const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

  const displayName = profile?.name || user?.email?.split('@')[0] || 'User';

  const isDev = profile?.role === 'developer';
  const isManagerRole = profile?.role === 'manager';
  const isSMT = profile?.role === 'smt' || profile?.isSMT === true;
  const isManager = isDev || isManagerRole || isSMT || ['owner', 'admin'].includes(profile?.role || '');
  const isOpsOrSafety = profile?.department === 'Ground Operations' || profile?.department === 'Safety';

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
      const allFod: any[] = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setTodayFOD(allFod.filter((f: any) => f.date === todayStr));
    });
    const u8 = onSnapshot(collection(db, 'bird_counts'), (s) => {
      const todayBirds: any[] = s.docs.map(d => ({ id: d.id, ...d.data() })).filter((b: any) => b.date === todayStr);
      let total = 0;
      todayBirds.forEach(record => {
        record.rows?.forEach((row: any) => {
          total += row.zones.reduce((a: number, b: number) => a + b, 0);
        });
      });
      setTodayBirdCount(total);
    });

    fetch('https://api.open-meteo.com/v1/forecast?latitude=6.1614&longitude=73.2864&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=auto')
      .then(res => res.json())
      .then(data => setWeather(data.current))
      .catch(err => console.error("Weather fetch failed", err));

    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); };
  }, [todayStr]);

  const toggleDept = (dept: string) => setOpenDepts(prev => ({ ...prev, [dept]: prev[dept] === false ? true : false }));
  const toggleLeaveDept = (dept: string) => setOpenLeaveDepts(prev => ({ ...prev, [dept]: prev[dept] === false ? true : false }));

  const myStaff = staff.find((s) => (s.email || '').toLowerCase() === (user?.email || '').toLowerCase());
  const activeStaff = staff.filter((s) => s.status !== 'inactive');
  const todayShifts = roster.filter((r) => r.date === todayStr && r.status === 'scheduled');
  const todayLeave = roster.filter((r) => r.date === todayStr && r.status && r.status !== 'scheduled' && r.status !== 'OFF DAY');
  const pendingLeave = leaveReqs.filter((r) => r.status === 'pending');

  const totalFODGrams = todayFOD.reduce((sum, f) => sum + (Number(f.grams) || 0), 0);

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

  let liveStatus = nextFlight?.status || 'Scheduled';
  if (nextFlight && liveRamp && liveRamp.fltNo === nextFlight.flightNo) {
    if (liveRamp.atd) liveStatus = 'Departed';
    else if (liveRamp.boarding) liveStatus = 'Boarding';
    else if (liveRamp.ata) liveStatus = 'Landed';
    else if (liveRamp.eta || liveRamp.sta) liveStatus = 'Expected';
  }

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
      <div className="dash-welcome" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>{new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}, {displayName}</h2>
          <p>{todayName}, {todayStr} · <strong>{String(profile?.role || 'staff').toUpperCase()}</strong> · {profile?.department || 'All Depts'}</p>
        </div>
        <div style={{ fontSize: '40px' }}>✈️</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
        <div className="dash-card" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)', color: 'white', border: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: '#93c5fd', margin: 0 }}>✈️ Next Flight</h3>
            {nextFlight && <span style={{ fontSize: '12px', background: liveStatus === 'Departed' ? '#64748b' : liveStatus === 'Boarding' ? '#f59e0b' : liveStatus === 'Landed' ? '#059669' : '#2563eb', padding: '6px 12px', borderRadius: '20px', fontWeight: 800 }}>{liveStatus}</span>}
          </div>
          
          {nextFlight ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '12px' }}>
                <div style={{ fontSize: '36px', fontWeight: 900, lineHeight: 1 }}>{nextFlight.flightNo}</div>
                <div style={{ fontSize: '14px', background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>{nextFlight.aircraft}</div>
                <div style={{ fontSize: '12px', background: '#3b82f6', padding: '4px 10px', borderRadius: '6px', fontWeight: 700 }}>{nextFlight.type || 'Scheduled'}</div>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#93c5fd' }}>{nextFlight.route}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                <div><div style={{ fontSize: '10px', color: '#cbd5e1', fontWeight: 600 }}>ETA</div><div style={{ fontSize: '14px', fontWeight: 700 }}>{nextFlight.checkInTime || '—'}</div></div>
                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', borderRight: '1px solid rgba(255,255,255,0.1)' }}><div style={{ fontSize: '10px', color: '#cbd5e1', fontWeight: 600 }}>ATA</div><div style={{ fontSize: '14px', fontWeight: 700, color: '#86efac' }}>{nextFlight.arrivalTime || '—'}</div></div>
                <div><div style={{ fontSize: '10px', color: '#cbd5e1', fontWeight: 600 }}>ATD</div><div style={{ fontSize: '14px', fontWeight: 700, color: '#93c5fd' }}>{nextFlight.departureTime || '—'}</div></div>
              </div>
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

        <div className="dash-card" style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
          <div>
            <h3 style={{ color: '#e0f2fe', margin: '0 0 8px', fontSize: '14px' }}>🌤️ Weather</h3>
            {weather ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '40px' }}>{getWeatherInfo(weather.weather_code).icon}</span>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: 900 }}>{weather.temperature_2m}°C</div>
                  <div style={{ fontSize: '12px', color: '#bae6fd', fontWeight: 600 }}>{getWeatherInfo(weather.weather_code).text}</div>
                  <div style={{ fontSize: '11px', color: '#bae6fd' }}>Feels like: {weather.apparent_temperature}°C · Wind: {weather.wind_speed_10m} km/h</div>
                  <div style={{ fontSize: '11px', color: '#bae6fd' }}>Humidity: {weather.relative_humidity_2m}% · Rain: {weather.precipitation} mm</div>
                </div>
              </div>
            ) : <div style={{ fontSize: '13px' }}>Loading...</div>}
          </div>
        </div>
      </div>

      {nextFlight && <FlightRadarWidget flightNumber={nextFlight.flightNo} />}

      <div className="dash-stats" style={{ marginTop: '20px' }}>
        {isManager && (
          <div className="stat-card" onClick={() => onNavigate && onNavigate('staff')}>
            <div className="stat-icon" style={{ background: '#dbeafe', color: '#1e40af' }}>👥</div>
            <div><div className="stat-value">{activeStaff.length}</div><div className="stat-label">Active Staff</div></div>
          </div>
        )}
        <div className="stat-card" onClick={() => onNavigate && onNavigate('leave')}>
          <div className="stat-icon" style={{ background: '#fef3c7', color: '#92400e' }}>🌴</div>
          <div><div className="stat-value">{pendingLeave.length}</div><div className="stat-label">Pending Leave</div></div>
        </div>
        {(isManager || isOpsOrSafety) && (
          <div className="stat-card" onClick={() => onNavigate && onNavigate('opsboard')}>
            <div className="stat-icon" style={{ background: '#fee2e2', color: '#991b1b' }}>🪨</div>
            <div><div className="stat-value">{totalFODGrams}g</div><div className="stat-label">FOD Today</div></div>
          </div>
        )}
        {(isManager || isOpsOrSafety) && (
          <div className="stat-card" onClick={() => onNavigate && onNavigate('wildlife')}>
            <div className="stat-icon" style={{ background: '#f3e8ff', color: '#6b21a8' }}>🦅</div>
            <div><div className="stat-value">{todayBirdCount}</div><div className="stat-label">Birds Today</div></div>
          </div>
        )}
      </div>

      <div className="dash-card" style={{ marginBottom: '20px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
        <h3 style={{ margin: '0 0 12px' }}>🚀 Quick Access</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          <button className="quick-btn" style={{ padding: '16px', background: 'white', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }} onClick={() => onNavigate && onNavigate('roster')}>
            <span style={{ fontSize: '24px' }}>📅</span> My Roster
          </button>
          <button className="quick-btn" style={{ padding: '16px', background: 'white', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }} onClick={() => onNavigate && onNavigate('leave')}>
            <span style={{ fontSize: '24px' }}>🌴</span> Request Leave
          </button>
          {(isManager || isOpsOrSafety) && (
            <button className="quick-btn" style={{ padding: '16px', background: 'white', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }} onClick={() => onNavigate && onNavigate('opsboard')}>
              <span style={{ fontSize: '24px' }}>📋</span> Ops Board
            </button>
          )}
          {isManager && (
            <button className="quick-btn" style={{ padding: '16px', background: 'white', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }} onClick={() => onNavigate && onNavigate('rampcheck')}>
              <span style={{ fontSize: '24px' }}>✈️</span> Ramp Check
            </button>
          )}
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

      <div className="dash-card" style={{ marginBottom: '20px', textAlign: 'center' }}>
        <h3>🗺️ Airside Zone Map</h3>
        <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
          <img src="/zone-map.png" alt="Zone Map" style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', cursor: 'pointer' }} onClick={() => onNavigate && onNavigate('wildlife')} />
        </div>
      </div>

      <div className="dash-grid">
        <div className="dash-card">
          <h3>📅 Today's Duty (By Dept)</h3>
          {Object.keys(dutyByDept).length === 0 ? <p style={{ fontSize: '13px', color: '#64748b' }}>No scheduled shifts today.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(dutyByDept).map(([dept, entries]: any) => {
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
              {Object.entries(leaveByDept).map(([dept, entries]: any) => {
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