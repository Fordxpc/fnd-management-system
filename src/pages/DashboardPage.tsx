import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../auth';
import { apiFetch } from '../lib/api';

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
  const [loading, setLoading] = useState(true);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Dashboard data + 5-minute refresh (checklist #4)
  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const data = await apiFetch("/dashboard");
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

  const dayName = time.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = time.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const nextFlight = dashboard?.nextFlight;
  const weather = dashboard?.weather;
  const operations = dashboard?.operations || {};
  const onDuty = dashboard?.onDutyToday || [];
  const onLeave = dashboard?.onLeaveToday || [];
  const pendingLeave = dashboard?.pendingLeave || [];
  const pendingOT = dashboard?.pendingOT || [];

  return (
    <div className="page-content" style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>

      {/* Header */}
      <div className="dash-card" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, #1e293b, #0f172a)', color: 'white', padding: '30px', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 style={{ margin: '0 0 16px 0', fontSize: '28px', color: '#f8fafc', fontWeight: 600 }}>
            Welcome back, {profile?.name || 'User'}! 👋
          </h1>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '14px', color: '#cbd5e1' }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '8px' }}><strong style={{ color: '#94a3b8' }}>SN:</strong> {profile?.sn || 'N/A'}</div>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '8px' }}><strong style={{ color: '#94a3b8' }}>Designation:</strong> {profile?.designation || profile?.position || 'N/A'}</div>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '8px' }}><strong style={{ color: '#94a3b8' }}>Dept:</strong> {profile?.department || 'N/A'}</div>
            <div style={{ background: '#3b82f6', padding: '6px 12px', borderRadius: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>{profile?.role || 'Staff'}</div>
          </div>
        </div>

        <div style={{ textAlign: 'right', background: 'rgba(255,255,255,0.05)', padding: '16px 24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>{dayName}</div>
          <div style={{ fontSize: '14px', color: '#cbd5e1', marginBottom: '8px' }}>{dateStr}</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#38bdf8', fontFamily: 'monospace' }}>{timeStr}</div>
        </div>
      </div>

      {/* 1. Flight Widget */}
      <Section title="✈️ Upcoming Flight" loading={loading}>
        {nextFlight ? (
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#2563eb' }}>{nextFlight.flightNo}</span>
              <span style={{ fontSize: '12px', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{nextFlight.status}</span>
            </div>
            <div style={{ display: 'flex', gap: '24px', fontSize: '13px', color: '#475569', flexWrap: 'wrap' }}>
              <div><strong>Date:</strong> {nextFlight.date}</div>
              <div><strong>Route:</strong> {nextFlight.route || 'N/A'}</div>
              <div><strong>Time:</strong> {nextFlight.arrivalTime || nextFlight.departureTime || 'TBA'}</div>
            </div>
          </div>
        ) : <Empty text="No upcoming flights scheduled." />}
      </Section>

      {/* 2. Weather — reads from backend dashboard.weather */}
      <div className="dash-card" style={{ padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1e293b' }}>🌦️ Weather</h3>
        <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#1e293b' }}>
          Temperature: {weather?.temperature_2m ?? "--"}°C
        </p>
        <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#1e293b' }}>
          Wind: {weather?.wind_speed_10m ?? "--"} km/h
        </p>
        <p style={{ margin: 0, fontSize: '14px', color: '#1e293b' }}>
          Direction: {weather?.wind_direction_10m ?? "--"}°
        </p>
      </div>

      {/* 3. Operations Board — uses rwyInspectionsToday */}
      <div className="dash-card" style={{ padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1e293b' }}>🛫 Today's Operational Board</h3>
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

      {/* 4. On Duty Staff */}
      <Section title={`👥 On Duty Staff (${onDuty.length})`} loading={loading}>
        {onDuty.length > 0 ? (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {onDuty.map((r: any) => (
              <li key={r.id} style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '13px', color: '#1e293b' }}>
                <div><strong>Name:</strong> {r.staffName}</div>
                <div><strong>Department:</strong> {r.staffDepartment || '—'}</div>
                <div><strong>Shift:</strong> {r.shiftTime || '—'}</div>
              </li>
            ))}
          </ul>
        ) : <Empty text="No staff on duty today." />}
      </Section>

      {/* 5. On Leave Today */}
      <Section title={`🏖️ On Leave Today (${onLeave.length})`} loading={loading}>
        {onLeave.length > 0 ? (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {onLeave.map((l: any) => (
              <li key={l.id} style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', color: '#1e293b' }}>
                <div><strong>Name:</strong> {l.staffName}</div>
                <div><strong>Leave Type:</strong> {l.leaveType}</div>
              </li>
            ))}
          </ul>
        ) : <Empty text="No one on leave today." />}
      </Section>

      {/* 6. Pending Leave */}
      <div className="dash-card" style={{ padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#1e293b' }}>📝 Pending Leave</h3>
        <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1e293b', marginBottom: '12px' }}>
          {dashboard?.pendingLeave?.length ?? 0}
        </div>
        {pendingLeave.length > 0 && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {pendingLeave.map((l: any) => (
              <li key={l.id} style={{ fontSize: '12px', color: '#475569', padding: '6px 10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <strong>{l.staffName}</strong> · {l.leaveType} · {l.startDate} → {l.endDate}
              </li>
            ))}
          </ul>
        )}
        {pendingLeave.length === 0 && (
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>No pending leave requests.</p>
        )}
      </div>

      {/* 7. Pending OT */}
      <div className="dash-card" style={{ padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#1e293b' }}>⏱️ Pending Overtime</h3>
        <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1e293b', marginBottom: '12px' }}>
          {dashboard?.pendingOT?.length ?? 0}
        </div>
        {pendingOT.length > 0 && (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {pendingOT.map((o: any) => (
              <li key={o.id} style={{ fontSize: '12px', color: '#475569', padding: '6px 10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <strong>{o.staffName}</strong> · {o.date} · {o.startTime}–{o.endTime} ({o.hours}h)
              </li>
            ))}
          </ul>
        )}
        {pendingOT.length === 0 && (
          <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>No pending overtime entries.</p>
        )}
      </div>

      {/* 8. Zone Map */}
      <div className="dash-card" style={{ padding: '20px', width: '100%' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1e293b' }}>📍 Airside Zone Map</h3>
        <img
          src="/zone-map.png"
          alt="Zone Map"
          style={{
            width: '100%',
            display: 'block',
            borderRadius: '12px'
          }}
        />
      </div>

    </div>
  );
}