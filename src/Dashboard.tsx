import { useState } from 'react';
import type { ReactNode } from 'react';
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

type Module = 'dashboard' | 'operations' | 'reports' | 'roster' | 'system' | 'chat';

type NavigationItem = {
  id: string;
  label: string;
  shortLabel: string;
};

const MODULE_DEFAULTS: Record<Module, string> = {
  dashboard: 'dashboard',
  operations: 'opsboard',
  reports: 'reports',
  roster: 'roster',
  system: 'settings',
  chat: 'conversations',
};

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Airport overview',
  opsboard: 'Daily operations board',
  flights: 'Flight schedule',
  rampcheck: 'Flight operation',
  wildlife: 'Wildlife and bird hazard',
  lights: 'Runway lights',
  reports: 'Analytics and reports',
  staff: 'Staff directory',
  roster: 'Duty roster',
  leave: 'Leave requests',
  overtime: 'Overtime sheet',
  holidays: 'Airport holidays',
  users: 'User accounts',
  settings: 'System settings',
  conversations: 'Conversations',
};

function Dashboard() {
  const { profile, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [activeModule, setActiveModule] = useState<Module>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const role = (profile?.role || '').toLowerCase();
  const department = (profile?.department || '').toLowerCase();
  const isDev = role === 'developer';
  const isManager = ['manager', 'admin', 'owner'].includes(role);
  const isSMT = role === 'smt' || profile?.isSMT === true;
  const isStaff = !isDev && !isManager && !isSMT;
  const isOperationalDepartment = ['ground operations', 'maintenance', 'safety'].includes(department);

  const canManageUsers = isDev || isManager;
  const canSeeOpsBoard = isDev || isManager || isSMT || isOperationalDepartment;
  const canSeeRampCheck = isDev || isManager || isSMT;
  const canSeeStaffList = isDev || isManager || isSMT;
  const canSeeReports = !isStaff;
  const canSeeWildlife = !isStaff;
  const canSeeLights = isDev || isManager || isSMT;

  const moduleItems: Array<{ id: Module; label: string; shortLabel: string }> = [
    { id: 'dashboard', label: 'Dashboard', shortLabel: 'DB' },
    { id: 'operations', label: 'Operations', shortLabel: 'OP' },
    ...(canSeeReports ? [{ id: 'reports' as Module, label: 'Reports', shortLabel: 'RP' }] : []),
    { id: 'roster', label: 'Roster & HR', shortLabel: 'HR' },
    { id: 'system', label: 'System', shortLabel: 'SY' },
    { id: 'chat', label: 'Conversations', shortLabel: 'CH' },
  ];

  const subNavigation: Record<Module, NavigationItem[]> = {
    dashboard: [{ id: 'dashboard', label: 'Overview', shortLabel: 'OV' }],
    operations: [
      ...(canSeeOpsBoard ? [{ id: 'opsboard', label: 'Daily Ops Board', shortLabel: 'DO' }] : []),
      { id: 'flights', label: 'Flight Schedule', shortLabel: 'FS' },
      ...(canSeeRampCheck ? [{ id: 'rampcheck', label: 'Flight Operation', shortLabel: 'FO' }] : []),
      ...(canSeeWildlife ? [{ id: 'wildlife', label: 'Wildlife', shortLabel: 'WH' }] : []),
      ...(canSeeLights ? [{ id: 'lights', label: 'RWY Lights', shortLabel: 'RL' }] : []),
    ],
    reports: canSeeReports ? [{ id: 'reports', label: 'Analytics & Reports', shortLabel: 'AR' }] : [],
    roster: [
      ...(canSeeStaffList ? [{ id: 'staff', label: 'Staff List', shortLabel: 'SL' }] : []),
      { id: 'roster', label: 'Duty Roster', shortLabel: 'DR' },
      { id: 'leave', label: 'Leave Requests', shortLabel: 'LR' },
      { id: 'overtime', label: 'Overtime', shortLabel: 'OT' },
    ],
    system: [
      { id: 'holidays', label: 'Holidays', shortLabel: 'HD' },
      ...(canManageUsers ? [{ id: 'users', label: 'User Accounts', shortLabel: 'UA' }] : []),
      { id: 'settings', label: 'Settings', shortLabel: 'ST' },
    ],
    chat: [{ id: 'conversations', label: 'Conversations', shortLabel: 'CH' }],
  };

  const pages: Record<string, ReactNode> = {
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

  function navigate(page: string) {
    setCurrentPage(page);
    setMobileNavOpen(false);

    if (page === 'dashboard') setActiveModule('dashboard');
    else if (['opsboard', 'flights', 'rampcheck', 'wildlife', 'lights'].includes(page)) setActiveModule('operations');
    else if (page === 'reports') setActiveModule('reports');
    else if (['staff', 'roster', 'leave', 'overtime'].includes(page)) setActiveModule('roster');
    else if (['holidays', 'users', 'settings'].includes(page)) setActiveModule('system');
    else if (page === 'conversations') setActiveModule('chat');
  }

  function navigateModule(module: Module) {
    const availablePages = subNavigation[module];
    const preferredPage = MODULE_DEFAULTS[module];
    const targetPage = availablePages.some((item) => item.id === preferredPage)
      ? preferredPage
      : availablePages[0]?.id;

    setActiveModule(module);
    if (targetPage) setCurrentPage(targetPage);
    setMobileNavOpen(false);
  }

  const displayName = profile?.name || profile?.email?.split('@')[0] || 'Airport user';
  const displayRole = role ? role.toUpperCase() : 'STAFF';
  const displayDepartment = profile?.department || 'Funadhoo Airport';

  return (
    <div className="app-shell">
      <aside className={`app-sidebar ${mobileNavOpen ? 'open' : ''}`} aria-label="Primary navigation">
        <div className="app-brand">
          <div className="app-brand-mark" aria-hidden="true">FND</div>
          <div>
            <strong>Funadhoo Airport</strong>
            <span>Management System</span>
          </div>
        </div>

        <div className="app-sidebar-label">Workspace</div>
        <nav className="app-module-nav">
          {moduleItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`app-module-button ${activeModule === item.id ? 'active' : ''}`}
              onClick={() => navigateModule(item.id)}
            >
              <span className="app-nav-icon" aria-hidden="true">{item.shortLabel}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="app-sidebar-profile">
          <div className="app-avatar" aria-hidden="true">
            {String(displayName).slice(0, 2).toUpperCase()}
          </div>
          <div className="app-profile-copy">
            <strong>{displayName}</strong>
            <span>{displayRole} · {displayDepartment}</span>
          </div>
          <button type="button" className="app-signout-button" onClick={logout}>Sign out</button>
        </div>
      </aside>

      {mobileNavOpen && (
        <button
          type="button"
          className="app-nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <main className="app-main">
        <header className="app-topbar">
          <button
            type="button"
            className="app-menu-button"
            aria-label="Open navigation"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(true)}
          >
            <span />
            <span />
            <span />
          </button>

          <div className="app-page-heading">
            <span>{moduleItems.find((item) => item.id === activeModule)?.label}</span>
            <h1>{PAGE_TITLES[currentPage] || 'Funadhoo Airport'}</h1>
          </div>

          <div className="app-system-status">
            <span className="app-status-dot" aria-hidden="true" />
            System online
          </div>
        </header>

        <nav className="app-subnav" aria-label="Section navigation">
          {subNavigation[activeModule].map((item) => (
            <button
              key={item.id}
              type="button"
              className={currentPage === item.id ? 'active' : ''}
              onClick={() => navigate(item.id)}
            >
              <span aria-hidden="true">{item.shortLabel}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="app-page">
          {pages[currentPage] || <div className="empty-state">Access denied</div>}
        </div>
      </main>
    </div>
  );
}

export default Dashboard;