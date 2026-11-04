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
  const { profile } = useAuth();
  const [time, setTime] = useState<Date | null>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [passwordResets, setPasswordResets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const role = (profile?.role || '').toLowerCase();
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
        const data = await apiFetch('/dashboard');
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
    const interval = setInterval(fetchDashboard, 300000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!canManageRequests) return;

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
  }, [canManageRequests]);

  const nextFlight = dashboard?.nextFlight;
  const operations = dashboard?.operations || {};
  const onDuty = dashboard?.onDutyToday || EMPTY_LIST;
  const onLeave = dashboard?.onLeaveToday || EMPTY_LIST;
  const pendingLeave = dashboard?.pendingLeave || EMPTY_LIST;
  const pendingOT = dashboard?.pendingOT || EMPTY_LIST;

  const dutyByDepartment = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    DEPARTMENTS.forEach((department) => {
      grouped[department] = [];
    });

    onDuty.forEach((entry: any) => {
      if (entry?.staffDepartment && grouped[entry.staffDepartment]) {
        grouped[entry.staffDepartment].push(entry);
      }
    });

    return grouped;
  }, [onDuty]);

  const clock = time
    ? {
        day: time.toLocaleDateString('en-GB', { weekday: 'long' }),
        date: time.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }),
        time: time.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        greeting: time.getHours() < 12 ? 'Good morning' : time.getHours() < 17 ? 'Good afternoon' : 'Good evening',
      }
    : { day: 'Today', date: 'Loading date', time: '--:--:--', greeting: 'Welcome' };

  const flightStatus = nextFlight?.status || (
    nextFlight?.atd ? 'Departed' :
    nextFlight?.ata ? 'Arrived' :
    nextFlight?.eta ? 'Departed origin' :
    'Scheduled'
  );

  const operationMetrics = [
    { label: 'Bird count records', value: operations.birdCountToday ?? 0, code: 'WH', page: 'wildlife' },
    { label: 'FOD collections', value: operations.fodToday ?? 0, code: 'FD', page: 'opsboard' },
    { label: 'Ramp reports', value: operations.rampReportsToday ?? 0, code: 'RP', page: 'rampcheck' },
    { label: 'Runway inspections', value: operations.rwyInspectionsToday ?? 0, code: 'RW', page: 'lights' },
  ];

  const quickActions = [
    { label: 'Flight schedule', description: 'Review arrivals and departures', page: 'flights', code: 'FS' },
    { label: 'Duty roster', description: 'Check today and upcoming shifts', page: 'roster', code: 'DR' },
    { label: 'Leave requests', description: 'Submit or review staff leave', page: 'leave', code: 'LR' },
    { label: 'Conversations', description: 'Open operational discussions', page: 'conversations', code: 'CH' },
  ];

  return (
    <div className="overview-dashboard">
      <section className="overview-welcome">
        <div>
          <span className="overview-kicker">FND operational overview</span>
          <h1>{clock.greeting}, {profile?.name || 'team member'}</h1>
          <p>
            {profile?.position || role || 'Airport staff'}
            <span aria-hidden="true"> · </span>
            {profile?.department || 'Funadhoo Airport'}
          </p>
        </div>
        <div className="overview-clock" aria-label={`${clock.day}, ${clock.date}, ${clock.time}`}>
          <span>{clock.day}</span>
          <strong>{clock.time}</strong>
          <small>{clock.date}</small>
        </div>
      </section>

      {loadError && (
        <div className="overview-alert" role="status">
          <strong>Refresh issue</strong>
          <span>{loadError}</span>
        </div>
      )}

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

      <div className="overview-primary-grid">
        <Panel
          title="Next scheduled flight"
          eyebrow="Flight movement"
          action={<button type="button" className="overview-text-button" onClick={() => onNavigate('flights')}>View schedule</button>}
          className="overview-flight-panel"
        >
          {loading ? (
            <LoadingBlock />
          ) : nextFlight ? (
            <>
              <div className="overview-flight-lead">
                <div>
                  <strong>{nextFlight.flightNo || 'Flight'}</strong>
                  <span>{nextFlight.route || 'Route not entered'}</span>
                </div>
                <span className="overview-status">{flightStatus}</span>
              </div>

              <div className="overview-flight-timeline">
                <div>
                  <small>Origin departure</small>
                  <strong>{nextFlight.originDepTime || '—'}</strong>
                </div>
                <div className="overview-route-line" aria-hidden="true">
                  <span />
                  <i />
                  <span />
                </div>
                <div>
                  <small>FND arrival</small>
                  <strong>{nextFlight.arrivalTime || nextFlight.eta || '—'}</strong>
                </div>
              </div>

              <dl className="overview-flight-details">
                <div><dt>Aircraft</dt><dd>{nextFlight.aircraft || '—'}</dd></div>
                <div><dt>Check-in</dt><dd>{nextFlight.checkInTime || '—'}</dd></div>
                <div><dt>Departure</dt><dd>{nextFlight.departureTime || '—'}</dd></div>
                <div><dt>Passengers</dt><dd>{nextFlight.paxAdults ?? 0} + {nextFlight.paxInfants ?? 0} infant</dd></div>
              </dl>
            </>
          ) : (
            <EmptyState>No upcoming flight is scheduled.</EmptyState>
          )}
        </Panel>

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
                {DEPARTMENTS.map((department) => {
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
                <strong>{pendingLeave.length}</strong>
              </button>
              <button type="button" onClick={() => onNavigate('overtime')}>
                <span>Overtime requests</span>
                <strong>{pendingOT.length}</strong>
              </button>
              {canManageRequests && (
                <button type="button" onClick={() => onNavigate('settings')}>
                  <span>Password resets</span>
                  <strong>{passwordResets.length}</strong>
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
          action={<button type="button" className="overview-text-button" onClick={() => onNavigate('staff')}>Staff directory</button>}
        >
          {loading ? (
            <LoadingBlock />
          ) : (
            <div className="overview-duty-grid">
              {DEPARTMENTS.map((department) => {
                const departmentStaff = dutyByDepartment[department] || [];
                return (
                  <article key={department}>
                    <header>
                      <strong>{department}</strong>
                      <span>{departmentStaff.length}</span>
                    </header>
                    {departmentStaff.length > 0 ? (
                      <ul>
                        {departmentStaff.slice(0, 4).map((entry: any) => (
                          <li key={entry.id}>
                            <span>{entry.staffName}</span>
                            <small>{entry.shiftTime || entry.status || 'On duty'}</small>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No staff scheduled</p>
                    )}
                  </article>
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