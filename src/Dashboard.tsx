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
import MigrationTool from './pages/MigrationTool'; // <-- IMPORT IS BACK

const MANAGEMENT_ROLES = ['developer', 'manager', 'owner', 'admin', 'smt'];
const USER_ADMIN_ROLES = ['developer', 'manager'];

type Module = 'dashboard' | 'operations' | 'roster' | 'reports' | 'system';

function Dashboard(_props: any) {
  const { profile } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [activeModule, setActiveModule] = useState<Module>('dashboard');

  const isDev = profile?.role === 'developer';
  const isManager = profile?.role === 'manager';
  const isSMT = profile?.role === 'smt' || profile?.isSMT === true;
  const dept = profile?.department || '';
  
  const isStaff = !isDev && !isManager && !isSMT && profile?.role !== 'owner' && profile?.role !== 'admin';
  const isOpsOrSafety = dept === 'Ground Operations' || dept === 'Safety';
  const canManageUsers = isDev || isManager;
  
  const canSeeOpsBoard = isDev || isManager || isSMT || isOpsOrSafety;
  const canSeeRampCheck = isDev || isManager || isSMT;
  const canSeeStaffList = isDev || isManager || isSMT;
  
  const canSeeReports = !isStaff; 
  const canSeeWildlife = !isStaff;

  const navigate = (page: string) => {
    setCurrentPage(page);
    if (page === 'dashboard') setActiveModule('dashboard');
    else if (['opsboard', 'flights', 'rampcheck', 'wildlife'].includes(page)) setActiveModule('operations');
    else if (['staff', 'roster', 'leave', 'overtime'].includes(page)) setActiveModule('roster');
    else if (['reports'].includes(page)) setActiveModule('reports');
    else if (['holidays', 'users', 'settings', 'migration'].includes(page)) setActiveModule('system');
  };

  const pages: { [key: string]: any } = {
    dashboard: <DashboardPage onNavigate={navigate} />,
    migration: <MigrationTool />, // <-- ROUTE IS BACK
    opsboard: <OpsBoardPage />,
    flights: <FlightsPage />,
    rampcheck: <RampCheckSheetPage />,
    wildlife: <WildlifePage />,
    reports: <ReportsPage />,
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
        <nav className="sidebar-nav">
          {activeModule === 'operations' && (
            <>
              <div className="sidebar-section-title">Operations</div>
              {canSeeOpsBoard && <button className={currentPage === 'opsboard' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('opsboard')}>📋 Daily Ops Board</button>}
              <button className={currentPage === 'flights' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('flights')}>✈️ Flight Schedule</button>
              {canSeeRampCheck && <button className={currentPage === 'rampcheck' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('rampcheck')}>✈️ Flight Operation</button>}
              {canSeeWildlife && <button className={currentPage === 'wildlife' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('wildlife')}>🦅 Wildlife & Bird Strike</button>}
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
              
              {/* MIGRATION BUTTON IS BACK */}
              <button className={currentPage === 'migration' ? 'nav-item active' : 'nav-item'} onClick={() => navigate('migration')} style={{ background: '#8b5cf6', color: 'white', marginBottom: '8px' }}>🚀 Migration Tool</button>
              
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
        </nav>
      </aside>

      <main className="main-content">
        <div className="main-app-header">
          <h1>Funadhoo Airport</h1>
          <p>Ops & Roster System</p>
        </div>

        <div className="top-tabs-container">
          <button className={`top-tab ${activeModule === 'dashboard' ? 'active' : ''}`} onClick={() => navigate('dashboard')}>📊 Dashboard</button>
          
          {canSeeOpsBoard && (
            <button className={`top-tab ${activeModule === 'operations' ? 'active' : ''}`} onClick={() => navigate('opsboard')}>✈️ Operations</button>
          )}

          {canSeeReports && (
            <button className={`top-tab ${activeModule === 'reports' ? 'active' : ''}`} onClick={() => navigate('reports')}>📈 Reports</button>
          )}

          <button className={`top-tab ${activeModule === 'roster' ? 'active' : ''}`} onClick={() => navigate('roster')}>📅 Roster & HR</button>
          
          <button className={`top-tab ${activeModule === 'system' ? 'active' : ''}`} onClick={() => navigate('settings')}>⚙️ System</button>
        </div>

        <div className="page-wrapper">
          {pages[currentPage] || <div className="empty-state">Access Denied</div>}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;