import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import { ConfirmDialog } from '../components/Dialogs';

const DEPARTMENTS = ['Ground Operations', 'Maintenance', 'Security', 'Fire & Rescue', 'Administration', 'Safety'];
const formatAuditDate = (value?: string) => value ? new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const INITIAL_DATE = new Date().toISOString().split('T')[0];
const INITIAL_MONTH = INITIAL_DATE.slice(0, 7);

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

const getDayShort = (dateStr: string): string => {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(dateStr + 'T00:00:00').getDay()];
};

const computeHours = (start: string, end: string): number => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (minutes < 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 100) / 100;
};

const getWeekStart = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00');
  const diff = (d.getDay() + 1) % 7;
  d.setDate(d.getDate() - diff);
  return formatDate(d);
};

const getWeekEnd = (weekStartStr: string): string => {
  const d = new Date(weekStartStr + 'T00:00:00');
  d.setDate(d.getDate() + 6);
  return formatDate(d);
};

const selectStyle = { padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#1e293b', backgroundColor: '#ffffff' };

function OvertimePage() {
  const { profile, user } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [leaveReqs, setLeaveReqs] = useState<any[]>([]);
  const [myStaff, setMyStaff] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');

  const [otRules, setOtRules] = useState({ adminHours: 40, regularHours: 48, deductLeaves: ['SICK LEAVE', 'SICK LEAVE / MC'] });

  const [monthFilter, setMonthFilter] = useState<string>(INITIAL_MONTH);
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [viewMode, setViewMode] = useState<'individual' | 'department'>('individual');
  const [filterDept, setFilterDept] = useState<string>('Ground Operations');
  const [filterStaff, setFilterStaff] = useState<string>('all');
  
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formDept, setFormDept] = useState<string>('Ground Operations');
  const [formStaffId, setFormStaffId] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(INITIAL_DATE);
  const [formStart, setFormStart] = useState<string>('14:00');
  const [formEnd, setFormEnd] = useState<string>('16:00');
  const [formNotes, setFormNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [approveTarget, setApproveTarget] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchData = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const results = await Promise.allSettled([
        apiFetch('/overtime'), apiFetch('/staff'), apiFetch('/leave-requests'), apiFetch('/settings/ot_rules')
      ]);
      const getData = (index: number) => results[index].status === 'fulfilled' ? (results[index] as PromiseFulfilledResult<any>).value : [];
      const otData = getData(0);
      const staffData = getData(1);
      const leaveData = getData(2);
      const rulesData = getData(3);
      const failedRequests = results.filter((result) => result.status === 'rejected').length;

      setEntries(Array.isArray(otData) ? otData : []);
      setStaff(Array.isArray(staffData) ? staffData : []);
      setLeaveReqs(Array.isArray(leaveData) ? leaveData : []);
      if (rulesData && !Array.isArray(rulesData)) setOtRules(rulesData);
      setLoadError(failedRequests ? failedRequests + ' overtime data source' + (failedRequests === 1 ? '' : 's') + ' could not be refreshed.' : '');

      const mine = (Array.isArray(staffData) ? staffData : []).find((member: any) => (member.email || '').toLowerCase() === (user?.email || '').toLowerCase());
      setMyStaff(mine || null);
      if (mine && !formStaffId) {
        setFormStaffId(mine.id);
        setFilterDept(mine.department);
        setFormDept(mine.department);
      }
    } catch (err: any) {
      setLoadError(err.message || 'Overtime information could not be loaded.');
      if (!quiet) toast.error(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, formStaffId]);

  useEffect(() => { const initialLoad = window.setTimeout(() => void fetchData(true), 0); const interval = window.setInterval(() => void fetchData(true), 15000); return () => { window.clearTimeout(initialLoad); window.clearInterval(interval); }; }, [fetchData]);

  const isDev = profile?.role === 'developer';
  const isManager = profile?.role === 'manager' || profile?.role === 'admin';
  const isSMT = profile?.role === 'smt' || myStaff?.isSmt === true || myStaff?.isSMT === true;
  
  const canManageAll = isDev || isManager;
  const canViewAll = canManageAll;

  // NEW: Simple hierarchy approval gate
  const canApprove =
    myStaff?.isSmt === true ||
    myStaff?.isIncharge === true ||
    ["developer", "manager", "admin", "owner"].includes((profile?.role || "").toLowerCase());
  
  const canApproveThisDept = (dept: string, isSMTRequester: boolean = false) => {
    if (canManageAll) return true;

    const target = (dept || '').toLowerCase();
    const current = (myStaff?.department || '').toLowerCase();
    const isIncharge = myStaff?.isIncharge === true;


    if (isSMTRequester) {
      return isIncharge && current === target;
    }

    if (!isSMT) return false;
    return current === target;
  };

  const canEditThisDept = (dept: string, isSMTRequester: boolean = false) => {
    return canManageAll || canApproveThisDept(dept, isSMTRequester);
  };

  const isExcludedFromOT = (staffName: string, position: string) => {
    const n = (staffName || '').toLowerCase();
    const p = (position || '').toLowerCase();
    return n.includes('manager') || p.includes('manager') || p.includes('assistant manager');
  };

  // Build filtered list with hierarchy
  let filtered = entries.filter((e) => (e.date || '').startsWith(monthFilter));

  if (viewMode === 'individual' && myStaff) {
    // Individual mode: always shows own entries
    filtered = filtered.filter((e) => e.staffId === myStaff.id);
  } else if (canViewAll || canApprove) {
    // Department mode
    filtered = filtered.filter((e) => e.staffId !== myStaff?.id);

    const isManagerLevel = ["developer", "manager", "admin", "owner"].includes((profile?.role || "").toLowerCase());
    if (!isManagerLevel) {
      if (myStaff?.isIncharge) {
        filtered = filtered.filter((e) => e.staffDepartment === myStaff.department);
      } else if (myStaff?.isSmt) {
        filtered = filtered.filter((e) => {
          const entryStaff = staff.find(s => s.id === e.staffId);
          return e.staffDepartment === myStaff.department && entryStaff?.isSmt !== true && entryStaff?.isSMT !== true;
        });
      }
    }

    if (canViewAll) {
      filtered = filtered.filter((entry) => entry.staffDepartment === filterDept);
    }
    if (filterStaff !== 'all') {
      filtered = filtered.filter((entry) => entry.staffId === filterStaff);
    }
  } else {
    filtered = filtered.filter((entry) => myStaff && entry.staffId === myStaff.id);
  }

  const scopedEntries = filtered;
  const pendingCount = scopedEntries.filter((entry) => (entry.status || 'approved').toLowerCase() === 'pending').length;
  const approvedCount = scopedEntries.filter((entry) => (entry.status || 'approved').toLowerCase() === 'approved').length;
  const rejectedCount = scopedEntries.filter((entry) => (entry.status || 'approved').toLowerCase() === 'rejected').length;

  filtered = scopedEntries
    .filter((entry) => (entry.status || 'approved').toLowerCase() === tab)
    .filter((entry) => {
      const query = search.trim().toLowerCase();
      return !query || [entry.staffName, entry.staffSN, entry.staffDepartment, entry.notes].some((value) => String(value || '').toLowerCase().includes(query));
    })
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const weekMap: { [key: string]: any[] } = {};
  filtered.forEach((entry) => {
    const weekKey = `${entry.staffId}::${getWeekStart(entry.date)}`;
    if (!weekMap[weekKey]) weekMap[weekKey] = [];
    weekMap[weekKey].push(entry);
  });
  const weekKeys = Object.keys(weekMap).sort((a, b) => (a.split('::')[1] || '').localeCompare(b.split('::')[1] || ''));

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!formStaffId) { toast.error('Please select a staff member'); return; }
    const staffMember = staff.find((s) => s.id === formStaffId);
    if (!staffMember) return;

    if (isExcludedFromOT(staffMember.name, staffMember.position)) {
      toast.error('Managers and Assistant Managers are not eligible for OT.');
      return;
    }

    const hours = computeHours(formStart, formEnd);
    if (hours <= 0) { toast.error('End time must be after start time'); return; }

    setSubmitting(true);
    try {
      if (editingId) {
        await apiFetch(`/overtime/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify({ date: formDate, startTime: formStart, endTime: formEnd, hours, notes: formNotes })
        });
        toast.success(`OT entry updated.`);
      } else {
        await apiFetch('/overtime', {
          method: 'POST',
          body: JSON.stringify({
            staffId: formStaffId, staffName: staffMember.name, staffSN: staffMember.sn || '',
            staffDepartment: staffMember.department, date: formDate, startTime: formStart, endTime: formEnd,
            hours, notes: formNotes, createdBy: user?.email || ''
          })
        });
        toast.success(`OT request submitted for approval.`);
      }
      setFormNotes(''); setShowForm(false); setEditingId(null);
      fetchData();
    } catch (err: any) { toast.error('Error: ' + err.message); }
    setSubmitting(false);
  };

  const handleEditClick = (entry: any) => {
    setEditingId(entry.id);
    setFormStaffId(entry.staffId);
    setFormDate(entry.date);
    setFormStart(entry.startTime);
    setFormEnd(entry.endTime);
    setFormNotes(entry.notes || '');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const confirmApprove = async () => {
    if (!approveTarget) return;
    try {
      await apiFetch(`/overtime/${approveTarget}/approve`, { method: 'PUT', body: JSON.stringify({ reviewedBy: user?.email }) });
      toast.success('OT Approved');
      setApproveTarget(null);
      fetchData();
    } catch (err: any) { toast.error(err.message); }
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    try {
      await apiFetch(`/overtime/${rejectTarget}/reject`, { method: 'PUT', body: JSON.stringify({ reviewedBy: user?.email }) });
      toast.success('OT Rejected');
      setRejectTarget(null);
      fetchData();
    } catch (err: any) { toast.error(err.message); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/overtime/${deleteTarget}`, { method: 'DELETE' });
      toast.success('Entry deleted.');
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) { toast.error(err.message); }
  };

  if (loading) return <div className="page-content"><p>Loading Overtime...</p></div>;

  return (
    <div className="page-content overtime-management-page">
      <header className="overtime-management-hero">
        <div>
          <span className="overtime-management-kicker">Hours and approvals</span>
          <h2>Overtime Management</h2>
          <p>Record additional duty, review departmental requests, and keep weekly overtime calculations separated by employee.</p>
        </div>
        <div className="overtime-management-hero__actions">
          <button type="button" className="overtime-management-secondary" onClick={() => void fetchData()} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
          {(canViewAll || !isExcludedFromOT(myStaff?.name, myStaff?.position)) && <button type="button" className="overtime-management-primary" onClick={() => { setShowForm(!showForm); setEditingId(null); setFormNotes(''); }}>{showForm ? 'Close request form' : 'Request overtime'}</button>}
        </div>
      </header>

      {loadError && <div className="overtime-management-alert" role="alert"><strong>Overtime information may be out of date.</strong><span>{loadError}</span></div>}

      <section className="overtime-management-summary" aria-label="Overtime summary">
        <div><span>Pending</span><strong>{pendingCount}</strong><small>awaiting approval</small></div>
        <div><span>Approved</span><strong>{approvedCount}</strong><small>confirmed entries</small></div>
        <div><span>Rejected</span><strong>{rejectedCount}</strong><small>declined entries</small></div>
        <div><span>Current view</span><strong>{filtered.length}</strong><small>matching entries</small></div>
      </section>

      <section className="overtime-management-controls">
        <label><span>Month</span><input type="month" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} /></label>
        <label className="overtime-management-search"><span>Search entries</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Staff, SN, department or notes…" /></label>
      </section>

      {(canViewAll || canApprove) && <nav className="overtime-management-view-tabs" aria-label="Overtime scope">
        <button type="button" className={viewMode === 'individual' ? 'active' : ''} onClick={() => setViewMode('individual')}>My overtime</button>
        <button type="button" className={viewMode === 'department' ? 'active' : ''} onClick={() => setViewMode('department')}>Department overtime</button>
      </nav>}

      {viewMode === 'department' && (canViewAll || canApprove) && <section className="overtime-management-department-filters">
        {canViewAll && <label><span>Department</span><select value={filterDept} onChange={(event) => { setFilterDept(event.target.value); setFilterStaff('all'); }}>{DEPARTMENTS.map((departmentName) => <option key={departmentName} value={departmentName}>{departmentName}</option>)}</select></label>}
        <label><span>Staff member</span><select value={filterStaff} onChange={(event) => setFilterStaff(event.target.value)}><option value="all">All staff in {canViewAll ? filterDept : myStaff?.department}</option>{staff.filter((member) => (canViewAll ? member.department === filterDept : member.department === myStaff?.department) && member.id !== myStaff?.id).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
      </section>}

      <nav className="overtime-management-status-tabs" aria-label="Overtime status">
        <button type="button" className={tab === 'pending' ? 'active' : ''} onClick={() => setTab('pending')}>Pending <span>{pendingCount}</span></button>
        <button type="button" className={tab === 'approved' ? 'active' : ''} onClick={() => setTab('approved')}>Approved <span>{approvedCount}</span></button>
        <button type="button" className={tab === 'rejected' ? 'active' : ''} onClick={() => setTab('rejected')}>Rejected <span>{rejectedCount}</span></button>
      </nav>
      {showForm && (canViewAll || !isExcludedFromOT(myStaff?.name, myStaff?.position)) && (
        <form className="staff-form overtime-management-form" onSubmit={handleSubmit}>
          <div style={{ gridColumn: 'span 2', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>
            {editingId ? '✏️ Edit Overtime' : '⏰ Request Overtime'}
          </div>
          
          {canManageAll && !editingId && (
            <select value={formDept} onChange={(e) => { setFormDept(e.target.value); setFormStaffId(''); }} required style={selectStyle}>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}

          {canManageAll && !editingId ? (
            <select value={formStaffId} onChange={(e) => setFormStaffId(e.target.value)} required style={selectStyle}>
              <option value="">Select Staff...</option>
              {staff.filter(s => s.department === formDept && !isExcludedFromOT(s.name, s.position)).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.sn})</option>)}
            </select>
          ) : (
            <input value={myStaff ? `${myStaff.name}` : 'Not linked'} disabled />
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Date</label>
            <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
             <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Start / End Time</label>
             <div style={{ display: 'flex', gap: '4px' }}>
               <input type="time" value={formStart} onChange={(e) => setFormStart(e.target.value)} required style={{ flex: 1 }} />
               <input type="time" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} required style={{ flex: 1 }} />
             </div>
          </div>
          
          <input placeholder="Notes (optional)" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} style={{ gridColumn: 'span 2' }} />
          <button type="submit" disabled={submitting} style={{ gridColumn: 'span 2' }}>{submitting ? 'Saving...' : 'Save Entry'}</button>
        </form>
      )}

      {weekKeys.length === 0 ? (
        <div className="staff-list"><div className="empty-state"><p>No {tab} OT entries for this period.</p></div></div>
      ) : (
        weekKeys.map((weekKey) => {
          const weekEntries = weekMap[weekKey];
          const firstEntry = weekEntries[0];
          if (!firstEntry) return null;
          const weekStart = weekKey.split('::')[1] || INITIAL_DATE;
          const weekTotal = weekEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
          
          const sampleStaff = staff.find(s => s.id === firstEntry.staffId);
          const isAdminDept = sampleStaff?.department === 'Administration';
          const targetHours = isAdminDept ? otRules.adminHours : otRules.regularHours;

          const weekEnd = getWeekEnd(weekStart);
          const weekLeaves = leaveReqs.filter(r => 
            r.staffId === firstEntry.staffId && r.status === 'approved' && otRules.deductLeaves.includes(r.leaveType) && r.startDate <= weekEnd && r.endDate >= weekStart
          );
          
          let deductionHours = 0;
          weekLeaves.forEach(l => {
            const s = new Date(l.startDate + 'T00:00:00');
            const e = new Date(l.endDate + 'T00:00:00');
            let count = 0;
            for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
              const dStr = formatDate(d);
              if (dStr >= weekStart && dStr <= weekEnd) count++;
            }
            deductionHours += count * 8;
          });

          const adjustedTarget = Math.max(0, targetHours - deductionHours);
          const isOver = weekTotal > adjustedTarget;
          const eligible = Math.max(0, weekTotal - adjustedTarget);

          return (
            <section key={weekKey} className="overtime-week-card">
              <header className={isOver ? 'overtime-week-card__header is-eligible' : 'overtime-week-card__header'}>
                <span>Week: {formatDisplay(weekStart)} – {formatDisplay(weekEnd)}</span>
                <span>Total: {weekTotal.toFixed(2)} hrs {isOver ? `· ✅ Eligible (${eligible.toFixed(2)} OT)` : `· ${(adjustedTarget - weekTotal).toFixed(2)} hrs to ${adjustedTarget}`}</span>
              </header>
              <div className="staff-list overtime-week-card__table-wrap">
                <table className="overtime-management-table">
                  <thead><tr><th>Date</th><th>Day</th>{viewMode === 'department' && <th>Staff</th>}<th>Time</th><th>Hours</th><th>Notes</th><th>Requested by / time</th><th>Status / decision audit</th><th>Actions</th></tr></thead>
                  <tbody>
                    {weekEntries.map((e) => {
                      const entryStaffRec = staff.find(s => s.id === e.staffId);
                      const isEntrySMT = entryStaffRec?.isSmt === true || entryStaffRec?.isSMT === true;
                      const canManage = canEditThisDept(e.staffDepartment, isEntrySMT);
                      const approverName = e.reviewedBy ? (staff.find(s => (s.email || '').toLowerCase() === e.reviewedBy.toLowerCase())?.name || e.reviewedBy) : null;
                      const requesterName = e.createdBy ? (staff.find(s => (s.email || '').toLowerCase() === e.createdBy.toLowerCase())?.name || e.createdBy) : 'System';
                      
                      return (
                        <tr key={e.id}>
                          <td>{formatDisplay(e.date)}</td>
                          <td>{getDayShort(e.date)}</td>
                          {viewMode === 'department' && <td><strong>{e.staffName}</strong> {isEntrySMT && '⭐'}</td>}
                          <td style={{ fontSize: '12px' }}>{e.startTime} – {e.endTime}</td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{e.hours}</td>
                          <td style={{ fontSize: '12px', color: '#64748b' }}>{e.notes || '—'}</td>
                          <td><div className="request-audit"><strong>{requesterName}</strong><span>{formatAuditDate(e.createdAt)}</span></div></td>
                          <td><span className={`status-badge status-${String(e.status || 'pending').toLowerCase()}`}>{String(e.status || 'pending').toUpperCase()}</span><div className="request-audit decision"><strong>{approverName || 'Awaiting decision'}</strong><span>{formatAuditDate(e.reviewedAt)}</span></div></td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {tab === 'pending' && canApproveThisDept(e.staffDepartment, isEntrySMT) && e.staffId !== myStaff?.id && (
                              <>
                                <button className="approve-btn" onClick={() => setApproveTarget(e.id)}>✓</button>
                                <button className="reject-btn" onClick={() => setRejectTarget(e.id)}>✕</button>
                              </>
                            )}
                            {canManage && <button className="edit-btn" onClick={() => handleEditClick(e)} style={{ marginLeft: '6px' }}>Edit</button>}
                            {canManage && <button className="delete-btn" onClick={() => setDeleteTarget(e.id)} style={{ marginLeft: '6px' }}>Delete</button>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}

      <ConfirmDialog isOpen={!!approveTarget} title="Approve OT?" message="Are you sure you want to approve this OT entry?" confirmText="Approve" isDanger={false} onConfirm={confirmApprove} onCancel={() => setApproveTarget(null)} />
      <ConfirmDialog isOpen={!!rejectTarget} title="Reject OT?" message="Are you sure you want to reject this OT entry?" confirmText="Reject" isDanger={true} onConfirm={confirmReject} onCancel={() => setRejectTarget(null)} />
      <ConfirmDialog isOpen={!!deleteTarget} title="Delete Entry?" message="Permanently delete this OT entry?" confirmText="Delete" isDanger={true} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}

export default OvertimePage;