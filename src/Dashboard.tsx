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
import FlightsPage from './pages/FlightsPage'; // NEW
import ChecklistPage from './pages/ChecklistPage'; // NEW
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
    flights: <FlightsPage />, // NEW
    checklist: <ChecklistPage />, // NEW
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
          <button className={currentPage === 'dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => setCurrentPage('dashboard')}>📊 Dashboard</button>
          <button className={currentPage === 'flights' ? 'nav-item active' : 'nav-item'} onClick={() => setCurrentPage('flights')}>✈️ Flights</button>
          <button className={currentPage === 'checklist' ? 'nav-item active' : 'nav-item'} onClick={() => setCurrentPage('checklist')}>📋 Ops Checks</button>
          
          <div style={{ height: '1px', background: '#1e293b', margin: '8px 0' }}></div>

          {isManagement && <button className={currentPage === 'staff' ? 'nav-item active' : 'nav-item'} onClick={() => setCurrentPage('staff')}>👥 Staff</button>}
          <button className={currentPage === 'roster' ? 'nav-item active' : 'nav-item'} onClick={() => setCurrentPage('roster')}>📅 Duty Roster</button>
          <button className={currentPage === 'leave' ? 'nav-item active' : 'nav-item'} onClick={() => setCurrentPage('leave')}>🌴 Leave</button>
          <button className={currentPage === 'overtime' ? 'nav-item active' : 'nav-item'} onClick={() => setCurrentPage('overtime')}>⏰ Overtime</button>
          
          <div style={{ height: '1px', background: '#1e293b', margin: '8px 0' }}></div>
          
          <button className={currentPage === 'holidays' ? 'nav-item active' : 'nav-item'} onClick={() => setCurrentPage('holidays')}>🎉 Holidays</button>
          {canManageUsers && <button className={currentPage === 'users' ? 'nav-item active' : 'nav-item'} onClick={() => setCurrentPage('users')}>🔑 Users</button>}
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