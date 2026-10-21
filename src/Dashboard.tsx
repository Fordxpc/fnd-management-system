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
import RampCheckSheetPage from './pages/RampCheckSheetPage';
import ChangePasswordModal from './pages/ChangePasswordModal';

const MANAGEMENT_ROLES = ['developer', 'manager', 'owner', 'admin', 'smt'];
const USER_ADMIN_ROLES = ['developer', 'manager'];

function Dashboard({ user, logout }: any) {
  const { profile } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [activeModule, setActiveModule] = useState<'operations' | 'roster' | 'system'>('operations');
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);

  const isManagement = MANAGEMENT_ROLES.includes(profile?.role || '');
  const canManageUsers = USER_ADMIN_ROLES.includes(profile?.role || '');

  const navigate = (page: string) => {
    setCurrentPage(page);
    if (['opsboard', 'flights', 'rampcheck'].includes(page)) setActiveModule('operations');
    else if (['staff', 'roster', 'leave', 'overtime'].includes(page)) setActiveModule('roster');
    else if (['holidays', 'users', 'settings'].includes(page)) setActiveModule('system');
  };

  const pages: { [key: string]: any } = {
    dashboard: <DashboardPage onNavigate={navigate} />,
    opsboard: <OpsBoardPage />,
    flights: <FlightsPage />,
    rampcheck: <RampCheckSheetPage />,
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

        <nav className="sidebar-nav">
          <button className={currentPage === 'dashboard' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('dashboard')}>📊 Dashboard</button>
          
          {activeModule === 'operations' && (
            <>
              <div className="sidebar-section-title">Operations</div>
              <button className={currentPage === 'opsboard' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('opsboard')}>📋 Daily Ops Board</button>
              <button className={currentPage === 'flights' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('flights')}>✈️ Flight Schedule</button>
              <button className={currentPage === 'rampcheck' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('rampcheck')}>✈️ Flight Operation</button>
            </>
          )}

          {activeModule === 'roster' && (
            <>
              <div className="sidebar-section-title">Roster & HR</div>
              {isManagement && <button className={currentPage === 'staff' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('staff')}>👥 Staff List</button>}
              <button className={currentPage === 'roster' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('roster')}>📅 Duty Roster</button>
              <button className={currentPage === 'leave' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('leave')}>🌴 Leave Requests</button>
              <button className={currentPage === 'overtime' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('overtime')}>⏰ Overtime Sheet</button>
            </>
          )}

          {activeModule === 'system' && (
            <>
              <div className="sidebar-section-title">System</div>
              <button className={currentPage === 'holidays' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('holidays')}>🎉 Holidays</button>
              {canManageUsers && <button className={currentPage === 'users' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('users')}>🔑 User Accounts</button>}
              <button className={currentPage === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('settings')}>⚙️ Settings</button>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <p className="user-email">{user?.email}</p>
          <button className="change-pw-btn" onClick={() => setShowPasswordModal(true)}>🔐 Change Password</button>
          <button className="logout-btn" onClick={logout}>Log Out</button>
        </div>
      </aside>

      <main className="main-content">
        <div className="top-tabs-container">
          <button 
            className={`top-tab ${activeModule === 'operations' ? 'active' : ''}`}
            onClick={() => { setActiveModule('operations'); navigate('opsboard'); }}
          >
            ✈️ Operations
          </button>
          <button 
            className={`top-tab ${activeModule === 'roster' ? 'active' : ''}`}
            onClick={() => { setActiveModule('roster'); navigate('roster'); }}
          >
            📅 Roster & HR
          </button>
          <button 
            className={`top-tab ${activeModule === 'system' ? 'active' : ''}`}
            onClick={() => { setActiveModule('system'); navigate('settings'); }}
          >
            ⚙️ System
          </button>
        </div>

        <div className="page-wrapper">
          {pages[currentPage]}
        </div>
      </main>

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </div>
  );
}

export default Dashboard;