import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../auth';
import { apiFetch } from '../lib/api';

const DEPARTMENTS = [
  'Ground Operations',
  'Maintenance',
  'Security',
  'Fire & Rescue',
  'Administration',
  'Safety',
];

function Section({ title, loading, children }: { title: string; loading: boolean; children: ReactNode }) {
  return (
    <div className="dash-card" style={{ padding: '20px', marginBottom: '20px' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1e293b' }}>{title}</h3>
      {loading ? <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Loading…</p> : children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>{text}</p>;
}

export default function DashboardPage({ onNavigate: _onNavigate }: { onNavigate: (page: string) => void }) {
  const { profile } = useAuth();
  const [time, setTime] = useState(new Date());
  const [dashboard, setDashboard] = useState<any>(null);
  const [passwordResets, setPasswordResets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const role = (profile?.role || '').toLowerCase();
  const canSeePendingRequests = ['smt', 'manager', 'admin', 'developer'].includes(role);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Dashboard data + 5-minute refresh
  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const data = await apiFetch('/dashboard');
        setDashboard(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
    const interval = setInterval(fetchDashboard, 300000);
    return () => clearInterval(interval);
  }, []);

  // Pending password reset requests (approvers only)
  useEffect(() => {
    if (!canSeePendingRequests) return;

    const fetchResets = async () => {
      try {
        const res = await apiFetch('/password-reset-requests').catch(() => []);
        setPasswordResets(Array.isArray(res) ? res : []);
      } catch {
        // Non-fatal: role may not have backend access (e.g. SMT). Just show 0.
        setPasswordResets([]);
      }
    };

    fetchResets();
    const interval = setInterval(fetchResets, 60000);
    return () => clearInterval(interval);
  }, [canSeePendingRequests]);

  // ─── Header / Clock ────────────────────────────────────────
  const dayName = time.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = time.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const hour = time.getHours();
  const greeting =
    hour < 12
      ? 'Good Morning'
      : hour < 17
        ? 'Good Afternoon'
        : 'Good Evening';

  // ─── Dashboard Data ────────────────────────────────────────
  const nextFlight = dashboard?.nextFlight;
  const weather = dashboard?.weather;
  const operations = dashboard?.operations || {};
  const onDuty = dashboard?.onDutyToday || [];
  const onLeave = dashboard?.onLeaveToday || [];
  const pendingLeave = dashboard?.pendingLeave || [];
  const pendingOT = dashboard?.pendingOT || [];

  // ─── Flight Status (derived) ───────────────────────────────
  let flightStatus = 'Scheduled';
  if (nextFlight?.eta) flightStatus = 'Departed Origin';
  if (nextFlight?.ata) flightStatus = 'Arrived';
  if (nextFlight?.atd) flightStatus = 'Departed';
  if (nextFlight?.ata && nextFlight?.atd) flightStatus = 'Completed';

  // ─── Group duty by department ──────────────────────────────
  const dutyByDept: Record<string, any[]> = {};
  DEPARTMENTS.forEach(d => { dutyByDept[d] = []; });
  onDuty.forEach((r: any) => {
    if (r?.staffDepartment && dutyByDept[r.staffDepartment]) {
      dutyByDept[r.staffDepartment].push(r);
    }
  });

  return (
    <div className="page-content" style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>

      {/* ═════════════ 1. GREETING HEADER ═════════════ */}
      <div
        className="dashboard-hero dash-card"
        style={{
          marginBottom: '24px',
          background: 'linear-gradient(135deg, #1e293b, #0f172a)',
          color: 'white',
          padding: '30px',
          borderRadius: '16px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '20px',
        }}
      >
        <div>
          <h1 style={{ margin: '0 0 16px 0', fontSize: '28px', color: '#f8fafc', fontWeight: 600 }}>
            {greeting}, {profile?.name || 'User'}! 👋
          </h1>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px', color: '#cbd5e1' }}>
            <div>{profile?.position || 'N/A'}</div>
            <div>{profile?.department || 'N/A'}</div>
            <div>{profile?.sn || 'N/A'}</div>
          </div>
        </div>

        <div
          style={{
            textAlign: 'right',
            background: 'rgba(255,255,255,0.05)',
            padding: '16px 24px',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>{dayName}</div>
          <div style={{ fontSize: '14px', color: '#cbd5e1', marginBottom: '8px' }}>{dateStr}</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#38bdf8', fontFamily: 'monospace' }}>{timeStr}</div>
        </div>
      </div>

      {/* ═════════════ 2. NEXT FLIGHT ═════════════ */}
      <Section title="✈️ Next Flight" loading={loading}>
        {nextFlight ? (
          <div className="flight-widget">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="flight-number" style={{ fontSize: '20px', fontWeight: 'bold', color: '#2563eb' }}>
                {nextFlight?.flightNo}
              </span>
              <span
                className="status-badge"
                style={{
                  fontSize: '12px',
                  background: '#dbeafe',
                  color: '#1e40af',
                  padding: '3px 10px',
                  borderRadius: '4px',
                  fontWeight: 'bold',
                }}
              >
                {flightStatus}
              </span>
            </div>

            <div
              className="flight-route"
              style={{ fontSize: '14px', color: '#475569', marginBottom: '14px' }}
            >
              {nextFlight?.route || '—'}
            </div>

            <div
              className="flight-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '10px',
              }}
            >
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Type</div>
                <div style={{ fontSize: '13px', color: '#1e293b', marginTop: '2px' }}>{nextFlight?.type || '--'}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Check-In</div>
                <div style={{ fontSize: '13px', color: '#1e293b', marginTop: '2px' }}>{nextFlight?.checkInTime || '--'}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>STA</div>
                <div style={{ fontSize: '13px', color: '#1e293b', marginTop: '2px' }}>{nextFlight?.arrivalTime || '--'}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>STD</div>
                <div style={{ fontSize: '13px', color: '#1e293b', marginTop: '2px' }}>{nextFlight?.departureTime || '--'}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>MLE DEP</div>
                <div style={{ fontSize: '13px', color: '#1e293b', marginTop: '2px' }}>{nextFlight?.originDepTime || '--'}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Adult</div>
                <div style={{ fontSize: '13px', color: '#1e293b', marginTop: '2px' }}>{nextFlight?.adultPax || '--'}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Infant</div>
                <div style={{ fontSize: '13px', color: '#1e293b', marginTop: '2px' }}>{nextFlight?.infantPax || '--'}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>ETA</div>
                <div style={{ fontSize: '13px', color: '#1e293b', marginTop: '2px' }}>{nextFlight?.eta || '--'}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>ATA</div>
                <div style={{ fontSize: '13px', color: '#1e293b', marginTop: '2px' }}>{nextFlight?.ata || '--'}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>ATD</div>
                <div style={{ fontSize: '13px', color: '#1e293b', marginTop: '2px' }}>{nextFlight?.atd || '--'}</div>
              </div>
            </div>
          </div>
        ) : (
          <Empty text="No upcoming flights scheduled." />
        )}
      </Section>

      {/* ═════════════ 3. WEATHER ═════════════ */}
      <div className="dash-card weather-widget" style={{ padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1e293b' }}>🌦 Weather</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Temperature</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', marginTop: '2px' }}>
              {weather?.temperature_2m ?? '--'}°C
            </div>
          </div>
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Wind</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', marginTop: '2px' }}>
              {weather?.wind_speed_10m ?? '--'} km/h
            </div>
          </div>
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Direction</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', marginTop: '2px' }}>
              {weather?.wind_direction_10m ?? '--'}°
            </div>
          </div>
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Humidity</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b', marginTop: '2px' }}>
              {weather?.relative_humidity_2m ?? '--'}%
            </div>
          </div>
        </div>
      </div>

      {/* ═════════════ 4. AIRPORT OPERATIONS SUMMARY ═════════════ */}
      <div className="dash-card" style={{ padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1e293b' }}>🛫 Airport Operations Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Bird Count</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>{operations?.birdCountToday ?? 0}</div>
          </div>
          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>FOD Collection</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>{operations?.fodToday ?? 0}</div>
          </div>
          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>Ramp Reports</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>{operations?.rampReportsToday ?? 0}</div>
          </div>
          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>RWY Inspections</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>{operations?.rwyInspectionsToday ?? 0}</div>
          </div>
        </div>
      </div>

      {/* ═════════════ 5. DEPARTMENT DUTY CARDS ═════════════ */}
      <div className="dash-card" style={{ padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1e293b' }}>👥 Department Duty</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
          {DEPARTMENTS.map(dept => {
            const staffInDept = dutyByDept[dept] || [];
            return (
              <div
                key={dept}
                style={{
                  background: '#f8fafc',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  minHeight: '110px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{dept}</div>
                  <span
                    style={{
                      fontSize: '11px',
                      background: staffInDept.length > 0 ? '#dbeafe' : '#f1f5f9',
                      color: staffInDept.length > 0 ? '#1e40af' : '#64748b',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: 'bold',
                    }}
                  >
                    {staffInDept.length}
                  </span>
                </div>
                {staffInDept.length > 0 ? (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {staffInDept.map((r: any) => (
                      <li key={r.id} style={{ fontSize: '12px', color: '#475569' }}>
                        <strong>{r.staffName}</strong>
                        {r.shiftTime ? <span style={{ color: '#94a3b8' }}> · {r.shiftTime}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>No staff on duty</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═════════════ 6. PENDING REQUESTS (role-gated) ═════════════ */}
      {canSeePendingRequests && (
        <div className="dash-card" style={{ padding: '20px', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1e293b' }}>📝 Pending Requests</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>

            {/* Pending Leave */}
            <div style={{ background: '#fef3c7', padding: '14px', borderRadius: '8px', border: '1px solid #fde68a' }}>
              <div style={{ fontSize: '11px', color: '#92400e', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>
                Pending Leave
              </div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#92400e', lineHeight: 1 }}>
                {pendingLeave.length}
              </div>
              {pendingLeave.length > 0 && (
                <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {pendingLeave.slice(0, 5).map((l: any) => (
                    <li key={l.id} style={{ fontSize: '11px', color: '#78350f' }}>
                      <strong>{l.staffName}</strong> · {l.leaveType}
                    </li>
                  ))}
                  {pendingLeave.length > 5 && (
                    <li style={{ fontSize: '11px', color: '#92400e', fontStyle: 'italic' }}>
                      +{pendingLeave.length - 5} more
                    </li>
                  )}
                </ul>
              )}
            </div>

            {/* Pending OT */}
            <div style={{ background: '#dbeafe', padding: '14px', borderRadius: '8px', border: '1px solid #93c5fd' }}>
              <div style={{ fontSize: '11px', color: '#1e40af', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>
                Pending Overtime
              </div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e40af', lineHeight: 1 }}>
                {pendingOT.length}
              </div>
              {pendingOT.length > 0 && (
                <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {pendingOT.slice(0, 5).map((o: any) => (
                    <li key={o.id} style={{ fontSize: '11px', color: '#1e3a8a' }}>
                      <strong>{o.staffName}</strong> · {o.date}
                    </li>
                  ))}
                  {pendingOT.length > 5 && (
                    <li style={{ fontSize: '11px', color: '#1e40af', fontStyle: 'italic' }}>
                      +{pendingOT.length - 5} more
                    </li>
                  )}
                </ul>
              )}
            </div>

            {/* Password Resets */}
            <div style={{ background: '#fee2e2', padding: '14px', borderRadius: '8px', border: '1px solid #fca5a5' }}>
              <div style={{ fontSize: '11px', color: '#991b1b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>
                Password Resets
              </div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#991b1b', lineHeight: 1 }}>
                {passwordResets.length}
              </div>
              {passwordResets.length > 0 && (
                <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {passwordResets.slice(0, 5).map((r: any) => (
                    <li key={r.id} style={{ fontSize: '11px', color: '#7f1d1d' }}>
                      {r.email}
                    </li>
                  ))}
                  {passwordResets.length > 5 && (
                    <li style={{ fontSize: '11px', color: '#991b1b', fontStyle: 'italic' }}>
                      +{passwordResets.length - 5} more
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═════════════ 7. TODAY'S LEAVE ═════════════ */}
      <Section title={`🏖️ Today's Leave (${onLeave.length})`} loading={loading}>
        {onLeave.length > 0 ? (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {onLeave.map((l: any) => (
              <li
                key={l.id}
                style={{
                  background: '#f8fafc',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '12px',
                  fontSize: '13px',
                  color: '#1e293b',
                }}
              >
                <div><strong>Name:</strong> {l.staffName}</div>
                <div><strong>Department:</strong> {l.staffDepartment || '—'}</div>
                <div><strong>Leave Type:</strong> {l.leaveType}</div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty text="No one on leave today." />
        )}
      </Section>

      {/* ═════════════ 8. LIVE AIR TRAFFIC ═════════════ */}
      <div className="dash-card" style={{ padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1e293b' }}>✈️ Live Air Traffic</h3>
        <iframe
          src="https://globe.adsbexchange.com/"
          title="Live Air Traffic"
          width="100%"
          height={600}
          style={{ border: 0, borderRadius: '12px' }}
        />
      </div>

      {/* ═════════════ 9. ZONE MAP ═════════════ */}
      <div className="dash-card" style={{ padding: '20px', width: '100%' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1e293b' }}>📍 Airside Zone Map</h3>
        <img
          src="/zone-map.png"
          alt="Zone Map"
          style={{ width: '100%', display: 'block', borderRadius: '12px' }}
        />
      </div>

    </div>
  );
}