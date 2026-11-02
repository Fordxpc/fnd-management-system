import { useState, useEffect } from 'react';
import { useAuth } from '../auth';
import { apiFetch } from '../lib/api';

export default function DashboardPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { profile } = useAuth();
  const [time, setTime] = useState(new Date());
  
  const [stats, setStats] = useState({
    totalStaff: 0, pendingLeaves: 0, todayFlights: 0, activeRoster: 0,
    pendingOvertime: 0, onLeaveToday: 0, upcomingFlight: null as any,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [staffData, leaveData, flightsData, rosterData, otData] = await Promise.all([
          apiFetch('/staff').catch(() => []),
          apiFetch('/leave-requests').catch(() => []),
          apiFetch('/flights').catch(() => []),
          apiFetch('/roster').catch(() => []),
          apiFetch('/overtime').catch(() => []),
        ]);

        const today = new Date().toISOString().split('T')[0];
        const todayLeaves = leaveData.filter((l: any) => l.status === 'approved' && l.startDate <= today && l.endDate >= today);
        const upcoming = flightsData.filter((f: any) => f.date >= today).sort((a: any, b: any) => a.date.localeCompare(b.date))[0];

        setStats({
          totalStaff: staffData.length || 0,
          pendingLeaves: leaveData.filter((l: any) => l.status === 'pending').length || 0,
          todayFlights: flightsData.filter((f: any) => f.date === today).length || 0,
          activeRoster: rosterData.filter((r: any) => r.date === today).length || 0,
          pendingOvertime: otData.filter((o: any) => o.status === 'pending').length || 0,
          onLeaveToday: todayLeaves.length,
          upcomingFlight: upcoming || null,
        });
      } catch (err) {
        console.error("Failed to load dashboard stats", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const dayName = time.toLocaleDateString('en-US', { weekday: 'long' });
  const dateStr = time.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="page-content" style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      
      {/* 1. GREETING BOARD */}
      <div className="dash-card" style={{ 
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
        gap: '20px' 
      }}>
        <div>
          <h1 style={{ margin: '0 0 16px 0', fontSize: '28px', color: '#f8fafc', fontWeight: 600 }}>
            Welcome back, {profile?.name || 'User'}! 👋
          </h1>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '14px', color: '#cbd5e1' }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '8px' }}><strong style={{ color: '#94a3b8' }}>SN:</strong> {profile?.sn || 'N/A'}</div>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '8px' }}><strong style={{ color: '#94a3b8' }}>Designation:</strong> {profile?.designation || profile?.position || 'N/A'}</div>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '8px' }}><strong style={{ color: '#94a3b8' }}>Dept:</strong> {profile?.department || 'N/A'}</div>
            <div style={{ background: '#3b82f6', padding: '6px 12px', borderRadius: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>{profile?.role || 'Staff'} • {profile?.email}</div>
          </div>
        </div>
        
        <div style={{ textAlign: 'right', background: 'rgba(255,255,255,0.05)', padding: '16px 24px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>{dayName}</div>
          <div style={{ fontSize: '14px', color: '#cbd5e1', marginBottom: '8px' }}>{dateStr}</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#38bdf8', fontFamily: 'monospace' }}>{timeStr}</div>
        </div>
      </div>

      {/* 2. STATS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div className="dash-card" style={{ padding: '20px', borderLeft: '4px solid #3b82f6' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#64748b', textTransform: 'uppercase' }}>Today's Duty</h3>
          <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#1e293b' }}>{loading ? '...' : stats.activeRoster}</p>
        </div>
        <div className="dash-card" style={{ padding: '20px', borderLeft: '4px solid #f59e0b' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#64748b', textTransform: 'uppercase' }}>On Leave Today</h3>
          <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#1e293b' }}>{loading ? '...' : stats.onLeaveToday}</p>
        </div>
        <div className="dash-card" style={{ padding: '20px', borderLeft: '4px solid #ef4444' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#64748b', textTransform: 'uppercase' }}>Awaiting Approvals</h3>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'baseline' }}>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>{loading ? '...' : stats.pendingLeaves} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'normal' }}>Leaves</span></p>
            <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>{loading ? '...' : stats.pendingOvertime} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'normal' }}>OT</span></p>
          </div>
        </div>
      </div>

      {/* 3. UPCOMING FLIGHT */}
      <div className="dash-card" style={{ padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1e293b' }}>✈️ Upcoming Flight</h3>
        {stats.upcomingFlight ? (
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#2563eb' }}>{stats.upcomingFlight.flightNo}</span>
              <span style={{ fontSize: '12px', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>{stats.upcomingFlight.status}</span>
            </div>
            <div style={{ display: 'flex', gap: '24px', fontSize: '13px', color: '#475569' }}>
              <div><strong>Date:</strong> {stats.upcomingFlight.date}</div>
              <div><strong>Route:</strong> {stats.upcomingFlight.route || 'N/A'}</div>
              <div><strong>Time:</strong> {stats.upcomingFlight.arrivalTime || stats.upcomingFlight.departureTime || 'TBA'}</div>
            </div>
          </div>
        ) : (
          <p style={{ color: '#64748b', fontSize: '14px' }}>No upcoming flights scheduled.</p>
        )}
      </div>

      {/* 4. WEATHER */}
      <div className="dash-card" style={{ padding: '20px', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1e293b' }}>🌤️ Weather</h3>
        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#1e293b' }}>Clear Skies</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>28°C · Wind 12km/h</p>
          </div>
          <div style={{ fontSize: '32px' }}>☀️</div>
        </div>
      </div>

      {/* 5. ZONE MAP (Full Width) */}
      <div className="dash-card" style={{ padding: '20px', width: '100%' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#1e293b' }}>📍 Airside Zone Map</h3>
        <div style={{ background: '#e2e8f0', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', color: '#94a3b8', fontSize: '14px', width: '100%' }}>
          [ Zone Map Placeholder ]
        </div>
      </div>

    </div>
  );
}