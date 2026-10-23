import { useState, useEffect } from 'react';
import {
  collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc,
  query, where, getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import { ConfirmDialog, PromptDialog } from '../components/Dialogs';

const LEAVE_TYPES = [
  'ANNUAL LEAVE', 'SICK LEAVE', 'SICK LEAVE / MC', 'NO PAY LEAVE',
  'PATERNITY LEAVE', 'MATERNITY LEAVE', 'PRE-MATERNITY LEAVE',
  'FAMILY RESPONSIBILITY LEAVE (FRL)', 'DUTY TRAVEL',
];

const ENTITLEMENTS: { [key: string]: number } = {
  'ANNUAL LEAVE': 30, 'SICK LEAVE': 15, 'SICK LEAVE / MC': 15,
  'FAMILY RESPONSIBILITY LEAVE (FRL)': 10, 'PRE-MATERNITY LEAVE': 15,
  'MATERNITY LEAVE': 180, 'PATERNITY LEAVE': 30, 'NO PAY LEAVE': 365, 'DUTY TRAVEL': 0,
};

const FEMALE_ONLY = ['PRE-MATERNITY LEAVE', 'MATERNITY LEAVE'];
const MALE_ONLY = ['PATERNITY LEAVE'];
const COUNTS_FRIDAY_AND_OFF_DAYS = [
  'PATERNITY LEAVE', 'MATERNITY LEAVE', 'PRE-MATERNITY LEAVE', 'NO PAY LEAVE',
  'SICK LEAVE', 'SICK LEAVE / MC', 'FAMILY RESPONSIBILITY LEAVE (FRL)', 'DUTY TRAVEL',
];
const ANNUAL_LEAVE_SERVICE_YEARS = 2;
const ANNUAL_LEAVE_TOTAL = 30;

const APPROVER_DESIGNATIONS = [
  'Airport Manager', 'Assistant Manager', 'Assistant Safety Officer',
  'Senior Airport Officer', 'Operations Officer', 'Assistant Operations Officer',
  'Assistant Security Officer', 'Assistant Administrative Officer', 'Leading Fireman',
];
const GLOBAL_APPROVERS = ['Airport Manager', 'Assistant Manager'];
const DEVELOPER_ROLES = ['developer'];

const FORM_DEPARTMENTS = ['Ground Operations', 'Maintenance', 'Security', 'Fire & Rescue', 'Administration', 'Safety'];

const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDisplay = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
};

const isFriday = (dateStr: string): boolean => new Date(dateStr + 'T00:00:00').getDay() === 5;

const allDatesInRange = (start: string, end: string): string[] => {
  const dates: string[] = [];
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return dates;
  const cur = new Date(s);
  while (cur <= e) {
    dates.push(formatDate(cur)); cur.setDate(cur.getDate() + 1);
  }
  return dates;
};

const countAnnualLeaveDays = (start: string, end: string, holidayDates: Set<string>) => {
  const dates = allDatesInRange(start, end);
  let countable = 0, skippedFridays = 0, skippedHolidays = 0;
  for (const d of dates) {
    if (isFriday(d)) skippedFridays++;
    else if (holidayDates.has(d)) skippedHolidays++;
    else countable++;
  }
  return { countable, skippedFridays, skippedHolidays };
};

const getCurrentLeaveYear = (joinDateStr: string) => {
  if (!joinDateStr) return null;
  const jd = new Date(joinDateStr + 'T00:00:00');
  if (isNaN(jd.getTime())) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let startYear = today.getFullYear();
  let anniversary = new Date(startYear, jd.getMonth(), jd.getDate());
  if (today < anniversary) { startYear -= 1; anniversary = new Date(startYear, jd.getMonth(), jd.getDate()); }
  const start = anniversary;
  const end = new Date(startYear + 1, jd.getMonth(), jd.getDate()); end.setDate(end.getDate() - 1);
  return { start, end };
};

const getYearsOfService = (joinDateStr: string): number => {
  if (!joinDateStr) return 0;
  const jd = new Date(joinDateStr + 'T00:00:00');
  if (isNaN(jd.getTime())) return 0;
  const today = new Date();
  let years = today.getFullYear() - jd.getFullYear();
  const m = today.getMonth() - jd.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < jd.getDate())) years -= 1;
  return years;
};

const getLeaveTypesForStaff = (staffMember: any): string[] => {
  const g = (staffMember?.gender || '').toLowerCase();
  if (!g) return LEAVE_TYPES;
  return LEAVE_TYPES.filter((t) => {
    if (g === 'female' && MALE_ONLY.includes(t)) return false;
    if (g === 'male' && FEMALE_ONLY.includes(t)) return false;
    return true;
  });
};

const computeUsedDays = (staffId: string, joinDate: string, leaveType: string, requests: any[]): number => {
  if (!joinDate) return 0;
  const years = getYearsOfService(joinDate);
  const isAnnual = leaveType === 'ANNUAL LEAVE';
  const renews = years >= ANNUAL_LEAVE_SERVICE_YEARS;
  let used = 0;
  const ly = getCurrentLeaveYear(joinDate);

  requests.filter((r: any) => r.staffId === staffId && r.status === 'approved' && r.leaveType === leaveType)
    .forEach((r: any) => {
      if (isAnnual && !renews) used += r.days || 0;
      else if (ly) {
        const lyStart = formatDate(ly.start); const lyEnd = formatDate(ly.end);
        if ((r.startDate || '') >= lyStart && (r.startDate || '') <= lyEnd) used += r.days || 0;
      }
    });
  return used;
};

function LeavePage() {
  const { profile, user } = useAuth();
  
  // Access Control
  const isDev = profile?.role === 'developer';
  const isManager = profile?.role === 'manager';
  const isSMT = profile?.role === 'smt' || profile?.isSMT === true;
  const userDept = profile?.department || '';
  const isStaff = !isDev && !isManager && !isSMT && profile?.role !== 'owner' && profile?.role !== 'admin';

  const [requests, setRequests] = useState<any[]>([]);
  const [myStaff, setMyStaff] = useState<any>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [tab, setTab] = useState<string>('pending');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);

  const [showMyBalance, setShowMyBalance] = useState<boolean>(true);
  const [balanceTab, setBalanceTab] = useState<'annual' | 'sick' | 'other'>('annual');
  const [showDeptBalances, setShowDeptBalances] = useState<boolean>(false);

  const [showForm, setShowForm] = useState<boolean>(false);
  const [selectedFormDept, setSelectedFormDept] = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [leaveType, setLeaveType] = useState<string>('ANNUAL LEAVE');
  const [startDate, setStartDate] = useState<string>(formatDate(new Date()));
  const [endDate, setEndDate] = useState<string>(formatDate(new Date()));
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [approveTarget, setApproveTarget] = useState<any>(null);
  const [rejectTarget, setRejectTarget] = useState<any>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'staff'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setStaffList(list);
      const mine = list.find((s: any) => (s.email || '').toLowerCase() === (user?.email || '').toLowerCase());
      setMyStaff(mine || null);
      if (mine) { setSelectedStaffId(mine.id); setSelectedFormDept(mine.department || 'Ground Operations'); }
      else setSelectedFormDept('Ground Operations');
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'leave_requests'), (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'holidays'), (snap) => {
      setHolidays(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const holidaySet = new Set<string>(holidays.map((h: any) => h.date));
  
  // Roster edit logic applied to leave approvals
  const canApproveAnyDept = isDev || isManager || GLOBAL_APPROVERS.includes(myStaff?.position || '');
  const isDeptManager = canApproveAnyDept || APPROVER_DESIGNATIONS.includes(myStaff?.position || '');
  
  const canApproveThisDept = (dept: string) => {
    if (isDev || isManager || canApproveAnyDept) return true;
    if (isDeptManager && myStaff?.department === dept) return true;
    if (isSMT && myStaff?.department === dept) return true;
    if (myStaff?.department === 'Safety' && dept === 'Security') return true; // Safety edits Security
    return false;
  };

  const canSeeDeptBalances = isDev || isManager || isSMT;
  const canSeeMyBalance = !isStaff || myStaff?.balanceVisible === true || isSMT || isManager;

  const canApproveRequest = (r: any): boolean => {
    if (r.staffId === myStaff?.id) return false; // Cannot approve own
    if (isDev || isManager || canApproveAnyDept) return true;
    return canApproveThisDept(r.staffDepartment);
  };

  const canDeleteRequest = (r: any): boolean => {
    if (isDev || isManager) return true;
    return myStaff && r.staffId === myStaff.id;
  };

  const visibleRequests = requests
    .filter((r: any) => {
      if (isStaff) return myStaff && r.staffId === myStaff.id;
      if (!isDeptManager && !isSMT && !isDev && !isManager) return myStaff && r.staffId === myStaff.id;
      if (filterDept !== 'all' && r.staffDepartment !== filterDept) return false;
      return true;
    })
    .filter((r: any) => (isStaff ? r.status === 'approved' || r.status === 'pending' : (tab === 'all' ? true : r.status === tab)))
    .sort((a: any, b: any) => (b.requestedAt || '').localeCompare(a.requestedAt || ''));

  const myYearsOfService = myStaff?.joinDate ? getYearsOfService(myStaff.joinDate) : 0;
  const myIsAnnualRenewing = myYearsOfService >= ANNUAL_LEAVE_SERVICE_YEARS;

  const formStaffOptions = staffList.filter(s => s.department === selectedFormDept);
  const selectedStaff = staffList.find((s) => s.id === selectedStaffId);
  const allowedLeaveTypes = getLeaveTypesForStaff(selectedStaff || myStaff);

  const usedDays: { [key: string]: number } = {};
  LEAVE_TYPES.forEach((t) => { usedDays[t] = myStaff ? computeUsedDays(myStaff.id, myStaff.joinDate || '', t, requests) : 0; });

  const deptBalanceStaff = staffList
    .filter((s: any) => {
      if (s.isSMT === true || s.department === 'Administration' || s.department === 'Safety') return false;
      if (isDev || isManager || canApproveAnyDept) return true;
      return myStaff?.department ? s.department === myStaff.department : false;
    })
    .sort((a: any, b: any) => (a.sn || '').localeCompare(b.sn || ''));

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!selectedStaffId) { toast.error('Please select a staff member'); return; }
    if (endDate < startDate) { toast.error('End date cannot be before start date'); return; }
    const staff = staffList.find((s) => s.id === selectedStaffId);
    if (!staff) { toast.error('Staff not found'); return; }

    // OVERLAP CHECK
    const overlap = requests.some(r => 
      r.staffId === selectedStaffId && 
      r.status === 'approved' && 
      r.startDate <= endDate && 
      r.endDate >= startDate
    );
    if (overlap) {
      toast.error('This request overlaps with an already approved leave. Please check the dates.');
      return;
    }

    const g = (staff.gender || '').toLowerCase();
    if (g === 'female' && MALE_ONLY.includes(leaveType)) { toast.error(`${leaveType} is only available for male staff.`); return; }
    if (g === 'male' && FEMALE_ONLY.includes(leaveType)) { toast.error(`${leaveType} is only available for female staff.`); return; }

    if (leaveType === 'ANNUAL LEAVE') {
      if (!staff.joinDate) { toast.error(`${staff.name} does not have a Join Date set.`); return; }
      const daysForRequest = countAnnualLeaveDays(startDate, endDate, holidaySet).countable;
      const usedAnnual = computeUsedDays(staff.id, staff.joinDate, 'ANNUAL LEAVE', requests);
      if (usedAnnual + daysForRequest > ANNUAL_LEAVE_TOTAL) { toast.error(`Exceeds annual leave limit.`); return; }
    }

    let days = leaveType === 'ANNUAL LEAVE'
      ? countAnnualLeaveDays(startDate, endDate, holidaySet).countable
      : allDatesInRange(startDate, endDate).length;
    if (days === 0) { toast.error('No countable days in this range.'); return; }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'leave_requests'), {
        staffId: selectedStaffId, staffName: staff.name, staffDepartment: staff.department,
        staffSN: staff.sn || '', staffGender: staff.gender || '', staffIsSMT: staff.isSMT === true,
        leaveType, startDate, endDate, days, reason, status: 'pending',
        requestedAt: new Date().toISOString(), requestedBy: user?.email || '',
      });
      toast.success(`Leave request submitted.`);
      setShowForm(false); setReason('');
    } catch (error: any) { toast.error('Error: ' + error.message); }
    setSubmitting(false);
  };

  const confirmApprove = async () => {
    if (!approveTarget) return;
    const r = approveTarget;
    try {
      await updateDoc(doc(db, 'leave_requests', r.id), { status: 'approved', reviewedBy: user?.email || '', reviewedAt: new Date().toISOString() });
      const dates = allDatesInRange(r.startDate, r.endDate);
      for (const d of dates) {
        const q = query(collection(db, 'roster_entries'), where('staffId', '==', r.staffId), where('date', '==', d));
        const existing = await getDocs(q);
        for (const docSnap of existing.docs) await deleteDoc(doc(db, 'roster_entries', docSnap.id));
        await addDoc(collection(db, 'roster_entries'), {
          staffId: r.staffId, staffName: r.staffName, staffDepartment: r.staffDepartment,
          date: d, shiftTime: '', status: r.leaveType, leaveRequestId: r.id, createdAt: new Date().toISOString(),
        });
      }
      toast.success('Leave approved.');
      setApproveTarget(null);
    } catch (error: any) { toast.error('Error: ' + error.message); }
  };

  const confirmReject = async (note: string) => {
    if (!rejectTarget) return;
    try {
      await updateDoc(doc(db, 'leave_requests', rejectTarget.id), { status: 'rejected', reviewedBy: user?.email || '', reviewedAt: new Date().toISOString(), reviewNotes: note || '' });
      toast.success('Leave rejected.');
      setRejectTarget(null);
    } catch (error: any) { toast.error('Error: ' + error.message); }
  };

  const handleDelete = async (r: any) => {
    if (!window.confirm(`DELETE this leave request permanently?`)) return;
    try {
      const q = query(collection(db, 'roster_entries'), where('leaveRequestId', '==', r.id));
      const linkedRoster = await getDocs(q);
      for (const docSnap of linkedRoster.docs) await deleteDoc(doc(db, 'roster_entries', docSnap.id));
      await deleteDoc(doc(db, 'leave_requests', r.id));
      toast.success('Leave request deleted.');
    } catch (error: any) { toast.error('Error: ' + error.message); }
  };

  let previewDays = 0, previewFridays = 0;
  if (startDate && endDate && endDate >= startDate) {
    if (leaveType === 'ANNUAL LEAVE') {
      const r = countAnnualLeaveDays(startDate, endDate, holidaySet);
      previewDays = r.countable; previewFridays = r.skippedFridays;
    } else { previewDays = allDatesInRange(startDate, endDate).length; }
  }

  if (loading) return <div className="page-content"><p>Loading...</p></div>;

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>Leave Management</h2>
        <button className="add-staff-btn" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Request Leave'}</button>
      </div>
      <p style={{ margin: '-8px 0 16px', fontSize: '13px', color: '#64748b' }}>
        Leave is written on the roster only after a supervisor approves the request.
      </p>

      {myStaff && canSeeMyBalance && (
        <div className="collapsible-card">
          <button className="collapsible-header" onClick={() => setShowMyBalance(!showMyBalance)}>
            <span><strong>My Leave Balance</strong></span>
            <span className="collapsible-toggle">{showMyBalance ? '▼' : '▶'}</span>
          </button>
          {showMyBalance && (
            <div className="collapsible-body">
              <div className="leave-tabs" style={{ marginBottom: '16px' }}>
                <button className={balanceTab === 'annual' ? 'leave-tab active' : 'leave-tab'} onClick={() => setBalanceTab('annual')}>Annual</button>
                <button className={balanceTab === 'sick' ? 'leave-tab active' : 'leave-tab'} onClick={() => setBalanceTab('sick')}>Sick</button>
                <button className={balanceTab === 'other' ? 'leave-tab active' : 'leave-tab'} onClick={() => setBalanceTab('other')}>Other</button>
              </div>
              <div className="balance-grid">
                {getLeaveTypesForStaff(myStaff).filter(t => {
                  if (balanceTab === 'annual') return t.includes('ANNUAL');
                  if (balanceTab === 'sick') return t.includes('SICK');
                  return !t.includes('ANNUAL') && !t.includes('SICK');
                }).map((t) => {
                  const isAnnual = t === 'ANNUAL LEAVE';
                  const entitlement = ENTITLEMENTS[t] || 0;
                  const used = usedDays[t] || 0;
                  
                  if (isAnnual && !myIsAnnualRenewing && myStaff.joinDate) {
                    return (
                      <div key={t} className="balance-item">
                        <span className="balance-label">{t}</span>
                        <span className="balance-value">{ANNUAL_LEAVE_TOTAL - used} / {ANNUAL_LEAVE_TOTAL} days</span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>One-time allocation</span>
                      </div>
                    );
                  }
                  const remaining = entitlement > 0 ? entitlement - used : null;
                  return (
                    <div key={t} className="balance-item">
                      <span className="balance-label">{t}</span>
                      <span className="balance-value">{remaining !== null ? `${remaining} / ${entitlement} days` : `${used} days used`}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {canSeeDeptBalances && deptBalanceStaff.length > 0 && (
        <div className="collapsible-card">
          <button className="collapsible-header" onClick={() => setShowDeptBalances(!showDeptBalances)}>
            <span><strong>{canApproveAnyDept || isDev ? '👥 All Staff Leave Balances' : `👥 ${myStaff?.department || ''} — Staff Balances`}</strong></span>
            <span className="collapsible-toggle">{showDeptBalances ? '▼' : '▶'}</span>
          </button>
          {showDeptBalances && (
            <div className="collapsible-body">
              <table className="dept-balance-table">
                <thead><tr><th>SN</th><th>Name</th><th>Dept</th><th>Annual</th><th>Sick</th><th>FRL</th></tr></thead>
                <tbody>
                  {deptBalanceStaff.map((s: any) => {
                    const aUsed = computeUsedDays(s.id, s.joinDate || '', 'ANNUAL LEAVE', requests);
                    const sUsed = computeUsedDays(s.id, s.joinDate || '', 'SICK LEAVE', requests);
                    const fUsed = computeUsedDays(s.id, s.joinDate || '', 'FAMILY RESPONSIBILITY LEAVE (FRL)', requests);
                    return (
                      <tr key={s.id}>
                        <td>{s.sn || '—'}</td>
                        <td><strong>{s.name}</strong></td>
                        <td style={{ fontSize: '12px' }}>{s.department}</td>
                        <td style={{ fontWeight: 600 }}>{ANNUAL_LEAVE_TOTAL - aUsed} / 30</td>
                        <td style={{ fontWeight: 600 }}>{15 - sUsed} / 15</td>
                        <td style={{ fontWeight: 600 }}>{10 - fUsed} / 10</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <form className="staff-form" onSubmit={handleSubmit}>
          <div style={{ gridColumn: 'span 2', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>📝 New Leave Request</div>
          
          {!isStaff && (
            <select value={selectedFormDept} onChange={(e) => { setSelectedFormDept(e.target.value); setSelectedStaffId(''); }} required>
              {FORM_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}

          {!isStaff ? (
            <select value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)} required>
              <option value="">Select Staff Member...</option>
              {formStaffOptions.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.sn})</option>)}
            </select>
          ) : (
            <input value={myStaff ? `${myStaff.name} (${myStaff.sn})` : 'Not linked'} disabled />
          )}

          <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
            {allowedLeaveTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </div>

          <div style={{ gridColumn: 'span 2', background: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '13px', color: '#475569' }}>
            <strong>Countable days:</strong> {previewDays}
            {leaveType === 'ANNUAL LEAVE' && previewFridays > 0 && (
              <div style={{ fontSize: '11px', color: '#92400e', marginTop: '4px' }}>
                ℹ️ {previewFridays} Friday(s) will show on the roster but will not be deducted from the balance.
              </div>
            )}
          </div>
          <button type="submit" disabled={submitting || previewDays === 0} style={{ gridColumn: 'span 2' }}>
            {submitting ? 'Submitting...' : 'Submit Leave Request'}
          </button>
        </form>
      )}

      {!isStaff && (
        <div className="leave-tabs">
          <button className={tab === 'pending' ? 'leave-tab active' : 'leave-tab'} onClick={() => setTab('pending')}>Pending</button>
          <button className={tab === 'approved' ? 'leave-tab active' : 'leave-tab'} onClick={() => setTab('approved')}>Approved</button>
          <button className={tab === 'rejected' ? 'leave-tab active' : 'leave-tab'} onClick={() => setTab('rejected')}>Rejected</button>
          <button className={tab === 'all' ? 'leave-tab active' : 'leave-tab'} onClick={() => setTab('all')}>All</button>
        </div>
      )}

      <div className="staff-list" style={{ marginTop: '16px' }}>
        {visibleRequests.length === 0 ? (
          <div className="empty-state"><p>No leave requests found.</p></div>
        ) : (
          <table>
            <thead><tr><th>Staff</th><th>Dept</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {visibleRequests.map((r: any) => {
                const canApprove = canApproveRequest(r) && r.status === 'pending';
                return (
                  <tr key={r.id}>
                    <td><strong>{r.staffName}</strong></td>
                    <td style={{ fontSize: '12px' }}>{r.staffDepartment}</td>
                    <td><span className="leave-type-badge">{r.leaveType}</span></td>
                    <td>{formatDisplay(r.startDate)}</td>
                    <td>{formatDisplay(r.endDate)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.days}</td>
                    <td><span className={`status-badge status-${r.status}`}>{r.status.toUpperCase()}</span></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {canApprove && (
                        <>
                          <button className="approve-btn" onClick={() => setApproveTarget(r)}>✓</button>
                          <button className="reject-btn" onClick={() => setRejectTarget(r)}>✕</button>
                        </>
                      )}
                      {canDeleteRequest(r) && <button className="delete-btn" style={{ marginLeft: '6px' }} onClick={() => handleDelete(r)}>🗑</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!approveTarget}
        title="Approve Leave?"
        message={`Approve ${approveTarget?.leaveType} for ${approveTarget?.staffName}?`}
        confirmText="Yes, Approve"
        isDanger={false}
        onConfirm={confirmApprove}
        onCancel={() => setApproveTarget(null)}
      />
      <PromptDialog
        isOpen={!!rejectTarget}
        title="Reject Leave?"
        message="Please provide a reason for rejection (optional):"
        placeholder="e.g. Operational requirements"
        onSubmit={confirmReject}
        onCancel={() => setRejectTarget(null)}
      />
    </div>
  );
}

export default LeavePage;