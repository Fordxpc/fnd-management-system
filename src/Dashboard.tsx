import { lazy, Suspense, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './auth';
import './Dashboard.css';
import './styles/notifications.css';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const StaffPage = lazy(() => import('./pages/StaffPage'));
const RosterPage = lazy(() => import('./pages/RosterPage'));
const LeavePage = lazy(() => import('./pages/LeavePage'));
const ResignationsPage = lazy(() => import('./pages/ResignationsPage'));
const HolidaysPage = lazy(() => import('./pages/HolidaysPage'));
const OvertimePage = lazy(() => import('./pages/OvertimePage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const FlightsPage = lazy(() => import('./pages/FlightsPage'));
const OpsBoardPage = lazy(() => import('./pages/OpsBoardPage'));
const RampCheckSheetPage = lazy(() => import('./pages/RampCheckSheetPage'));
const WildlifePage = lazy(() => import('./pages/WildlifePage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const ManagerReportsPage = lazy(() => import('./pages/ManagerReportsPage'));
const RWYLightsPage = lazy(() => import('./pages/RWYLightsPage'));
const ConversationsPage = lazy(() => import('./pages/ConversationsPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const AnnouncementsPage = lazy(() => import('./pages/AnnouncementsPage'));

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
  managerReports: 'Management reports',
  staff: 'Staff directory',
  roster: 'Duty roster',
  leave: 'Leave requests',
  resignations: 'Resignations',
  overtime: 'Overtime sheet',
  holidays: 'Airport holidays',
  announcements: 'Announcements',
  users: 'User accounts',
  settings: 'System settings',
  conversations: 'Conversations',
  notifications: 'Notifications',
};

function Dashboard() {
  const { profile, logout } = useAuth();
  const requestedPage = new URLSearchParams(window.location.search).get('page');
  const initialPage = ['rampcheck', 'notifications', 'dashboard'].includes(String(requestedPage || '')) ? String(requestedPage) : 'dashboard';
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [activeModule, setActiveModule] = useState<Module>(initialPage === 'rampcheck' ? 'operations' : initialPage === 'notifications' ? 'system' : 'dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationUnread, setNotificationUnread] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch('/api/notifications', { credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json();
        if (active) setNotificationUnread(Number(data.unread || 0));
      } catch { /* offline: retain latest count */ }
    };
    const updated = (event: Event) => {
      const detail = (event as CustomEvent<number>).detail;
      if (active && typeof detail === 'number') setNotificationUnread(detail);
      else void refresh();
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30_000);
    window.addEventListener('fnd-notifications-updated', updated);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener('fnd-notifications-updated', updated); };
  }, []);

  const role = (profile?.role || '').toLowerCase();
  const isDev = role === 'developer';
  const isManager = ['manager', 'admin', 'owner'].includes(role);
  const isSMT = role === 'smt' || profile?.isSMT === true;
  const hasFullAccess = isDev || isManager;
  const hasSpecialOps = profile?.specialOpsAccess === true;

  const canManageUsers = hasFullAccess;
  const canSeeOpsBoard = hasFullAccess || isSMT || hasSpecialOps || profile?.department === "Safety" || profile?.opsBoardViewAccess === true || profile?.opsBoardEditAccess === true;
  const canSeeFlights = hasFullAccess || isSMT || hasSpecialOps || profile?.flightsViewAccess === true || profile?.flightsEditAccess === true;
  const canSeeRampCheck = hasFullAccess || isSMT || hasSpecialOps || profile?.rampsheetViewAccess === true || profile?.rampsheetEditAccess === true;
  const canSeeStaffList = hasFullAccess || isSMT || profile?.isIncharge === true;
  const canSeeReports = hasFullAccess || isSMT || profile?.reportsViewAccess === true || profile?.reportsEditAccess === true;
  const canSeeWildlife = hasFullAccess || isSMT || hasSpecialOps || profile?.birdCountViewAccess === true || profile?.birdCountEditAccess === true;
  const canSeeLights = hasFullAccess || isSMT || hasSpecialOps || profile?.rwyLightViewAccess === true || profile?.rwyLightEditAccess === true;

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
      ...(canSeeFlights ? [{ id: 'flights', label: 'Flight Schedule', shortLabel: 'FS' }] : []),
      ...(canSeeRampCheck ? [{ id: 'rampcheck', label: 'Flight Operation', shortLabel: 'FO' }] : []),
      ...(canSeeWildlife ? [{ id: 'wildlife', label: 'Wildlife', shortLabel: 'WH' }] : []),
      ...(canSeeLights ? [{ id: 'lights', label: 'RWY Lights', shortLabel: 'RL' }] : []),
    ],
    reports: canSeeReports ? [{ id: 'reports', label: 'Analytics & Reports', shortLabel: 'AR' }, ...(hasFullAccess ? [{ id: 'managerReports', label: 'Management Summary', shortLabel: 'MS' }] : [])] : [],
    roster: [
      ...(canSeeStaffList ? [{ id: 'staff', label: 'Staff List', shortLabel: 'SL' }] : []),
      { id: 'roster', label: 'Duty Roster', shortLabel: 'DR' },
      { id: 'leave', label: 'Leave Requests', shortLabel: 'LR' },
      { id: 'resignations', label: 'Resignations', shortLabel: 'RS' },
      { id: 'overtime', label: 'Overtime', shortLabel: 'OT' },
    ],
    system: [
      { id: 'announcements', label: 'Announcements', shortLabel: 'AN' },
      { id: 'holidays', label: 'Holidays', shortLabel: 'HD' },
      ...(canManageUsers ? [{ id: 'users', label: 'User Accounts', shortLabel: 'UA' }] : []),
      { id: 'notifications', label: 'Notifications', shortLabel: 'NT' },
      { id: 'settings', label: 'Settings', shortLabel: 'ST' },
    ],
    chat: [{ id: 'conversations', label: 'Group channels', shortLabel: 'CH' }],
  };

  const pages: Record<string, ReactNode> = {
    dashboard: <DashboardPage onNavigate={navigate} />,
    opsboard: <OpsBoardPage />,
    flights: <FlightsPage />,
    rampcheck: <RampCheckSheetPage />,
    wildlife: <WildlifePage />,
    lights: <RWYLightsPage />,
    reports: <ReportsPage />,
    managerReports: hasFullAccess ? <ManagerReportsPage /> : <div className="empty-state">Access denied</div>,
    staff: <StaffPage />,
    roster: <RosterPage />,
    leave: <LeavePage />,
    resignations: <ResignationsPage />,
    overtime: <OvertimePage />,
    announcements: <AnnouncementsPage />,
    holidays: <HolidaysPage />,
    users: <UsersPage />,
    settings: <SettingsPage />,
    conversations: <ConversationsPage />,
    notifications: <NotificationsPage onNavigate={navigate} />,
  };

  function navigate(page: string) {
    setCurrentPage(page);
    setMobileNavOpen(false);

    if (page === 'dashboard') setActiveModule('dashboard');
    else if (['opsboard', 'flights', 'rampcheck', 'wildlife', 'lights'].includes(page)) setActiveModule('operations');
    else if (['reports','managerReports'].includes(page)) setActiveModule('reports');
    else if (['staff', 'roster', 'leave', 'resignations', 'overtime'].includes(page)) setActiveModule('roster');
    else if (['announcements', 'holidays', 'users', 'settings', 'notifications'].includes(page)) setActiveModule('system');
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

          <button type="button" className="app-alert-button" onClick={() => navigate('notifications')}
            aria-label={notificationUnread > 0 ? `${notificationUnread} unread notifications` : 'Notifications'}>
            <span aria-hidden="true">🔔</span> Alerts
            {notificationUnread > 0 && <span className="app-alert-count">{notificationUnread > 99 ? '99+' : notificationUnread}</span>}
          </button>
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
          <Suspense fallback={<div className="module-loading"><span /><strong>Loading workspace…</strong></div>}>
            {pages[currentPage] || <div className="empty-state">Access denied</div>}
          </Suspense>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;