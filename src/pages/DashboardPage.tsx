import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
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

const getWindDirection = (deg: number) => {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
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
  const [loading, setLoading] = useState(true);

  const [openDepts, setOpenDepts] = useState<{ [key: string]: boolean }>({});
  const [openLeaveDepts, setOpenLeaveDepts] = useState<{ [key: string]: boolean }>({});
  const [showMyBalance, setShowMyBalance] = useState(true);
  const [showMyOT, setShowMyOT] = useState(true);

  const todayStr = formatDate(new Date());
  const thisMonth = todayStr.slice(0, 7);
  const nowTime = new Date().toTimeString().slice(0, 5);
  const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];

  const myStaff = staff.find((s) => (s.email || '').toLowerCase() === (user?.email || '').toLowerCase());
  
  const isDev = profile?.role === 'developer';
  const isManagerRole = profile?.role === 'manager' || profile?.role === 'admin' || profile?.role === 'owner';
  const isSMT = profile?.role === 'smt' || myStaff?.isSMT === true;
  const hasManagerPosition = (myStaff?.position || '').toLowerCase().includes('manager');
  
  const canSeeAllDepartments = isDev || isManagerRole || isSMT || hasManagerPosition;
  const isManager = canSeeAllDepartments; 
  const isOpsOrSafety = profile?.department === 'Ground Operations' || profile?.department === 'Safety';

  const fetchDashboardData = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        apiFetch('/staff'), apiFetch('/roster'), apiFetch('/leave-requests'),
        apiFetch('/overtime'), apiFetch('/flights'), apiFetch('/ramp/draft'),
        apiFetch('/fod'), apiFetch('/wildlife')
      ]);

      const getData = (index: number) => {
        if (results[index].status === 'fulfilled') return (results[index] as PromiseFulfilledResult<any>).value;
        return [];
      };

      const staffData = getData(0); const rosterData = getData(1); const leaveData = getData(2);
      const otData = getData(3); const flightsData = getData(4); const rampDraft = getData(5);
      const fodData = getData(6); const birdData = getData(7);

      const uniqueRoster = Array.from(new Map(rosterData.map((item: any) => [`${item.staffId}-${item.date}`, item])).values());
      const uniqueLeaves = Array.from(new Map(leaveData.map((item: any) => [`${item.staffId}-${item.startDate}-${item.endDate}`, item])).values());

      setStaff(staffData); 
      setRoster(uniqueRoster); 
      setLeaveReqs(uniqueLeaves); 
      setOtEntries(otData);
      setFlights(flightsData); 
      setLiveRamp(rampDraft);
      
      setTodayFOD(fodData.filter((f: any) => f.date === todayStr));
      
      const todayBirds = birdData.filter((b: any) => b.date === todayStr);
      let totalBirds = 0;
      todayBirds.forEach((record: any) => {
        record.rows?.forEach((row: any) => {
          totalBirds += row.zones.reduce((a: number, b: number) => a + b, 0);
        });
      });
      setTodayBirdCount(totalBirds);
      
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setLoading(false);
    }
  }, [todayStr]);

  const fetchWeather = useCallback(async () => {
    try {
      const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=6.1614&longitude=73.2864&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,visibility,surface_pressure&timezone=auto');
      const data = await res.json();
      setWeather(data.current);
    } catch (err) { console.error("Weather fetch failed", err); }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    fetchWeather();
    
    const interval = setInterval(() => {
      fetchDashboardData();
      fetchWeather();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [fetchDashboardData, fetchWeather]);

  const toggleDept = (dept: string) => setOpenDepts(prev => ({ ...prev, [dept]: prev[dept] === false ? true : false }));
  const toggleLeaveDept = (dept: string) => setOpenLeaveDepts(prev => ({ ...prev, [dept]: prev[dept] === false ? true : false }));

  const firstName = myStaff?.name ? myStaff.name.split(' ')[0] : (profile?.name || user?.email?.split('@')[0] || 'User');
  const displayName = firstName;

  const activeStaff = staff.filter((s) => s.status !== 'inactive');
  const todayShiftsAll = roster.filter((r) => r.date === todayStr && r.status === 'scheduled');
  const todayLeaveAll = roster.filter((r) => r.date === todayStr && r.status && r.status !== 'scheduled' && r.status !== 'OFF DAY');
  const pendingLeave = leaveReqs.filter((r) => r.status?.toLowerCase() === 'pending');

  const userDept = profile?.department;
  
  const todayShifts = canSeeAllDepartments ? todayShiftsAll : todayShiftsAll.filter(r => r.staffDepartment === userDept);
  const todayLeave = canSeeAllDepartments ? todayLeaveAll : todayLeaveAll.filter(r => r.staffDepartment === userDept);

  const totalFODGrams = todayFOD.reduce((sum, f) => sum + (Number(f.grams) || 0), 0);

  const upcomingFlights = flights
    .filter(f => {
      const isCompleted = ['Departed', 'Departed (Origin)', 'Landed', 'Cancelled'].includes(f.status);
      return f.date >= todayStr && !isCompleted;
    })
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      const aTime = a.departureTime || a.arrivalTime || '00:00';
      const bTime = b.departureTime || b.arrivalTime || '00:00';
      return aTime.localeCompare(bTime);
    });
  const nextFlight = upcomingFlights.length > 0 ? upcomingFlights[0] : null;

  // DYNAMIC STATUS LOGIC
  let baseStatus = nextFlight?.status || 'Scheduled';
  if (baseStatus === 'On Time') baseStatus = 'Scheduled';
  let liveStatus = baseStatus;
  
  const cleanFlightStr = (str: string) => (str || '').replace(/\s+/g, '').toUpperCase();
  
  // 1. Check saved database times first
  if (nextFlight) {
    if (nextFlight.atd) liveStatus = 'Departed';
    else if (nextFlight.ata) liveStatus = 'Landed';
    else if (nextFlight.eta) liveStatus = 'Departed (Origin)';
  }

  // 2. Override with live draft if it matches exactly
  if (nextFlight && liveRamp && cleanFlightStr(liveRamp.fltNo) === cleanFlightStr(nextFlight.flightNo)) {
    if (liveRamp.atd) liveStatus = 'Departed';
    else if (liveRamp.boarding) liveStatus = 'Boarding';
    else if (liveRamp.ata) liveStatus = 'Landed';
    else if (liveRamp.eta) liveStatus = 'Departed (Origin)'; 
  }

  let myLeaveUsed = 0;
  if (myStaff) {
    const years = getYearsOfService(myStaff.joinDate || '');
    const renews = years >= 2;
    leaveReqs.filter(r => r.staffId === myStaff.id && r.status?.toLowerCase() === 'approved' && r.leaveType === 'ANNUAL LEAVE').forEach(r => {
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

  if (loading) return <div className="page-content"><p>Loading Dashboard...</p></div>;

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
        
        {/* FLIGHT WIDGET */}
        <div className="dash-card" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)', color: 'white', border: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: '#93c5fd', margin: 0 }}>✈️ Next Flight</h3>
            {/* DYNAMIC STATUS BADGE */}
            {nextFlight && <span style={{ fontSize: '12px', background: liveStatus.includes('Departed') ? '#64748b' : liveStatus === 'Boarding' ? '#f59e0b' : liveStatus === 'Landed' ? '#059669' : liveStatus === 'Departed (Origin)' ? '#8b5cf6' : '#2563eb', padding: '6px 12px', borderRadius: '20px', fontWeight: 800 }}>{liveStatus}</span>}
          </div>
          
          {nextFlight ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '12px' }}>
                <div style={{ fontSize: '36px', fontWeight: 900, lineHeight: 1 }}>{nextFlight.flightNo}</div>
                <div style={{ fontSize: '14px', background: 'rgba(255,255,255,0.15)', padding: '4px 10px', borderRadius: '6px', fontWeight: 600 }}>{nextFlight.aircraft}</div>
                <div style={{ fontSize: '12px', background: '#3b82f6', padding: '4px 10px', borderRadius: '6px', fontWeight: 700 }}>{nextFlight.type || 'Scheduled'}</div>
              </div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#93c5fd' }}>{nextFlight.route}</div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '10px', color: '#cbd5e1', fontWeight: 600 }}>CHECK-IN</div>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>{nextFlight.checkInTime || '—'}</div>
                </div>
                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ fontSize: '10px', color: '#cbd5e1', fontWeight: 600 }}>STA</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#fcd34d' }}>{nextFlight.arrivalTime || '—'}</div>
                </div>
                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ fontSize: '10px', color: '#cbd5e1', fontWeight: 600 }}>ETA</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#a78bfa' }}>{nextFlight.eta || liveRamp?.eta || '—'}</div>
                </div>
                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ fontSize: '10px', color: '#cbd5e1', fontWeight: 600 }}>ARRIVAL (ATA)</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#86efac' }}>{nextFlight.ata || liveRamp?.ata || '—'}</div>
                </div>
                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ fontSize: '10px', color: '#cbd5e1', fontWeight: 600 }}>DEPARTURE (ATD)</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#93c5fd' }}>{nextFlight.atd || liveRamp?.atd || nextFlight.departureTime || '—'}</div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: '14px', marginTop: '20px', textAlign: 'center' }}>No upcoming flights scheduled.</div>
          )}
        </div>

        {/* EXPANDED WEATHER WIDGET */}
        <div className="dash-card" style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: 'white', padding: '16px 20px' }}>
          <h3 style={{ color: '#e0f2fe', margin: '0 0 12px', fontSize: '14px' }}>🌤️ Detailed Weather (Funadhoo)</h3>
          {weather ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '48px' }}>{getWeatherInfo(weather.weather_code).icon}</span>
                <div>
                  <div style={{ fontSize: '32px', fontWeight: 900 }}>{weather.temperature_2m}°C</div>
                  <div style={{ fontSize: '13px', color: '#bae6fd', fontWeight: 600 }}>{getWeatherInfo(weather.weather_code).text}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', flex: 1, background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '8px', fontSize: '12px' }}>
                <div><strong>Feels Like:</strong> <br/>{weather.apparent_temperature}°C</div>
                <div><strong>Humidity:</strong> <br/>{weather.relative_humidity_2m}%</div>
                <div><strong>Visibility:</strong> <br/>{(weather.visibility / 1000).toFixed(1)} km</div>
                <div><strong>Wind:</strong> <br/>{getWindDirection(weather.wind_direction_10m)} @ {weather.wind_speed_10m} km/h</div>
                <div><strong>Pressure:</strong> <br/>{weather.surface_pressure} hPa</div>
                <div><strong>Precipitation:</strong> <br/>{weather.precipitation} mm</div>
              </div>
            </div>
          ) : <div style={{ fontSize: '13px' }}>Loading weather data...</div>}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', alignItems: 'stretch' }}>
          <button className="quick-btn" style={{ padding: '16px', background: 'white', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '100%' }} onClick={() => onNavigate && onNavigate('roster')}>
            <span style={{ fontSize: '24px' }}>📅</span> My Roster
          </button>
          <button className="quick-btn" style={{ padding: '16px', background: 'white', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '100%' }} onClick={() => onNavigate && onNavigate('leave')}>
            <span style={{ fontSize: '24px' }}>🌴</span> Request Leave
          </button>
          {(isManager || isOpsOrSafety) && (
            <button className="quick-btn" style={{ padding: '16px', background: 'white', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '100%' }} onClick={() => onNavigate && onNavigate('opsboard')}>
              <span style={{ fontSize: '24px' }}>📋</span> Ops Board
            </button>
          )}
          {isManager && (
            <button className="quick-btn" style={{ padding: '16px', background: 'white', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '100%' }} onClick={() => onNavigate && onNavigate('rampcheck')}>
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
          <h3>📅 Today's Duty {canSeeAllDepartments ? '(All Depts)' : `(${userDept})`}</h3>
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
          <h3>🌴 On Leave Today {canSeeAllDepartments ? '(All Depts)' : `(${userDept})`}</h3>
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