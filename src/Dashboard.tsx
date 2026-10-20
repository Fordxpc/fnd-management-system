import { useState } from 'react';
import { useAuth } from './auth';
import './Dashboard.css';
import StaffPage from './pages/StaffPage';
import RosterPage from './pages/RosterPage';
import LeavePage from './pages/LeavePage';
import HolidaysPage from './pages/HolidaysPage';
import OvertimePage from './pages/OvertimePage';
import UsersPage from './pages/UsersPage';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import FlightsPage from './pages/FlightsPage';
import OpsBoardPage from './pages/OpsBoardPage';
import ChangePasswordModal from './pages/ChangePasswordModal';

const MANAGEMENT_ROLES = ['developer', 'manager', 'owner', 'admin', 'smt'];
const USER_ADMIN_ROLES = ['developer', 'manager'];

function Dashboard({ user, logout }: any) {
  const { profile } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);

  const isManagement = MANAGEMENT_ROLES.includes(profile?.role || '');
  const canManageUsers = USER_ADMIN_ROLES.includes(profile?.role || '');

  const navigate = (page: string) => setCurrentPage(page);

  const pages: { [key: string]: any } = {
    dashboard: <DashboardPage onNavigate={navigate} />,
    opsboard: <OpsBoardPage />,
    flights: <FlightsPage />,
    staff: <StaffPage />,
    roster: <RosterPage />,
    leave: <LeavePage />,
    overtime: <OvertimePage />,
    holidays: <HolidaysPage />,
    users: <UsersPage />,
    settings: <SettingsPage />,
  };

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Funadhoo Airport</h2>
          <p>Ops & Roster System</p>
        </div>

        <nav className="sidebar-nav" style={{ overflowY: 'auto' }}>
          {/* OVERVIEW */}
          <button className={currentPage === 'dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => setCurrentPage('dashboard')}>📊 Dashboard</button>
          
          {/* OPERATIONS HEADING (Clickable) */}
          <button className="sidebar-section-title" onClick={() => setCurrentPage('opsboard')}>
            Operations <span>›</span>
          </button>
          <button className={currentPage === 'opsboard' ? 'nav-item active' : 'nav-item'} onClick={() => setCurrentPage('opsboard')}>📋 Daily Ops Board</button>
          <button className={currentPage === 'flights' ? 'nav-item active' : 'nav-item'} onClick={() => setCurrentPage('flights')}>✈️ Flight Schedule</button>
          
          {/* ROSTER HEADING (Clickable) */}
          <button className="sidebar-section-title" onClick={() => setCurrentPage('roster')}>
            Roster & HR <span>›</span>
          </button>
          {isManagement && <button className={currentPage === 'staff' ? 'nav-item active' : 'nav-item'} onClick={() => setCurrentPage('staff')}>👥 Staff List</button>}
          <button className={currentPage === 'roster' ? 'nav-item active' : 'nav-item'} onClick={() => setCurrentPage('roster')}>📅 Duty Roster</button>
          <button className={currentPage === 'leave' ? 'nav-item active' : 'nav-item'} onClick={() => setCurrentPage('leave')}>🌴 Leave Requests</button>
          <button className={currentPage === 'overtime' ? 'nav-item active' : 'nav-item'} onClick={() => setCurrentPage('overtime')}>⏰ Overtime Sheet</button>
          
          {/* SYSTEM HEADING (Clickable) */}
          <button className="sidebar-section-title" onClick={() => setCurrentPage('settings')}>
            System <span>›</span>
          </button>
          <button className={currentPage === 'holidays' ? 'nav-item active' : 'nav-item'} onClick={() => setCurrentPage('holidays')}>🎉 Holidays</button>
          {canManageUsers && <button className={currentPage === 'users' ? 'nav-item active' : 'nav-item'} onClick={() => setCurrentPage('users')}>🔑 User Accounts</button>}
          <button className={currentPage === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => setCurrentPage('settings')}>⚙️ Settings</button>
        </nav>

        <div className="sidebar-footer">
          <p className="user-email">{user?.email}</p>
          <button className="change-pw-btn" onClick={() => setShowPasswordModal(true)}>🔐 Change Password</button>
          <button className="logout-btn" onClick={logout}>Log Out</button>
        </div>
      </aside>

      <main className="main-content">{pages[currentPage]}</main>

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </div>
  );
}

export default Dashboard;