import { useState } from 'react';
import { useAuth } from './auth';
import './Dashboard.css';
import StaffPage from './pages/StaffPage';
import RosterPage from './pages/RosterPage';
import LeavePage from './pages/LeavePage';
import HolidaysPage from './pages/HolidaysPage';
import UsersPage from './pages/UsersPage';

const MANAGEMENT_ROLES = ['developer', 'manager', 'owner', 'admin', 'smt'];
const USER_ADMIN_ROLES = ['developer', 'manager'];

function Dashboard({ user, logout }: any) {
  const { profile } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  const isManagement = MANAGEMENT_ROLES.includes(profile?.role || '');
  const canManageUsers = USER_ADMIN_ROLES.includes(profile?.role || '');

  const pages: { [key: string]: any } = {
    dashboard: <div className="page-content"><h2>Dashboard</h2><p>Overview coming soon...</p></div>,
    staff: <StaffPage />,
    roster: <RosterPage />,
    leave: <LeavePage />,
    holidays: <HolidaysPage />,
    users: <UsersPage />,
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
            className={currentPage === 'holidays' ? 'nav-item active' : 'nav-item'}
            onClick={() => setCurrentPage('holidays')}
          >
            🎉 Holidays
          </button>

          <button
            className={currentPage === 'overtime' ? 'nav-item active' : 'nav-item'}
            onClick={() => setCurrentPage('overtime')}
          >
            ⏰ Overtime
          </button>

          {canManageUsers && (
            <button
              className={currentPage === 'users' ? 'nav-item active' : 'nav-item'}
              onClick={() => setCurrentPage('users')}
            >
              🔑 Users
            </button>
          )}

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