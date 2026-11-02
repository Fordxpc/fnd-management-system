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
import WildlifePage from './pages/WildlifePage';
import ReportsPage from './pages/ReportsPage';
import RWYLightsPage from './pages/RWYLightsPage';
import ConversationsPage from './pages/ConversationsPage';

type Module = 'dashboard' | 'operations' | 'roster' | 'reports' | 'system' | 'chat';

function Dashboard(_props: any) {
  const { profile, lightsInspectors, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [activeModule, setActiveModule] = useState<Module>('dashboard');

  const isDev = profile?.role === 'developer';
  const isManager = profile?.role === 'manager' || profile?.role === 'admin';
  const isSMT = profile?.role === 'smt' || profile?.isSMT === true;
  const isAdmin = profile?.role === 'admin';
  const dept = (profile?.department || '').toLowerCase();
  
  const isStaff = !isDev && !isManager && !isSMT && profile?.role !== 'owner' && !isAdmin;
  const isOpsOrMaintenanceOrSafety = dept === 'ground operations' || dept === 'maintenance' || dept === 'safety';
  const canManageUsers = isDev || isManager || isAdmin;
  
  const canSeeOpsBoard = isDev || isSMT || profile?.opsBoardViewAccess === true;
  const canSeeRampCheck = isDev || isManager || isAdmin || isSMT || profile?.rampsheetViewAccess === true;
  const canSeeStaffList = isDev || isManager || isAdmin || isSMT;
  
  const canSeeReports = !isStaff; 
  const canSeeWildlife = isDev || isManager || isAdmin || isSMT || profile?.birdCountViewAccess === true;
  
  const myStaffId = profile?.id; 
  const isLightsInspector = lightsInspectors.some((i: any) => 
    i.staffName.toLowerCase() === (profile?.name || '').toLowerCase() || i.staffId === myStaffId
  );
  const isGroundOpsSMT = isSMT && dept === 'ground operations';
  const canSeeLights = isDev || isManager || isAdmin || isSMT || isLightsInspector || isGroundOpsSMT || profile?.rwyLightViewAccess === true;

  const navigate = (page: string) => {
    setCurrentPage(page);
    if (page === 'dashboard') setActiveModule('dashboard');
    else if (['opsboard', 'flights', 'rampcheck', 'wildlife', 'lights'].includes(page)) setActiveModule('operations');
    else if (['staff', 'roster', 'leave', 'overtime'].includes(page)) setActiveModule('roster');
    else if (['reports'].includes(page)) setActiveModule('reports');
    else if (['holidays', 'users', 'settings'].includes(page)) setActiveModule('system');
    else if (page === 'conversations') setActiveModule('chat');
  };

  const pages: { [key: string]: any } = {
    dashboard: <DashboardPage onNavigate={navigate} />,
    opsboard: <OpsBoardPage />,
    flights: <FlightsPage />,
    rampcheck: <RampCheckSheetPage />,
    wildlife: <WildlifePage />,
    lights: <RWYLightsPage />,
    reports: <ReportsPage />,
    staff: <StaffPage />,
    roster: <RosterPage />,
    leave: <LeavePage />,
    overtime: <OvertimePage />,
    holidays: <HolidaysPage />,
    users: <UsersPage />,
    settings: <SettingsPage />,
    conversations: <ConversationsPage />,
  };

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <nav className="sidebar-nav">
          {activeModule === 'operations' && (
            <>
              <div className="sidebar-section-title">Operations</div>
              {canSeeOpsBoard && <button className={currentPage === 'opsboard' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('opsboard')}>📋 Daily Ops Board</button>}
              <button className={currentPage === 'flights' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('flights')}>✈️ Flight Schedule</button>
              {canSeeRampCheck && <button className={currentPage === 'rampcheck' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('rampcheck')}>✈️ Flight Operation</button>}
              {canSeeWildlife && <button className={currentPage === 'wildlife' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('wildlife')}>🦅 Wildlife & Bird Strike</button>}
              {canSeeLights && <button className={currentPage === 'lights' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('lights')}>🚨 RWY Lights</button>}
            </>
          )}

          {activeModule === 'reports' && (
            <>
              <div className="sidebar-section-title">Reports</div>
              {canSeeReports && <button className={currentPage === 'reports' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('reports')}>📊 Analytics & Reports</button>}
            </>
          )}

          {activeModule === 'roster' && (
            <>
              <div className="sidebar-section-title">Roster & HR</div>
              {canSeeStaffList && <button className={currentPage === 'staff' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('staff')}>👥 Staff List</button>}
              <button className={currentPage === 'roster' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('roster')}>📅 Duty Roster</button>
              <button className={currentPage === 'leave' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('leave')}>🌴 Leave Requests</button>
              <button className={currentPage === 'overtime' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('overtime')}>⏰ Overtime Sheet</button>
            </>
          )}

          {activeModule === 'system' && (
            <>
              <div className="sidebar-section-title">System & Setting</div>
              <button className={currentPage === 'holidays' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('holidays')}>🎉 Holidays</button>
              {canManageUsers && <button className={currentPage === 'users' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('users')}>🔑 User Accounts</button>}
              <button className={currentPage === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('settings')}>⚙️ Settings</button>
            </>
          )}

          {activeModule === 'dashboard' && (
            <>
              <div className="sidebar-section-title">Overview</div>
              <button className="nav-item active" onClick={() => navigate('dashboard')}>📊 Dashboard</button>
            </>
          )}

          {activeModule === 'chat' && (
            <>
              <div className="sidebar-section-title">Chat</div>
              <button className="nav-item active" onClick={() => navigate('conversations')}>💬 Conversations</button>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
           <button className="logout-btn" onClick={logout}>Log Out</button>
        </div>
      </aside>

      <main className="main-content">
        <div className="main-app-header">
          <h1>Funadhoo Airport</h1>
          <p>Ops & Roster System</p>
        </div>

        <div className="top-tabs-container">
          <button className={`top-tab ${activeModule === 'dashboard' ? 'active' : ''}`} onClick={() => navigate('dashboard')}>📊 Dashboard</button>
          {(canSeeOpsBoard || canSeeRampCheck) && <button className={`top-tab ${activeModule === 'operations' ? 'active' : ''}`} onClick={() => navigate(canSeeOpsBoard ? 'opsboard' : 'rampcheck')}>✈️ Operations</button>}
          {canSeeReports && <button className={`top-tab ${activeModule === 'reports' ? 'active' : ''}`} onClick={() => navigate('reports')}>📈 Reports</button>}
          <button className={`top-tab ${activeModule === 'roster' ? 'active' : ''}`} onClick={() => navigate('roster')}>📅 Roster & HR</button>
          <button className={`top-tab ${activeModule === 'system' ? 'active' : ''}`} onClick={() => navigate('settings')}>⚙️ System</button>
          <button className={`top-tab ${activeModule === 'chat' ? 'active' : ''}`} onClick={() => navigate('conversations')}>💬 Conversations</button>
        </div>

        <div className="page-wrapper">
          {pages[currentPage] || <div className="empty-state">Access Denied</div>}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;