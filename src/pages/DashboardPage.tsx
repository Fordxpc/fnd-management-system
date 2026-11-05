import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../auth';
import { apiFetch } from '../lib/api';

const EMPTY_LIST: any[] = [];

const DEPARTMENTS = [
  'Ground Operations',
  'Maintenance',
  'Security',
  'Fire & Rescue',
  'Administration',
  'Safety',
];

type DashboardPageProps = {
  onNavigate: (page: string) => void;
};

type PanelProps = {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

function Panel({ title, eyebrow, action, children, className = '' }: PanelProps) {
  return (
    <section className={`overview-panel ${className}`}>
      <header className="overview-panel-header">
        <div>
          {eyebrow && <span>{eyebrow}</span>}
          <h2>{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="overview-empty">{children}</div>;
}

function flightStatus(flight: any) {
  return flight?.status || (flight?.atd ? 'Departed' : flight?.ata ? 'Landed' : flight?.eta ? 'Departed from origin' : 'Scheduled');
}

function shortFlightDate(value?: string) {
  if (!value) return 'Date TBC';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
function weatherDescription(code?: number) {
  if (code === 0) return 'Clear sky';
  if ([1, 2, 3].includes(Number(code))) return 'Partly cloudy';
  if ([45, 48].includes(Number(code))) return 'Fog or mist';
  if ([51, 53, 55, 56, 57].includes(Number(code))) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(Number(code))) return 'Rain showers';
  if ([95, 96, 99].includes(Number(code))) return 'Thunderstorms';
  return 'Current conditions';
}

function weatherIcon(code?: number) {
  const value = Number(code);
  if (value === 0) return '☀️';
  if ([1, 2].includes(value)) return '🌤️';
  if (value === 3) return '☁️';
  if ([45, 48].includes(value)) return '🌫️';
  if ([51, 53, 55, 56, 57].includes(value)) return '🌦️';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(value)) return '🌧️';
  if ([95, 96, 99].includes(value)) return '⛈️';
  return '🌤️';
}

function compassDirection(degrees?: number) {
  if (typeof degrees !== 'number') return '—';
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(degrees / 45) % 8];
}
function LoadingBlock() {
  return (
    <div className="overview-loading" aria-label="Loading dashboard">
      <span />
      <span />
      <span />
    </div>
  );
}

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { profile, user } = useAuth();
  const [time, setTime] = useState<Date | null>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [passwordResets, setPasswordResets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [weather, setWeather] = useState<any>(null);
  const [weatherError, setWeatherError] = useState('');
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [dutyFilter, setDutyFilter] = useState('all');

  const role = (profile?.role || '').toLowerCase();
  const accountName = String(profile?.name || user?.name || user?.email?.split('@')[0] || 'Airport User').trim();
  const accountInitials = accountName.split(/\s+/).slice(0, 2).map((part: string) => part.charAt(0)).join('').toUpperCase() || 'FND';
  const accountPosition = profile?.position || profile?.designation || (role ? role.replace(/\b\w/g, (letter: string) => letter.toUpperCase()) : 'Airport Staff');
  const accountDepartment = profile?.department && profile.department !== '—' ? profile.department : 'Funadhoo Airport';
  const canManageRequests = ['manager', 'admin', 'developer', 'owner'].includes(role);
  const canSeeTeamRequests = canManageRequests || role === 'smt';

  useEffect(() => {
    const updateClock = () => setTime(new Date());
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;

    const fetchDashboard = async () => {
      try {
        const data = await apiFetch('/dashboard', { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
        if (!active) return;
        setDashboard(data);
        setLoadError('');
      } catch {
        if (!active) return;
        setLoadError('Dashboard data could not be refreshed. Existing modules are still available.');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchDashboard();
    const interval = window.setInterval(fetchDashboard, 5000);
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') void fetchDashboard(); };
    window.addEventListener('focus', fetchDashboard);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', fetchDashboard);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadWeather = async () => {
      try {
        const result = await apiFetch('/weather');
        if (active) { setWeather(result); setWeatherError(''); }
      } catch {
        if (active) setWeatherError('Live weather is temporarily unavailable.');
      } finally {
        if (active) setWeatherLoading(false);
      }
    };
    void loadWeather();
    const timer = window.setInterval(loadWeather, 600000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (!canSeeTeamRequests) return;

    let active = true;

    const fetchResets = async () => {
      try {
        const response = await apiFetch('/password-reset-requests');
        if (active) setPasswordResets(Array.isArray(response) ? response : []);
      } catch {
        if (active) setPasswordResets([]);
      }
    };

    fetchResets();
    const interval = setInterval(fetchResets, 60000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [canSeeTeamRequests]);

  const upcomingFlights = dashboard?.upcomingFlights || EMPTY_LIST;
  const trackedFlight = upcomingFlights[0];
  const radarFlightId = String(trackedFlight?.flightNo || '').replace(/[^a-zA-Z0-9]/g, '');
  const canViewFlightBoard = dashboard?.canViewFlightBoard !== false;
  const operations = dashboard?.operations || {};
  const onDuty = dashboard?.onDutyToday || EMPTY_LIST;
  const onLeave = dashboard?.onLeaveToday || EMPTY_LIST;
  const pendingLeave = dashboard?.pendingLeave || EMPTY_LIST;
  const pendingOT = dashboard?.pendingOT || EMPTY_LIST;

  const dutyByDepartment = useMemo(() => {
    const grouped: Record<string, any[]> = { Unassigned: [] };
    DEPARTMENTS.forEach((department) => { grouped[department] = []; });
    onDuty.forEach((entry: any) => {
      const value = String(entry?.staffDepartment || '').trim().toLowerCase();
      const department = value.includes('ground') || value === 'operations' ? 'Ground Operations'
        : value.includes('maint') ? 'Maintenance'
        : value.includes('secur') ? 'Security'
        : value.includes('fire') || value.includes('rescue') ? 'Fire & Rescue'
        : value.includes('admin') ? 'Administration'
        : value.includes('safe') ? 'Safety' : 'Unassigned';
      grouped[department].push(entry);
    });
    return grouped;
  }, [onDuty]);
  const dutyDepartments = dutyByDepartment.Unassigned.length > 0 ? [...DEPARTMENTS, 'Unassigned'] : DEPARTMENTS;
  const visibleDutyDepartments = dutyFilter === 'all' ? dutyDepartments : dutyDepartments.filter(department => department === dutyFilter);

  const clock = time
    ? {
        day: time.toLocaleDateString('en-GB', { weekday: 'long' }),
        date: time.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
        time: time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        greeting: time.getHours() < 12 ? 'Good morning' : time.getHours() < 17 ? 'Good afternoon' : 'Good evening',
      }
    : { day: 'Today', date: 'Loading date', time: '--:--:--', greeting: 'Welcome' };


  const operationMetrics = [
    { label: 'Bird count records', value: operations.birdCountToday ?? 0, code: 'WH', page: 'wildlife' },
    { label: 'FOD collections', value: operations.fodToday ?? 0, code: 'FD', page: 'opsboard' },
    { label: 'Ramp reports', value: operations.rampReportsToday ?? 0, code: 'RP', page: 'rampcheck' },
    { label: 'Runway inspections', value: operations.rwyInspectionsToday ?? 0, code: 'RW', page: 'lights' },
  ];

  const quickActions = [
    ...(canViewFlightBoard ? [{ label: 'Flight schedule', description: 'Review arrivals and departures', page: 'flights', code: 'FS' }] : []),
    { label: 'Duty roster', description: 'Check today and upcoming shifts', page: 'roster', code: 'DR' },
    { label: 'Leave requests', description: 'Submit or review staff leave', page: 'leave', code: 'LR' },
    { label: 'Conversations', description: 'Open operational discussions', page: 'conversations', code: 'CH' },
  ];

  return (
    <div className="overview-dashboard">
      <section className="overview-welcome overview-greeting-board">
        <div className="overview-greeting-copy">
          <div className="overview-profile-stack"><div className="overview-profile-mark">{profile?.photoBase64 ? <img src={profile.photoBase64} alt={`${accountName} profile`} /> : accountInitials}</div>{profile?.sn && <small>SN-{String(profile.sn).replace(/^sn-/i, '')}</small>}</div>
          <span className="overview-kicker">Funadhoo Airport · Daily command view</span>
          <h1><span>{clock.greeting},</span><strong>{accountName}</strong></h1>
          <p>Here is the operational picture for {clock.day.toLowerCase()}.</p>
          <div className="overview-identity-row">
            <span className="identity-designation">{accountPosition}</span>
            <span className="identity-department">{accountDepartment}</span>
            {(role === 'smt' || profile?.isSmt || profile?.isIncharge) && <span className="identity-leadership">{(role === 'smt' || profile?.isSmt) ? 'SMT' : ''}{profile?.isIncharge ? `${(role === 'smt' || profile?.isSmt) ? ' · ' : ''}In-charge` : ''}</span>}
          </div>
        </div>
        <div className="overview-airport-art" aria-hidden="true"><svg viewBox="0 0 720 230" role="presentation"><path className="airport-horizon" d="M0 211h720v19H0z"/><path className="airport-terminal" d="M68 206v-34l30-18h120l28 18v34m-166-32h154m-133 0v32m36-32v32m36-32v32m36-32v32M246 206v-47l35-20h198l37 20v47m-251-45h232m-198 0v45m48-45v45m48-45v45m48-45v45M516 206v-25h126v25m-111-25v-20h96v20"/><path className="airport-tower" d="M338 206h50l-7-101h-36zM330 105h65l-8-25h-49zM353 80l5-48h17l5 48"/><path className="airport-flight-path" d="M145 98c88-49 175-64 269-42"/><path className="airport-plane" d="M406 47l32-16 10 3-19 18 28 5 7 8-40-2-19 14-7-2 8-15-25-5-5-6z"/></svg></div>
        <div className="overview-clock" aria-label={`${clock.day}, ${clock.date}, ${clock.time}`}>
          <span className="overview-station-status"><i /> Station · FND</span>
          <strong>{clock.time}</strong>
          <small>{clock.day}, {clock.date}</small>
        </div>
      </section>

      {loadError && (
        <div className="overview-alert" role="status">
          <strong>Refresh issue</strong>
          <span>{loadError}</span>
        </div>
      )}



      <div className="overview-flight-stage">
        <Panel
          title="Flight Movement"
          eyebrow="Live schedule"
          action={<div className="overview-widget-actions"><span className="overview-live-badge"><i /> Live</span><button type="button" className="overview-text-button" onClick={() => onNavigate('flights')}>Full schedule ›</button></div>}
          className="overview-flight-panel overview-flight-board"
        >
          {loading ? (
            <LoadingBlock />
          ) : !canViewFlightBoard ? (
            <EmptyState>Flight movement access is not assigned to this account.</EmptyState>
          ) : upcomingFlights.length > 0 ? (
            <div className="overview-flight-board-list">
              <div className="overview-flight-board-head" aria-hidden="true">
                <span>Service</span><span>Route</span><span>Schedule</span><span>Live movement</span><span>Flight details</span><span>Status</span>
              </div>
              {upcomingFlights.map((flight: any, flightIndex: number) => (
                <button key={flight.id || `${flight.flightNo}-${flight.date}`} type="button" className={flightIndex === 0 ? 'is-next' : ''} onClick={() => onNavigate('flights')}>
                  <span className="overview-flight-service"><i>{flightIndex === 0 ? 'NEXT' : 'CONCURRENT'}</i><strong>{flight.flightNo || 'Flight'}</strong><small>{flight.aircraft || 'Aircraft TBC'}</small></span>
                  <span className="overview-flight-route"><strong>{flight.route || 'Route TBC'}</strong><small>{shortFlightDate(flight.date)}</small></span>
                  <span className="overview-flight-times"><small>ARR <strong>{flight.arrivalTime || '—'}</strong></small><small>DEP <strong>{flight.departureTime || '—'}</strong></small></span>
                  <span className="overview-flight-times overview-flight-live-times"><small>ETA <strong>{flight.eta || '—'}</strong></small><small>ATA <strong>{flight.ata || '—'}</strong></small><small>ATD <strong>{flight.atd || '—'}</strong></small></span>
                  <span className="overview-flight-details-compact"><small>CHECK-IN <strong>{flight.checkInTime || '—'}</strong></small><small>MLE DEP <strong>{flight.originDepTime || '—'}</strong></small><small>PAX <strong>{Number(flight.paxAdults) || 0} / {Number(flight.paxInfants) || 0} INF</strong></small></span>
                  <span className={`overview-board-status overview-board-status--${String(flightStatus(flight)).toLowerCase().replace(/[^a-z]+/g, '-')}`}>{flightStatus(flight)}</span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState>No upcoming flight is scheduled.</EmptyState>
          )}
        </Panel>

      </div>

      <div className="overview-live-grid">
        <Panel title="Live weather" eyebrow="VRCF · Funadhoo Airport" className="overview-weather-panel" action={<span className="overview-live-source"><i /> Auto refresh</span>}>
          {weatherLoading ? <LoadingBlock /> : weather ? <div className="overview-weather-content">
            <div className="overview-weather-now"><div className="overview-weather-condition"><b className="overview-weather-icon" aria-hidden="true">{weatherIcon(weather.weatherCode)}</b><div><span>{weatherDescription(weather.weatherCode)}</span><strong>{Math.round(weather.temperature)}°C</strong><small>Feels like {Math.round(weather.feelsLike)}°C</small></div></div><div className="overview-weather-wind"><span>Wind</span><strong>{compassDirection(weather.windDirection)} {Math.round(weather.windSpeed)} km/h</strong><small>Gusts {Math.round(weather.windGusts || 0)} km/h</small></div></div>
            <div className="overview-weather-metrics"><div><span>Humidity</span><strong>{weather.humidity ?? '—'}%</strong></div><div><span>Visibility</span><strong>{weather.visibility ? `${Math.round(weather.visibility / 100) / 10} km` : '—'}</strong></div><div><span>Cloud</span><strong>{weather.cloudCover ?? '—'}%</strong></div><div><span>Pressure</span><strong>{weather.pressure ? `${Math.round(weather.pressure)} hPa` : '—'}</strong></div><div><span>Rain</span><strong>{weather.rain ?? weather.precipitation ?? 0} mm</strong></div></div>
            <p>Observed {new Date(weather.observedAt).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })} · Coordinates 06°09′45″N 073°17′15″E</p>
          </div> : <EmptyState>{weatherError || 'Weather information is not available.'}</EmptyState>}
        </Panel>

        <Panel title="Live weather radar" eyebrow="Precipitation around FND" className="overview-radar-panel" action={<a className="overview-text-button" href="https://www.windy.com/6.163/73.288?radar,6.163,73.288,8" target="_blank" rel="noreferrer">Open full map</a>}>
          <div className="overview-radar-frame"><iframe title="Live precipitation radar around Funadhoo Airport" loading="lazy" src="https://embed.windy.com/embed2.html?lat=6.163&lon=73.288&detailLat=6.163&detailLon=73.288&width=650&height=360&zoom=7&level=surface&overlay=radar&product=radar&menu=&message=true&marker=true&calendar=now&pressure=&type=map&location=coordinates&detail=true&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1" /></div>
          <p className="overview-radar-note">Interactive radar is supplied by Windy. If the embedded map is blocked, use “Open full map”.</p>
        </Panel>
      </div>
      <Panel title="Live flight radar" eyebrow="Next FND movement" className="overview-flight-radar-panel" action={trackedFlight && <a className="overview-text-button" href={`https://www.flightradar24.com/${radarFlightId}`} target="_blank" rel="noreferrer">Open tracker</a>}>
        {trackedFlight ? <div className="overview-flight-radar-content"><div className="overview-flight-radar-summary"><div><span>Tracking</span><strong>{trackedFlight.flightNo || 'Next flight'}</strong><small>{trackedFlight.route || 'Route TBC'} · {trackedFlight.aircraft || 'Aircraft TBC'}</small></div><span className="overview-board-status">{flightStatus(trackedFlight)}</span></div><div className="overview-flight-radar-frame"><iframe title={`Live tracking for ${trackedFlight.flightNo || 'next flight'}`} loading="lazy" src={`https://www.flightradar24.com/simple_index.php?flight=${radarFlightId}`} /><div className="overview-mobile-radar-launch"><strong>External live tracking</strong><span>Embedded trackers may be blocked on mobile.</span><div><a href={`https://www.flightaware.com/live/flight/${radarFlightId}`} target="_blank" rel="noreferrer">FlightAware</a><a href="https://globe.adsbexchange.com/" target="_blank" rel="noreferrer">ADS-B Exchange</a></div></div></div><p>If live aircraft data is unavailable in the embedded view, open the full tracker in a new tab.</p></div> : <EmptyState>No upcoming flight is available for live tracking.</EmptyState>}
      </Panel>
      <section className="overview-metrics" aria-label="Today's operational activity">
        {operationMetrics.map((metric) => (
          <button key={metric.label} type="button" onClick={() => onNavigate(metric.page)}>
            <span className="overview-metric-code" aria-hidden="true">{metric.code}</span>
            <span>
              <strong>{loading ? '—' : metric.value}</strong>
              <small>{metric.label}</small>
            </span>
          </button>
        ))}
      </section>

      <div className="overview-workforce-stage">
        <Panel
          title="Staffing today"
          eyebrow="Workforce"
          action={<button type="button" className="overview-text-button" onClick={() => onNavigate('roster')}>Open roster</button>}
        >
          {loading ? (
            <LoadingBlock />
          ) : (
            <>
              <div className="overview-staffing-total">
                <div>
                  <strong>{onDuty.length}</strong>
                  <span>staff on duty</span>
                </div>
                <div>
                  <strong>{onLeave.length}</strong>
                  <span>on approved leave</span>
                </div>
              </div>
              <div className="overview-department-bars">
                {dutyDepartments.map((department) => {
                  const count = dutyByDepartment[department]?.length || 0;
                  const width = onDuty.length > 0 ? Math.max(6, Math.round((count / onDuty.length) * 100)) : 0;
                  return (
                    <div key={department}>
                      <div><span>{department}</span><strong>{count}</strong></div>
                      <i><span style={{ width: `${width}%` }} /></i>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Panel>
      </div>

      <div className="overview-secondary-grid">
        <Panel title="Quick access" eyebrow="Common tasks">
          <div className="overview-actions">
            {quickActions.map((action) => (
              <button key={action.page} type="button" onClick={() => onNavigate(action.page)}>
                <span aria-hidden="true">{action.code}</span>
                <div>
                  <strong>{action.label}</strong>
                  <small>{action.description}</small>
                </div>
              </button>
            ))}
          </div>
        </Panel>

        {canSeeTeamRequests && (
          <Panel
            title="Pending decisions"
            eyebrow="Approvals"
            action={<button type="button" className="overview-text-button" onClick={() => onNavigate('leave')}>Review</button>}
          >
            <div className="overview-request-summary">
              <button type="button" onClick={() => onNavigate('leave')}>
                <span>Leave requests</span>
                <strong>{pendingLeave.length}</strong><small>Review ›</small>
              </button>
              <button type="button" onClick={() => onNavigate('overtime')}>
                <span>Overtime requests</span>
                <strong>{pendingOT.length}</strong><small>Review ›</small>
              </button>
              {canSeeTeamRequests && (
                <button type="button" onClick={() => canManageRequests && onNavigate('settings')}>
                  <span>Password resets</span>
                  <strong>{passwordResets.length}</strong><small>Review ›</small>
                </button>
              )}
            </div>
          </Panel>
        )}
      </div>

      <div className="overview-lower-grid">
        <Panel
          title="Department duty"
          eyebrow="Team deployment"
          action={<div className="overview-duty-actions"><select value={dutyFilter} onChange={event => setDutyFilter(event.target.value)} aria-label="Filter duty by department"><option value="all">All departments</option>{dutyDepartments.map(department => <option key={department} value={department}>{department}</option>)}</select><button type="button" className="overview-text-button" onClick={() => onNavigate('staff')}>Staff directory</button></div>}
        >
          {loading ? (
            <LoadingBlock />
          ) : (
            <div className="overview-duty-grid">
              {visibleDutyDepartments.map((department) => {
                const departmentStaff = dutyByDepartment[department] || [];
                return (
                  <details key={department} className="overview-duty-department" open>
                    <summary><strong>{department}</strong><span>{departmentStaff.length}</span></summary>
                    {departmentStaff.length > 0 ? (
                      <ul>{departmentStaff.map((entry: any) => <li key={entry.id}><span>{entry.staffName}</span><small>{entry.shiftTime || entry.status || 'On duty'}</small></li>)}</ul>
                    ) : <p>No staff scheduled</p>}
                  </details>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title={`On leave today · ${onLeave.length}`} eyebrow="Availability">
          {loading ? (
            <LoadingBlock />
          ) : onLeave.length > 0 ? (
            <ul className="overview-leave-list">
              {onLeave.map((entry: any) => (
                <li key={entry.id}>
                  <span className="overview-person-mark" aria-hidden="true">
                    {String(entry.staffName || 'ST').slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <strong>{entry.staffName}</strong>
                    <small>{entry.staffDepartment || 'Department not entered'} · {entry.leaveType}</small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No approved leave is active today.</EmptyState>
          )}
        </Panel>
      </div>
    </div>
  );
}
