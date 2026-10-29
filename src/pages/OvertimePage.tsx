import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import { ConfirmDialog } from '../components/Dialogs';

const DEPARTMENTS = ['Ground Operations', 'Maintenance', 'Security', 'Fire & Rescue', 'Administration', 'Safety'];

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
  const { profile, user, tempAccess } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [leaveReqs, setLeaveReqs] = useState<any[]>([]);
  const [myStaff, setMyStaff] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const [otRules, setOtRules] = useState({ adminHours: 40, regularHours: 48, deductLeaves: ['SICK LEAVE', 'SICK LEAVE / MC'] });

  const [monthFilter, setMonthFilter] = useState<string>(formatDate(new Date()).slice(0, 7));
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [viewMode, setViewMode] = useState<'individual' | 'department'>('individual');
  const [filterDept, setFilterDept] = useState<string>('Ground Operations');
  const [filterStaff, setFilterStaff] = useState<string>('all');
  
  const [showForm, setShowForm] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formDept, setFormDept] = useState<string>('Ground Operations');
  const [formStaffId, setFormStaffId] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(formatDate(new Date()));
  const [formStart, setFormStart] = useState<string>('14:00');
  const [formEnd, setFormEnd] = useState<string>('16:00');
  const [formNotes, setFormNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [approveTarget, setApproveTarget] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [otData, staffData, leaveData, rulesData] = await Promise.all([
        apiFetch('/overtime'), apiFetch('/staff'), apiFetch('/leave-requests'), apiFetch('/settings/ot_rules')
      ]);
      
      setEntries(otData);
      setStaff(staffData);
      setLeaveReqs(leaveData);
      if (rulesData) setOtRules(rulesData);

      const mine = staffData.find((s: any) => (s.email || '').toLowerCase() === (user?.email || '').toLowerCase());
      setMyStaff(mine || null);
      if (mine && !formStaffId) {
        setFormStaffId(mine.id);
        setFilterDept(mine.department);
        setFormDept(mine.department);
      }
      setLoading(false);
    } catch (err: any) {
      toast.error(err.message);
      setLoading(false);
    }
  }, [user, formStaffId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const isDev = profile?.role === 'developer';
  const isManager = profile?.role === 'manager' || profile?.role === 'admin';
  const isSMT = profile?.role === 'smt' || myStaff?.isSMT === true;
  
  const canViewAll = isDev || isManager;
  
  // Approval: Dev/Manager → always; Safety→Security; Temp → target;
  //           SMT requester → only Incharge of dept; standard → dept SMT
  const canApproveThisDept = (dept: string, isSMTRequester: boolean = false) => {
    if (canViewAll) return true;

    const target = (dept || '').toLowerCase();
    const current = (myStaff?.department || '').toLowerCase();
    const isIncharge = myStaff?.isIncharge === true;

    // Safety has full access to Security department
    if (current === 'safety' && target === 'security') return true;

    // Temp access
    if (tempAccess.some((t: any) => t.targetDept.toLowerCase() === target)) return true;

    // SMT requester → only Department Incharge can approve
    if (isSMTRequester) {
      return isIncharge && current === target;
    }

    // Standard requester → Dept SMT can approve within own dept
    if (!isSMT) return false;
    return current === target;
  };

  const canEditThisDept = (dept: string, isSMTRequester: boolean = false) => {
    return canViewAll || canApproveThisDept(dept, isSMTRequester);
  };

  const isExcludedFromOT = (staffName: string, position: string) => {
    const n = (staffName || '').toLowerCase();
    const p = (position || '').toLowerCase();
    return n.includes('manager') || p.includes('manager') || p.includes('assistant manager');
  };

  let filtered = entries.filter((e) => (e.date || '').startsWith(monthFilter));
  
  if (canViewAll || isSMT) {
    if (viewMode === 'individual' && myStaff) {
      filtered = filtered.filter((e) => e.staffId === myStaff.id);
    } else {
      filtered = filtered.filter((e) => e.staffId !== myStaff?.id); 
      if (filterStaff !== 'all') {
        filtered = filtered.filter((e) => e.staffId === filterStaff);
      } else {
        filtered = filtered.filter((e) => {
          const entryStaff = staff.find(s => s.id === e.staffId);
          return canApproveThisDept(e.staffDepartment, entryStaff?.isSMT === true);
        });
      }
    }
  } else {
    filtered = filtered.filter((e) => myStaff && e.staffId === myStaff.id);
  }

  filtered = filtered.filter(e => (e.status || 'approved').toLowerCase() === tab);

  filtered.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const weekMap: { [key: string]: any[] } = {};
  filtered.forEach((e) => {
    const weekKey = getWeekStart(e.date);
    if (!weekMap[weekKey]) weekMap[weekKey] = [];
    weekMap[weekKey].push(e);
  });
  const weekKeys = Object.keys(weekMap).sort();

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
    <div className="page-content">
      <div className="staff-header">
        <h2>Overtime Sheet</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} style={selectStyle} />
          {!isExcludedFromOT(myStaff?.name, myStaff?.position) && (
            <button className="add-staff-btn" onClick={() => { setShowForm(!showForm); setEditingId(null); setFormNotes(''); }}>{showForm ? 'Cancel' : '+ Request OT'}</button>
          )}
        </div>
      </div>

      {(canViewAll || isSMT || tempAccess.length > 0) && (
        <div className="leave-tabs" style={{ marginBottom: '16px' }}>
          <button className={viewMode === 'individual' ? 'leave-tab active' : 'leave-tab'} onClick={() => setViewMode('individual')}>👤 My Individual OT</button>
          <button className={viewMode === 'department' ? 'leave-tab active' : 'leave-tab'} onClick={() => setViewMode('department')}>🏢 Department OT</button>
        </div>
      )}

      {viewMode === 'department' && (canViewAll || isSMT) && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {canViewAll && (
            <select value={filterDept} onChange={(e) => { setFilterDept(e.target.value); setFilterStaff('all'); }} style={selectStyle}>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          <select value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)} style={selectStyle}>
            <option value="all">All Staff in {canViewAll ? filterDept : myStaff?.department}</option>
            {staff.filter(s => (canViewAll ? s.department === filterDept : s.department === myStaff?.department) && s.id !== myStaff?.id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}

      <div className="leave-tabs" style={{ marginBottom: '16px' }}>
        <button className={tab === 'pending' ? 'leave-tab active' : 'leave-tab'} onClick={() => setTab('pending')}>Pending</button>
        <button className={tab === 'approved' ? 'leave-tab active' : 'leave-tab'} onClick={() => setTab('approved')}>Approved</button>
        <button className={tab === 'rejected' ? 'leave-tab active' : 'leave-tab'} onClick={() => setTab('rejected')}>Rejected</button>
      </div>

      {showForm && !isExcludedFromOT(myStaff?.name, myStaff?.position) && (
        <form className="staff-form" onSubmit={handleSubmit}>
          <div style={{ gridColumn: 'span 2', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>
            {editingId ? '✏️ Edit Overtime' : '⏰ Request Overtime'}
          </div>
          
          {canViewAll && !editingId && (
            <select value={formDept} onChange={(e) => { setFormDept(e.target.value); setFormStaffId(''); }} required style={selectStyle}>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}

          {canViewAll && !editingId ? (
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
          const weekTotal = weekEntries.reduce((sum, e) => sum + (e.hours || 0), 0);
          
          const sampleStaff = staff.find(s => s.id === weekEntries[0].staffId);
          const isAdminDept = sampleStaff?.department === 'Administration';
          const targetHours = isAdminDept ? otRules.adminHours : otRules.regularHours;

          const weekEnd = getWeekEnd(weekKey);
          const weekLeaves = leaveReqs.filter(r => 
            r.staffId === weekEntries[0].staffId && r.status === 'approved' && otRules.deductLeaves.includes(r.leaveType) && r.startDate <= weekEnd && r.endDate >= weekKey
          );
          
          let deductionHours = 0;
          weekLeaves.forEach(l => {
            const s = new Date(l.startDate + 'T00:00:00');
            const e = new Date(l.endDate + 'T00:00:00');
            let count = 0;
            for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
              const dStr = formatDate(d);
              if (dStr >= weekKey && dStr <= weekEnd) count++;
            }
            deductionHours += count * 8;
          });

          const adjustedTarget = Math.max(0, targetHours - deductionHours);
          const isOver = weekTotal > adjustedTarget;
          const eligible = Math.max(0, weekTotal - adjustedTarget);

          return (
            <div key={weekKey} style={{ marginBottom: '20px' }}>
              <div style={{ padding: '12px', borderTopLeftRadius: '8px', borderTopRightRadius: '8px', fontWeight: 700, fontSize: '13px', display: 'flex', justifyContent: 'space-between', backgroundColor: isOver ? '#dcfce7' : '#f1f5f9', color: isOver ? '#065f46' : '#475569' }}>
                <span>Week: {formatDisplay(weekKey)} – {formatDisplay(weekEnd)}</span>
                <span>Total: {weekTotal.toFixed(2)} hrs {isOver ? `· ✅ Eligible (${eligible.toFixed(2)} OT)` : `· ${(adjustedTarget - weekTotal).toFixed(2)} hrs to ${adjustedTarget}`}</span>
              </div>
              <div className="staff-list" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                <table>
                  <thead><tr><th>Date</th><th>Day</th>{viewMode === 'department' && <th>Staff</th>}<th>Time</th><th>Hours</th><th>Notes</th><th>Status / Approved By</th><th>Actions</th></tr></thead>
                  <tbody>
                    {weekEntries.map((e) => {
                      const entryStaffRec = staff.find(s => s.id === e.staffId);
                      const isEntrySMT = entryStaffRec?.isSMT === true;
                      const canManage = canEditThisDept(e.staffDepartment, isEntrySMT);
                      const approverName = e.reviewedBy ? (staff.find(s => (s.email || '').toLowerCase() === e.reviewedBy.toLowerCase())?.name || e.reviewedBy) : null;
                      
                      return (
                        <tr key={e.id}>
                          <td>{formatDisplay(e.date)}</td>
                          <td>{getDayShort(e.date)}</td>
                          {viewMode === 'department' && <td><strong>{e.staffName}</strong> {isEntrySMT && '⭐'}</td>}
                          <td style={{ fontSize: '12px' }}>{e.startTime} – {e.endTime}</td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{e.hours}</td>
                          <td style={{ fontSize: '12px', color: '#64748b' }}>{e.notes || '—'}</td>
                          <td>
                            {tab !== 'pending' && approverName && (
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                {tab === 'approved' ? '✅ Approved' : '❌ Rejected'} by:<br/><strong>{approverName}</strong>
                              </div>
                            )}
                          </td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {tab === 'pending' && canManage && (
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
            </div>
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