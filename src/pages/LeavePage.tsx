import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import { ConfirmDialog, PromptDialog } from '../components/Dialogs';

const LEAVE_TYPES = ['ANNUAL LEAVE', 'SICK LEAVE', 'SICK LEAVE / MC', 'NO PAY LEAVE', 'ABSENT', 'PATERNITY LEAVE', 'MATERNITY LEAVE', 'PRE-MATERNITY LEAVE', 'FAMILY RESPONSIBILITY LEAVE (FRL)', 'DUTY TRAVEL'];
const ENTITLEMENTS: { [key: string]: number } = { 'ANNUAL LEAVE': 30, 'SICK LEAVE': 15, 'SICK LEAVE / MC': 15, 'FAMILY RESPONSIBILITY LEAVE (FRL)': 10, 'PRE-MATERNITY LEAVE': 15, 'MATERNITY LEAVE': 180, 'PATERNITY LEAVE': 30, 'NO PAY LEAVE': 365, 'DUTY TRAVEL': 0, 'ABSENT': 0 };
const FEMALE_ONLY = ['PRE-MATERNITY LEAVE', 'MATERNITY LEAVE'];
const MALE_ONLY = ['PATERNITY LEAVE'];
const ANNUAL_LEAVE_SERVICE_YEARS = 2;
const ANNUAL_LEAVE_TOTAL = 30;
const FORM_DEPARTMENTS = ['Ground Operations', 'Maintenance', 'Security', 'Fire & Rescue', 'Administration', 'Safety'];
const selectStyle = { padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', color: '#1e293b', backgroundColor: '#ffffff' };
const INITIAL_DATE = new Date().toISOString().split('T')[0];

const formatDate = (date: Date): string => { const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; };
const formatDisplay = (dateStr: string): string => { if (!dateStr) return ''; const parts = dateStr.split('-'); return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr; };
const isFriday = (dateStr: string): boolean => new Date(dateStr + 'T00:00:00').getDay() === 5;
const allDatesInRange = (start: string, end: string): string[] => { const dates: string[] = []; const s = new Date(start + 'T00:00:00'); const e = new Date(end + 'T00:00:00'); if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return dates; const cur = new Date(s); while (cur <= e) { dates.push(formatDate(cur)); cur.setDate(cur.getDate() + 1); } return dates; };
const countAnnualLeaveDays = (start: string, end: string, holidayDates: Set<string>) => { const dates = allDatesInRange(start, end); let countable = 0, skippedFridays = 0, skippedHolidays = 0; for (const d of dates) { if (isFriday(d)) skippedFridays++; else if (holidayDates.has(d)) skippedHolidays++; else countable++; } return { countable, skippedFridays, skippedHolidays }; };
const getCurrentLeaveYear = (joinDateStr: string) => { if (!joinDateStr) return null; const jd = new Date(joinDateStr + 'T00:00:00'); if (isNaN(jd.getTime())) return null; const today = new Date(); today.setHours(0, 0, 0, 0); let startYear = today.getFullYear(); let anniversary = new Date(startYear, jd.getMonth(), jd.getDate()); if (today < anniversary) { startYear -= 1; anniversary = new Date(startYear, jd.getMonth(), jd.getDate()); } return { start: anniversary, end: new Date(startYear + 1, jd.getMonth(), jd.getDate() - 1) }; };
const getYearsOfService = (joinDateStr: string): number => { if (!joinDateStr) return 0; const jd = new Date(joinDateStr + 'T00:00:00'); if (isNaN(jd.getTime())) return 0; const today = new Date(); let years = today.getFullYear() - jd.getFullYear(); const m = today.getMonth() - jd.getMonth(); if (m < 0 || (m === 0 && today.getDate() < jd.getDate())) years -= 1; return years; };
const formatAuditDate = (value?: string) => value ? new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const getLeaveTypesForStaff = (staffMember: any): string[] => { const g = (staffMember?.gender || '').toLowerCase(); if (!g) return LEAVE_TYPES; return LEAVE_TYPES.filter((t) => { if (g === 'female' && MALE_ONLY.includes(t)) return false; if (g === 'male' && FEMALE_ONLY.includes(t)) return false; return true; }); };
const computeUsedDays = (staffId: string, joinDate: string, leaveType: string, requests: any[]): number => { if (!joinDate) return 0; const years = getYearsOfService(joinDate); const isAnnual = leaveType === 'ANNUAL LEAVE'; const renews = years >= ANNUAL_LEAVE_SERVICE_YEARS; let used = 0; const ly = getCurrentLeaveYear(joinDate); requests.filter((r: any) => r.staffId === staffId && r.status?.toLowerCase() === 'approved' && r.leaveType === leaveType).forEach((r: any) => { if (isAnnual && !renews) used += r.days || 0; else if (ly) { const lyStart = formatDate(ly.start); const lyEnd = formatDate(ly.end); if ((r.startDate || '') >= lyStart && (r.startDate || '') <= lyEnd) used += r.days || 0; } }); return used; };

function LeavePage() {
  const { profile, user } = useAuth();
  const isDev = profile?.role === 'developer';
  const isManager = profile?.role === 'manager' || profile?.role === 'admin' || profile?.role === 'owner';
  const isSMT = profile?.role === 'smt' || profile?.isSMT === true || profile?.isSmt === true;
  const accountIsStaff = !isDev && !isManager && !isSMT && profile?.role !== 'owner' && profile?.role !== 'admin';

  const [requests, setRequests] = useState<any[]>([]);
  const [myStaff, setMyStaff] = useState<any>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [tab, setTab] = useState<string>('pending');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [showMyBalance, setShowMyBalance] = useState<boolean>(true);
  const [showDeptBalances, setShowDeptBalances] = useState<boolean>(false); 
  const [balanceTab, setBalanceTab] = useState<'annual' | 'sick' | 'other'>('annual');
  const [showForm, setShowForm] = useState<boolean>(false);
  const [showRegister, setShowRegister] = useState<boolean>(true);
  const [selectedFormDept, setSelectedFormDept] = useState<string>('Ground Operations');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [leaveType, setLeaveType] = useState<string>('ANNUAL LEAVE');
  const [startDate, setStartDate] = useState<string>(INITIAL_DATE);
  const [endDate, setEndDate] = useState<string>(INITIAL_DATE);
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [approveTarget, setApproveTarget] = useState<any>(null);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [legacyRestoreDates, setLegacyRestoreDates] = useState<string[]>([]);
  const [legacyRestores, setLegacyRestores] = useState<Record<string, { status: string; shiftTime: string }>>({});
  const [integrityAudit, setIntegrityAudit] = useState<any>(null);
  const [integrityLoading, setIntegrityLoading] = useState(false);
  const [integrityVisible, setIntegrityVisible] = useState(false);

  const isDepartmentLead = isSMT || myStaff?.isSMT === true || myStaff?.isSmt === true || myStaff?.isIncharge === true;
  const isStaff = accountIsStaff && !isDepartmentLead;

  const fetchData = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const results = await Promise.allSettled([apiFetch('/staff'), apiFetch('/leave-requests'), apiFetch('/holidays')]);
      const getData = (index: number) => results[index].status === 'fulfilled' ? (results[index] as PromiseFulfilledResult<any>).value : [];
      const staffData = getData(0);
      const rawLeaveData = getData(1);
      const holidaysData = getData(2);
      const failedRequests = results.filter((result) => result.status === 'rejected').length;
      // Never conceal distinct/manual requests by collapsing identical date ranges client-side.
      const orderedLeaves = (Array.isArray(rawLeaveData) ? rawLeaveData : []).slice()
        .sort((a: any, b: any) => String(b.startDate || '').localeCompare(String(a.startDate || '')) ||
          String(b.requestedAt || '').localeCompare(String(a.requestedAt || '')));
      setStaffList(Array.isArray(staffData) ? staffData : []);
      setRequests(orderedLeaves);
      setHolidays(Array.isArray(holidaysData) ? holidaysData : []);
      setLoadError(failedRequests ? failedRequests + ' leave data source' + (failedRequests === 1 ? '' : 's') + ' could not be refreshed.' : '');
      const mine = (Array.isArray(staffData) ? staffData : []).find((member: any) => (member.email || '').toLowerCase() === (user?.email || '').toLowerCase());
      setMyStaff(mine || null);
      if (mine && !selectedStaffId) {
        setSelectedStaffId(mine.id);
        setSelectedFormDept(mine.department || 'Ground Operations');
      }
    } catch (err: any) {
      setLoadError(err.message || 'Leave information could not be loaded.');
      if (!quiet) toast.error(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, selectedStaffId]);

  useEffect(() => { const initialLoad = window.setTimeout(() => void fetchData(true), 0); const interval = window.setInterval(() => void fetchData(true), 10000); return () => { window.clearTimeout(initialLoad); window.clearInterval(interval); }; }, [fetchData]);

  const holidaySet = new Set<string>(holidays.map((h: any) => h.date));
  const canApproveAnyDept = isDev || isManager;
  const formDepartments = canApproveAnyDept ? FORM_DEPARTMENTS : [myStaff?.department || profile?.department || 'Ground Operations'];
  
  const canApproveThisDept = (dept: string, isSMTRequester: boolean = false) => {
    if (canApproveAnyDept) return true;
    
    const targetDept = (dept || '').trim().toLowerCase();
    const currentDept = (myStaff?.department || '').trim().toLowerCase();
    const isActuallySMT = isSMT || myStaff?.isSMT === true || myStaff?.isSmt === true;
    const isIncharge = myStaff?.isIncharge === true;
    

    // If requester is SMT, only Manager/Dev or Department Incharge can approve
    if (isSMTRequester) {
      if (isActuallySMT && isIncharge && currentDept === targetDept) return true;
      return false;
    }

    // If requester is standard staff, Dept Manager or Dept SMT can approve
    if (isActuallySMT && currentDept === targetDept) return true;

    return false;
  };

  const canSeeMyBalance = !isStaff || myStaff?.balanceVisible === true || isSMT || isManager;

  const canApproveRequest = (r: any): boolean => {
    if (r.staffId === myStaff?.id) return false; 
    return canApproveThisDept(r.staffDepartment, r.staffIsSMT);
  };

  const canDeleteRequest = (r: any): boolean => {
    if (isDev || isManager) return true;
    if (myStaff && r.staffId === myStaff.id) return true;
    if (canApproveRequest(r)) return true;
    return false;
  };

  // NEW: Hierarchy-based pre-filter
  let displayRequests = requests;
  if (!["developer", "manager", "admin", "owner"].includes((profile?.role || "").toLowerCase()) && !isSMT) {
    if (myStaff?.isIncharge) {
      displayRequests = requests.filter((r: any) => r.staffDepartment === myStaff.department);
    } else if (myStaff?.isSmt) {
      displayRequests = requests.filter((r: any) => r.staffDepartment === myStaff.department && r.staffIsSMT !== true);
    } else {
      displayRequests = requests.filter((r: any) => r.staffId === myStaff?.id);
    }
  }

  const visibleRequests = displayRequests.filter((r: any) => {
      if (isStaff) return myStaff && r.staffId === myStaff.id;
      if (filterDept !== 'all' && r.staffDepartment !== filterDept) return false;
      return true;
    })
    .filter((r: any) => {
      if (isStaff) return r.status?.toLowerCase() === 'approved' || r.status?.toLowerCase() === 'pending';
      if (tab === 'all') return true;
      return (r.status || '').toLowerCase() === tab;
    })
    .filter((r: any) => {
      const query = search.trim().toLowerCase();
      return !query || [r.staffName, r.staffSN, r.staffDepartment, r.leaveType, r.reason].some((value) => String(value || '').toLowerCase().includes(query));
    });

  const pendingCount = displayRequests.filter((request: any) => request.status?.toLowerCase() === 'pending').length;
  const approvedCount = displayRequests.filter((request: any) => request.status?.toLowerCase() === 'approved').length;
  const rejectedCount = displayRequests.filter((request: any) => request.status?.toLowerCase() === 'rejected').length;

  const myYearsOfService = myStaff?.joinDate ? getYearsOfService(myStaff.joinDate) : 0;
  const myIsAnnualRenewing = myYearsOfService >= ANNUAL_LEAVE_SERVICE_YEARS;
  const formStaffOptions = staffList.filter(s => s.department === selectedFormDept);
  const selectedStaff = staffList.find((s) => s.id === selectedStaffId);
  const allowedLeaveTypes = getLeaveTypesForStaff(selectedStaff || myStaff);
  const usedDays: { [key: string]: number } = {};
  LEAVE_TYPES.forEach((t) => { usedDays[t] = myStaff ? computeUsedDays(myStaff.id, myStaff.joinDate || '', t, requests) : 0; });
  
  const deptBalanceStaff = staffList.filter((s: any) => {
      if (s.isSMT === true || s.isSmt === true || s.department === 'Administration') return false;
      return canApproveThisDept(s.department, s.isSMT === true || s.isSmt === true);
    }).sort((a: any, b: any) => (a.sn || '').localeCompare(b.sn || ''));

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!selectedStaffId) { toast.error('Please select a staff member'); return; }
    if (endDate < startDate) { toast.error('End date cannot be before start date'); return; }
    const staffMemberToSubmit = staffList.find((s) => s.id === selectedStaffId);
    if (!staffMemberToSubmit) { toast.error('Staff member not found'); return; }
    const overlap = requests.some(r => r.staffId === selectedStaffId && r.status?.toLowerCase() === 'approved' && r.startDate <= endDate && r.endDate >= startDate);
    if (overlap) { toast.error('Overlaps with approved leave.'); return; }
    let days = leaveType === 'ANNUAL LEAVE' ? countAnnualLeaveDays(startDate, endDate, holidaySet).countable : allDatesInRange(startDate, endDate).length;
    if (days === 0) { toast.error('No countable days.'); return; }

    setSubmitting(true);
    try {
      await apiFetch('/leave-requests', { method: 'POST', body: JSON.stringify({ staffId: selectedStaffId, staffName: staffMemberToSubmit.name, staffDepartment: staffMemberToSubmit.department, staffSN: staffMemberToSubmit.sn || '', staffGender: staffMemberToSubmit.gender || '', staffIsSMT: staffMemberToSubmit.isSMT === true || staffMemberToSubmit.isSmt === true, leaveType, startDate, endDate, days, reason, requestedBy: user?.email || '' }) });
      toast.success(`Leave request submitted.`); setShowForm(false); setReason(''); fetchData();
    } catch (error: any) { toast.error('Error: ' + error.message); } finally { setSubmitting(false); }
  };

  // Read-only check: no leave or roster records are changed by this action.
  const runIntegrityAudit = async () => {
    setIntegrityVisible(true);
    setIntegrityLoading(true);
    try {
      setIntegrityAudit(await apiFetch('/leave-integrity'));
    } catch (error: any) {
      toast.error(`Could not complete integrity audit: ${error.message}`);
    } finally { setIntegrityLoading(false); }
  };

  const confirmApprove = async () => {
    if (!approveTarget) return;
    try {
      await apiFetch(`/leave-requests/${approveTarget.id}/approve`, { method: 'PUT', body: JSON.stringify({ reviewedBy: user?.email || '' }) });
      toast.success('Leave approved.'); setApproveTarget(null); fetchData();
    } catch (error: any) { toast.error('Error: ' + error.message); }
  };

  const confirmReject = async (note: string) => {
    if (!rejectTarget) return;
    try {
      await apiFetch(`/leave-requests/${rejectTarget.id}/reject`, { method: 'PUT', body: JSON.stringify({ reviewedBy: user?.email || '', reviewNotes: note || '' }) });
      toast.success('Leave rejected.'); setRejectTarget(null); fetchData();
    } catch (error: any) { toast.error('Error: ' + error.message); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/leave-requests/${deleteTarget.id}`, { method: 'DELETE' });
      toast.success('Leave deleted and the original roster assignments restored.');
      setDeleteTarget(null); fetchData();
    } catch (error: any) {
      const message = String(error?.message || '');
      if (message.includes('Cannot safely delete this older leave:')) {
        const dates = [...new Set(message.match(/\d{4}-\d{2}-\d{2}/g) || [])].sort();
        setLegacyRestoreDates(dates);
        setLegacyRestores({});
        toast.error('Older leave: confirm the original shift/OFF for each listed day before deleting.');
      } else toast.error('Error: ' + message);
    }
  };

  const handleLegacyDelete = async () => {
    if (!deleteTarget || legacyRestoreDates.length === 0) return;
    for (const date of legacyRestoreDates) {
      const choice = legacyRestores[date];
      if (!choice?.status || (choice.status === 'scheduled' && !choice.shiftTime.trim())) {
        toast.error(`Select the original roster status and shift for ${formatDisplay(date)}.`);
        return;
      }
    }
    try {
      await apiFetch(`/leave-requests/${deleteTarget.id}`, {
        method: 'DELETE', body: JSON.stringify({ legacyRestores })
      });
      toast.success('Leave deleted. The confirmed previous roster entries were restored.');
      setLegacyRestoreDates([]); setLegacyRestores({}); setDeleteTarget(null); fetchData();
    } catch (error: any) { toast.error('Error: ' + error.message); }
  };

  let previewDays = 0, previewFridays = 0;
  if (startDate && endDate && endDate >= startDate) {
    if (leaveType === 'ANNUAL LEAVE') { const r = countAnnualLeaveDays(startDate, endDate, holidaySet); previewDays = r.countable; previewFridays = r.skippedFridays; }
    else { previewDays = allDatesInRange(startDate, endDate).length; }
  }

  if (loading) return <div className="page-content"><p>Loading...</p></div>;

  return (
    <div className="page-content leave-management-page">
      <header className="leave-management-hero">
        <div>
          <span className="leave-management-kicker">Workforce availability</span>
          <h2>Leave Management</h2>
          <p>Submit requests, review approvals, and understand leave availability before roster changes are applied.</p>
        </div>
        <div className="leave-management-hero__actions">
          {canApproveAnyDept && <button type="button" className="leave-management-secondary"
            disabled={integrityLoading} onClick={() => integrityVisible ? setIntegrityVisible(false) : void runIntegrityAudit()}>
            {integrityLoading ? 'Checking roster…' : integrityVisible ? 'Hide integrity audit' : 'Audit leave & roster'}
          </button>}
          <button type="button" className="leave-management-secondary" onClick={() => void fetchData()} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
          <button type="button" className="leave-management-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Close request form' : 'Request leave'}</button>
        </div>
      </header>

      {loadError && <div className="leave-management-alert" role="alert"><strong>Leave information may be out of date.</strong><span>{loadError}</span></div>}

      {canApproveAnyDept && integrityVisible && (
        <section style={{ border: '1px solid #d5e2ee', background: '#fff', borderRadius: 12, padding: 16, marginBottom: 18 }} aria-label="Leave and roster integrity audit">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div><strong>Leave & roster integrity audit</strong><p style={{ margin: '5px 0', color: '#64748b', fontSize: 13 }}>Read-only check. This report does not edit staff, shifts, or leave requests.</p></div>
            <button type="button" className="leave-management-secondary" disabled={integrityLoading} onClick={() => void runIntegrityAudit()}>
              {integrityLoading ? 'Checking…' : 'Run again'}
            </button>
          </div>
          {integrityLoading && <p role="status">Checking leave and roster records…</p>}
          {integrityAudit && !integrityLoading && (
            <>
              <p style={{ margin: '12px 0', fontSize: 14 }}>
                <strong>{integrityAudit.totalIssues} issue(s) found</strong> across {integrityAudit.scanned?.leaves ?? 0} leave requests and {integrityAudit.scanned?.roster ?? 0} roster entries.
                {integrityAudit.totalIssues > 200 && ' Only the first 200 issues are displayed.'}
              </p>
              {integrityAudit.totalIssues === 0
                ? <p style={{ color: '#047857' }}>No inconsistencies detected by these checks. Continue testing leave restoration with controlled records.</p>
                : <div style={{ maxHeight: 380, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                    <table className="leave-management-table" style={{ width: '100%', fontSize: 12 }}>
                      <thead><tr><th>Issue</th><th>Staff / SN</th><th>Date</th><th>Details</th></tr></thead>
                      <tbody>{(integrityAudit.issues || []).map((issue: any, index: number) => (
                        <tr key={`${issue.kind}-${issue.staffId}-${issue.date}-${index}`}>
                          <td>{String(issue.kind || '').replace(/_/g, ' ')}</td>
                          <td><strong>{issue.staffName}</strong><div>{issue.staffSn}</div></td>
                          <td>{issue.date || '—'}</td><td>{issue.detail}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>}
              <p style={{ color: '#92400e', fontSize: 12 }}>Back up Neon and verify identities before fixing historical records. This report can flag old holiday-count differences that may be intentional.</p>
            </>
          )}
        </section>
      )}

      <section className="leave-management-summary" aria-label="Leave request summary">
        <div><span>Pending</span><strong>{pendingCount}</strong><small>awaiting a decision</small></div>
        <div><span>Approved</span><strong>{approvedCount}</strong><small>confirmed requests</small></div>
        <div><span>Rejected</span><strong>{rejectedCount}</strong><small>declined requests</small></div>
        <div><span>Current view</span><strong>{visibleRequests.length}</strong><small>matching records</small></div>
      </section>

      <div className="leave-management-note">Manually submitted leave updates the roster after approval; leave entered directly through the roster is automatically approved.</div>

      <section className="leave-management-controls">
        <label><span>Search requests</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Staff, leave type, department…" /></label>
        {!isStaff && <label><span>Department</span><select value={filterDept} onChange={(event) => setFilterDept(event.target.value)}><option value="all">All departments</option>{FORM_DEPARTMENTS.map((departmentName) => <option key={departmentName} value={departmentName}>{departmentName}</option>)}</select></label>}
      </section>

      {!isStaff && <nav className="leave-management-tabs" aria-label="Request status filter">
        <button type="button" className={tab === 'pending' ? 'active' : ''} onClick={() => setTab('pending')}>Pending <span>{pendingCount}</span></button>
        <button type="button" className={tab === 'approved' ? 'active' : ''} onClick={() => setTab('approved')}>Approved <span>{approvedCount}</span></button>
        <button type="button" className={tab === 'rejected' ? 'active' : ''} onClick={() => setTab('rejected')}>Rejected <span>{rejectedCount}</span></button>
        <button type="button" className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>All <span>{displayRequests.length}</span></button>
      </nav>}
      {myStaff && canSeeMyBalance && (
        <div className="collapsible-card">
          <button className="collapsible-header" onClick={() => setShowMyBalance(!showMyBalance)}><span><strong>My Leave Balance</strong></span><span className="collapsible-toggle">{showMyBalance ? '▼' : '▶'}</span></button>
          {showMyBalance && (
            <div className="collapsible-body">
              <div className="leave-tabs" style={{ marginBottom: '16px' }}>
                <button className={balanceTab === 'annual' ? 'leave-tab active' : 'leave-tab'} onClick={() => setBalanceTab('annual')}>Annual</button>
                <button className={balanceTab === 'sick' ? 'leave-tab active' : 'leave-tab'} onClick={() => setBalanceTab('sick')}>Sick</button>
                <button className={balanceTab === 'other' ? 'leave-tab active' : 'leave-tab'} onClick={() => setBalanceTab('other')}>Other</button>
              </div>
              <div className="balance-grid">
                {getLeaveTypesForStaff(myStaff).filter(t => { if (balanceTab === 'annual') return t.includes('ANNUAL'); if (balanceTab === 'sick') return t.includes('SICK'); return !t.includes('ANNUAL') && !t.includes('SICK'); }).map((t) => {
                  const isAnnual = t === 'ANNUAL LEAVE'; const entitlement = ENTITLEMENTS[t] || 0; const used = usedDays[t] || 0;
                  if (isAnnual && !myIsAnnualRenewing && myStaff.joinDate) { return <div key={t} className="balance-item"><span className="balance-label">{t}</span><span className="balance-value">{ANNUAL_LEAVE_TOTAL - used} / {ANNUAL_LEAVE_TOTAL} days</span></div>; }
                  const remaining = entitlement > 0 ? entitlement - used : null;
                  return <div key={t} className="balance-item"><span className="balance-label">{t}</span><span className="balance-value">{remaining !== null ? `${remaining} / ${entitlement} days` : `${used} days used`}</span></div>;
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {(canApproveAnyDept || isSMT || myStaff?.isIncharge) && deptBalanceStaff.length > 0 && (
        <div className="collapsible-card">
          <button className="collapsible-header" onClick={() => setShowDeptBalances(!showDeptBalances)}><span><strong>👥 Department Staff Balances</strong></span><span className="collapsible-toggle">{showDeptBalances ? '▼' : '▶'}</span></button>
          {showDeptBalances && (
            <div className="collapsible-body">
              <div style={{ overflowX: 'auto' }}>
                <table className="mini-table">
                  <thead><tr><th>SN</th><th>Name</th><th>Dept</th><th>Annual</th><th>Sick</th><th>FRL</th></tr></thead>
                  <tbody>
                    {deptBalanceStaff.map((s: any) => {
                      const aUsed = computeUsedDays(s.id, s.joinDate || '', 'ANNUAL LEAVE', requests); const sUsed = computeUsedDays(s.id, s.joinDate || '', 'SICK LEAVE', requests); const fUsed = computeUsedDays(s.id, s.joinDate || '', 'FAMILY RESPONSIBILITY LEAVE (FRL)', requests);
                      return (<tr key={s.id}><td>{s.sn || '—'}</td><td><strong>{s.name}</strong></td><td style={{ fontSize: '12px' }}>{s.department}</td><td style={{ fontWeight: 600 }}>{ANNUAL_LEAVE_TOTAL - aUsed} / 30</td><td style={{ fontWeight: 600 }}>{15 - sUsed} / 15</td><td style={{ fontWeight: 600 }}>{10 - fUsed} / 10</td></tr>);
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <form className="staff-form leave-management-form" onSubmit={handleSubmit}>
          <div style={{ gridColumn: 'span 2', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>📝 New Leave Request</div>
          {!isStaff && (<select value={selectedFormDept} onChange={(e) => { setSelectedFormDept(e.target.value); setSelectedStaffId(''); }} required style={selectStyle}>{formDepartments.map(d => <option key={d} value={d}>{d}</option>)}</select>)}
          {!isStaff ? (<select value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)} required style={selectStyle}><option value="">Select Staff Member...</option>{formStaffOptions.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.sn})</option>)}</select>) : (<input value={myStaff ? `${myStaff.name} (${myStaff.sn})` : 'Not linked'} disabled />)}
          <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)} style={selectStyle}>{allowedLeaveTypes.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          <input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}><label style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Start Date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}><label style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>End Date</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required /></div>
          <div style={{ gridColumn: 'span 2', background: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '13px', color: '#475569' }}><strong>Countable days:</strong> {previewDays}{leaveType === 'ANNUAL LEAVE' && previewFridays > 0 && (<div style={{ fontSize: '11px', color: '#92400e', marginTop: '4px' }}>ℹ️ {previewFridays} Friday(s) will show on the roster but will not be deducted.</div>)}</div>
          <button type="submit" disabled={submitting || previewDays === 0} style={{ gridColumn: 'span 2' }}>{submitting ? 'Submitting...' : 'Submit Leave Request'}</button>
        </form>
      )}

      <div className="long-register-toolbar"><div><strong>Leave request register</strong><span>{visibleRequests.length} matching requests</span></div><button type="button" onClick={() => setShowRegister(value => !value)}>{showRegister ? 'Minimize' : 'Show list'}</button></div>
      <div className={`staff-list leave-management-list ${showRegister ? '' : 'long-register-collapsed'}`}>
        {visibleRequests.length === 0 ? (<div className="empty-state"><p>No leave requests found.</p></div>) : (
          <table className="leave-management-table">
            <thead><tr><th>Staff</th><th>Dept</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Requested by / time</th><th>Status / decision audit</th><th>Actions</th></tr></thead>
            <tbody>
              {visibleRequests.map((r: any) => {
                const approverName = r.reviewedBy ? (staffList.find(s => (s.email || '').toLowerCase() === r.reviewedBy.toLowerCase())?.name || r.reviewedBy) : null;
                const requesterName = r.requestedBy ? (staffList.find(s => (s.email || '').toLowerCase() === r.requestedBy.toLowerCase())?.name || r.requestedBy) : 'System';
                return (
                  <tr key={r.id}>
                    <td><strong>{r.staffName}</strong> {r.staffIsSMT && '⭐'}</td>
                    <td style={{ fontSize: '12px' }}>{r.staffDepartment}</td>
                    <td><span className="leave-type-badge">{r.leaveType}</span></td>
                    <td>{formatDisplay(r.startDate)}</td>
                    <td>{formatDisplay(r.endDate)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.days}</td>
                    <td><div className="request-audit"><strong>{requesterName}</strong><span>{formatAuditDate(r.requestedAt)}</span></div></td>
                    <td><span className={`status-badge status-${(r.status || '').toLowerCase()}`}>{(r.status || '').toUpperCase()}</span><div className="request-audit decision"><strong>{approverName || 'Awaiting decision'}</strong><span>{formatAuditDate(r.reviewedAt)}</span></div></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {canApproveRequest(r) && r.status?.toLowerCase() === 'pending' && (
                        <>
                          <button type="button" className="approve-btn" title="Approve request" onClick={() => setApproveTarget(r)}>Approve</button>
                          <button type="button" className="reject-btn" title="Reject request" onClick={() => setRejectTarget(r)}>Reject</button>
                        </>
                      )}
                      {canDeleteRequest(r) && <button type="button" className="delete-btn" onClick={() => setDeleteTarget(r)}>Delete</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog isOpen={!!approveTarget} title="Approve Leave?" message={`Approve ${approveTarget?.leaveType} for ${approveTarget?.staffName}?`} confirmText="Yes, Approve" isDanger={false} onConfirm={confirmApprove} onCancel={() => setApproveTarget(null)} />
      <PromptDialog isOpen={!!rejectTarget} title="Reject Leave?" message="Please provide a reason for rejection (optional):" placeholder="e.g. Operational requirements" onSubmit={confirmReject} onCancel={() => setRejectTarget(null)} />
      <ConfirmDialog isOpen={!!deleteTarget && legacyRestoreDates.length === 0} title="Delete Leave Request?" message={`Delete this leave for ${deleteTarget?.staffName}? Previously saved roster shifts/OFF days will be restored.`} confirmText="Delete and restore roster" isDanger={true} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      {deleteTarget && legacyRestoreDates.length > 0 && (
        <div className="modal-backdrop no-print" role="dialog" aria-modal="true" aria-label="Restore older roster entries">
          <div className="modal-content" style={{ maxWidth: 650, maxHeight: '85vh', overflowY: 'auto' }}>
            <h3>Confirm previous roster — {deleteTarget.staffName}</h3>
            <p style={{ color: '#9a580a' }}>
              This older leave was saved before roster backups existed. Choose what each date
              showed BEFORE leave (using the original roster or backup). Nothing will be
              deleted until every date has a confirmed selection.
            </p>
            {legacyRestoreDates.map(date => {
              const current = legacyRestores[date] || { status: '', shiftTime: '' };
              return <div key={date} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10, alignItems: 'center' }}>
                <strong>{formatDisplay(date)}</strong>
                <select value={current.status} style={selectStyle} onChange={event => setLegacyRestores(previous => ({ ...previous,
                  [date]: { status: event.target.value, shiftTime: '' }
                }))}>
                  <option value="">Select previous status</option>
                  <option value="scheduled">Scheduled shift</option>
                  <option value="OFF DAY">OFF DAY</option>
                  <option value="ABSENT">ABSENT</option>
                  <option value="__EMPTY__">Originally blank</option>
                </select>
                {current.status === 'scheduled' && <input style={{ ...selectStyle, gridColumn: '1 / -1' }}
                  placeholder="Previous shift, e.g. 06:00 - 14:00" value={current.shiftTime}
                  onChange={event => setLegacyRestores(previous => ({ ...previous,
                    [date]: { ...current, shiftTime: event.target.value }
                  }))} />}
              </div>;
            })}
            <div className="modal-actions" style={{ marginTop: 24 }}>
              <button className="cancel-btn" onClick={() => { setDeleteTarget(null); setLegacyRestoreDates([]); setLegacyRestores({}); }}>Cancel</button>
              <button className="submit-btn" onClick={handleLegacyDelete}>Restore confirmed roster and delete leave</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LeavePage;