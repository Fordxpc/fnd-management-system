import { useState, useEffect } from 'react';
import { useAuth } from '../auth';
import { apiFetch } from '../lib/api';

export default function DashboardPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { profile } = useAuth();
  
  const [stats, setStats] = useState({
    totalStaff: 0,
    pendingLeaves: 0,
    todayFlights: 0,
    activeRoster: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [staffData, leaveData, flightsData, rosterData] = await Promise.all([
          apiFetch('/staff').catch(() => []),
          apiFetch('/leave-requests').catch(() => []),
          apiFetch('/flights').catch(() => []),
          apiFetch('/roster').catch(() => []),
        ]);

        const today = new Date().toISOString().split('T')[0];

        setStats({
          totalStaff: staffData.length || 0,
          pendingLeaves: leaveData.filter((l: any) => l.status === 'pending').length || 0,
          todayFlights: flightsData.filter((f: any) => f.date === today).length || 0,
          activeRoster: rosterData.filter((r: any) => r.date === today).length || 0,
        });
      } catch (err) {
        console.error("Failed to load dashboard stats", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const dashboardTiles = [
    { id: 'staff', label: 'Staff Management', icon: '👥', color: '#3b82f6', desc: 'View and manage all staff records' },
    { id: 'roster', label: 'Roster & Shifts', icon: '📅', color: '#8b5cf6', desc: 'Manage daily shift assignments' },
    { id: 'leave', label: 'Leave Requests', icon: '📝', color: '#f59e0b', desc: 'Review and approve leave applications' },
    { id: 'flights', label: 'Flight Schedule', icon: '✈️', color: '#10b981', desc: 'Track arrivals and departures' },
    { id: 'overtime', label: 'Overtime', icon: '⏱️', color: '#ef4444', desc: 'Approve staff overtime hours' },
    { id: 'reports', label: 'Reports', icon: '📊', color: '#6366f1', desc: 'Generate and view operational reports' },
  ];

  return (
    <div className="page-content" style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      
      {/* 🚨 NEW GREETING SECTION */}
      <div className="dash-card" style={{ 
        marginBottom: '24px', 
        background: 'linear-gradient(135deg, #1e293b, #0f172a)', 
        color: 'white', 
        padding: '30px', 
        borderRadius: '16px', 
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' 
      }}>
        <h1 style={{ margin: '0 0 16px 0', fontSize: '28px', color: '#f8fafc', fontWeight: 600 }}>
          Welcome back, {profile?.name || 'User'}! 👋
        </h1>
        
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '14px', color: '#cbd5e1' }}>
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <strong style={{ color: '#94a3b8' }}>SN:</strong> 
            <span>{profile?.sn || 'N/A'}</span>
          </div>
          
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <strong style={{ color: '#94a3b8' }}>Designation:</strong> 
            <span>{profile?.designation || profile?.position || 'N/A'}</span>
          </div>
          
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <strong style={{ color: '#94a3b8' }}>Department:</strong> 
            <span>{profile?.department || 'N/A'}</span>
          </div>
          
          <div style={{ background: '#3b82f6', padding: '8px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {profile?.role || 'Staff'}
          </div>
        </div>
      </div>

      {/* 📊 STATS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        
        <div className="dash-card" style={{ padding: '20px', borderLeft: '4px solid #3b82f6', cursor: 'pointer' }} onClick={() => onNavigate('staff')}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748b' }}>Total Staff</h3>
          <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#1e293b' }}>{loading ? '...' : stats.totalStaff}</p>
        </div>

        <div className="dash-card" style={{ padding: '20px', borderLeft: '4px solid #f59e0b', cursor: 'pointer' }} onClick={() => onNavigate('leave')}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748b' }}>Pending Leaves</h3>
          <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#1e293b' }}>{loading ? '...' : stats.pendingLeaves}</p>
        </div>

        <div className="dash-card" style={{ padding: '20px', borderLeft: '4px solid #10b981', cursor: 'pointer' }} onClick={() => onNavigate('flights')}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748b' }}>Today's Flights</h3>
          <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#1e293b' }}>{loading ? '...' : stats.todayFlights}</p>
        </div>

        <div className="dash-card" style={{ padding: '20px', borderLeft: '4px solid #8b5cf6', cursor: 'pointer' }} onClick={() => onNavigate('roster')}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748b' }}>Today's Roster</h3>
          <p style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#1e293b' }}>{loading ? '...' : stats.activeRoster}</p>
        </div>

      </div>

      {/* 🚀 QUICK NAVIGATION TILES */}
      <h2 style={{ fontSize: '20px', color: '#1e293b', marginBottom: '16px' }}>Quick Actions</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
        {dashboardTiles.map(tile => (
          <div 
            key={tile.id}
            className="dash-card" 
            onClick={() => onNavigate(tile.id)}
            style={{ 
              padding: '24px', 
              cursor: 'pointer', 
              transition: 'transform 0.2s, box-shadow 0.2s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              background: '#ffffff'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '12px', background: `${tile.color}20`, padding: '12px', borderRadius: '12px' }}>
              {tile.icon}
            </div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#1e293b', fontWeight: 600 }}>
              {tile.label}
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              {tile.desc}
            </p>
          </div>
        ))}
      </div>

    </div>
  );
}