import { useState } from 'react';
import { useAuth } from './auth';
import './Dashboard.css';
import StaffPage from './pages/StaffPage';
import RosterPage from './pages/RosterPage';

const MANAGEMENT_ROLES = ['developer', 'manager', 'owner', 'admin', 'smt'];

function Dashboard({ user, logout }: any) {
  const { profile } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  const isManagement = MANAGEMENT_ROLES.includes(profile?.role);

  const pages: { [key: string]: any } = {
    dashboard: <div className="page-content"><h2>Dashboard</h2><p>Overview coming soon...</p></div>,
    staff: <StaffPage />,
    roster: <RosterPage />,
    leave: <div className="page-content"><h2>Leave Management</h2><p>Coming soon...</p></div>,
    overtime: <div className="page-content"><h2>Overtime</h2><p>Coming soon...</p></div>,
    settings: <div className="page-content"><h2>Settings</h2><p>Coming soon...</p></div>,
  };

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Funadhoo Airport</h2>
          <p>Roster System</p>
        </div>

        <nav className="sidebar-nav">
          <button
            className={currentPage === 'dashboard' ? 'nav-item active' : 'nav-item'}
            onClick={() => setCurrentPage('dashboard')}
          >
            📊 Dashboard
          </button>

          {/* Staff page only visible to SMT / Manager / Developer */}
          {isManagement && (
            <button
              className={currentPage === 'staff' ? 'nav-item active' : 'nav-item'}
              onClick={() => setCurrentPage('staff')}
            >
              👥 Staff
            </button>
          )}

          <button
            className={currentPage === 'roster' ? 'nav-item active' : 'nav-item'}
            onClick={() => setCurrentPage('roster')}
          >
            📅 Duty Roster
          </button>
          <button
            className={currentPage === 'leave' ? 'nav-item active' : 'nav-item'}
            onClick={() => setCurrentPage('leave')}
          >
            🌴 Leave
          </button>
          <button
            className={currentPage === 'overtime' ? 'nav-item active' : 'nav-item'}
            onClick={() => setCurrentPage('overtime')}
          >
            ⏰ Overtime
          </button>
          <button
            className={currentPage === 'settings' ? 'nav-item active' : 'nav-item'}
            onClick={() => setCurrentPage('settings')}
          >
            ⚙️ Settings
          </button>
        </nav>

        <div className="sidebar-footer">
          <p className="user-email">{user?.email}</p>
          <button className="logout-btn" onClick={logout}>Log Out</button>
        </div>
      </aside>

      <main className="main-content">
        {pages[currentPage]}
      </main>
    </div>
  );
}

export default Dashboard;