import { useState, useEffect } from 'react';
import {
  collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc,
  query, where, getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../auth';

const LEAVE_TYPES = [
  'ANNUAL LEAVE',
  'SICK LEAVE',
  'SICK LEAVE / MC',
  'NO PAY LEAVE',
  'PATERNITY LEAVE',
  'MATERNITY LEAVE',
  'FAMILY RESPONSIBILITY LEAVE (FRL)',
];

// Annual leave entitlement per year
const ENTITLEMENTS: { [key: string]: number } = {
  'ANNUAL LEAVE': 30,
  'SICK LEAVE': 15,
  'SICK LEAVE / MC': 15,
  'FAMILY RESPONSIBILITY LEAVE (FRL)': 10,
  'PATERNITY LEAVE': 0,
  'MATERNITY LEAVE': 0,
  'NO PAY LEAVE': 0,
};

const APPROVER_DESIGNATIONS = [
  'Airport Manager',
  'Assistant Manager',
  'Assistant Safety Officer',
  'Senior Airport Officer',
  'Operations Officer',
  'Assistant Operations Officer',
  'Assistant Security Officer',
  'Assistant Administrative Officer',
  'Senior Fire Fighter',
];

const GLOBAL_APPROVERS = ['Airport Manager', 'Assistant Manager'];
const DEVELOPER_ROLES = ['developer'];

const DEPARTMENTS = ['Ground Operations', 'Maintenance', 'Security', 'Fire & Rescue'];

const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDisplay = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const isFriday = (dateStr: string): boolean => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.getDay() === 5;
};

// Build a list of dates in range (inclusive)
const allDatesInRange = (start: string, end: string): string[] => {
  const dates: string[] = [];
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return dates;
  const cur = new Date(s);
  while (cur <= e) {
    dates.push(formatDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
};

// Count annual leave days EXCLUDING Fridays and custom holidays
const countAnnualLeaveDays = (
  start: string,
  end: string,
  holidayDates: Set<string>
): { countable: number; skippedFridays: number; skippedHolidays: number } => {
  const dates = allDatesInRange(start, end);
  let countable = 0;
  let skippedFridays = 0;
  let skippedHolidays = 0;
  for (const d of dates) {
    if (isFriday(d)) {
      skippedFridays++;
    } else if (holidayDates.has(d)) {
      skippedHolidays++;
    } else {
      countable++;
    }
  }
  return { countable, skippedFridays, skippedHolidays };
};

function LeavePage() {
  const { profile, user } = useAuth();

  const isDeveloper: boolean = DEVELOPER_ROLES.includes(profile?.role || '');

  const [requests, setRequests] = useState<any[]>([]);
  const [myStaff, setMyStaff] = useState<any>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [tab, setTab] = useState<string>('pending');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);

  const [showForm, setShowForm] = useState<boolean>(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [leaveType, setLeaveType] = useState<string>('ANNUAL LEAVE');
  const [startDate, setStartDate] = useState<string>(formatDate(new Date()));
  const [endDate, setEndDate] = useState<string>(formatDate(new Date()));
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'staff'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setStaffList(list);
      const mine = list.find(
        (s: any) => (s.email || '').toLowerCase() === (user?.email || '').toLowerCase()
      );
      setMyStaff(mine || null);
      if (mine) setSelectedStaffId(mine.id);
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

  const holidaySet: Set<string> = new Set(holidays.map((h: any) => h.date));

  const canApproveAny: boolean =
    isDeveloper || GLOBAL_APPROVERS.includes(myStaff?.position || '');

  const isDeptManager: boolean =
    canApproveAny || APPROVER_DESIGNATIONS.includes(myStaff?.position || '');

  const canApproveRequest = (r: any): boolean => {
    if (canApproveAny) return true;
    if (!APPROVER_DESIGNATIONS.includes(myStaff?.position || '')) return false;
    if (myStaff?.department === r.staffDepartment) return true;
    return false;
  };

  const canDeleteRequest = (r: any): boolean => {
    if (isDeveloper || isDeptManager) return true;
    if (myStaff && r.staffId === myStaff.id) return true;
    return false;
  };

  const visibleRequests: any[] = requests
    .filter((r: any): boolean => {
      if (!isDeptManager) {
        if (!myStaff) return false;
        return r.staffId === myStaff.id;
      }
      if (filterDept !== 'all' && r.staffDepartment !== filterDept) return false;
      return true;
    })
    .filter((r: any): boolean => (tab === 'all' ? true : r.status === tab))
    .sort((a: any, b: any) =>
      (b.requestedAt || '').localeCompare(a.requestedAt || '')
    );

  const currentYear: number = new Date().getFullYear();
  const usedDays: { [key: string]: number } = {};
  LEAVE_TYPES.forEach((t) => { usedDays[t] = 0; });
  if (myStaff) {
    requests
      .filter(
        (r: any) =>
          r.staffId === myStaff.id &&
          r.status === 'approved' &&
          (r.startDate || '').startsWith(String(currentYear))
      )
      .forEach((r: any) => {
        if (usedDays[r.leaveType] !== undefined) {
          usedDays[r.leaveType] += r.days || 0;
        }
      });
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!selectedStaffId) {
      alert('Please select a staff member');
      return;
    }
    if (endDate < startDate) {
      alert('End date cannot be before start date');
      return;
    }
    const staff = staffList.find((s) => s.id === selectedStaffId);
    if (!staff) {
      alert('Staff not found');
      return;
    }

    // Count days
    let days = 0;
    if (leaveType === 'ANNUAL LEAVE') {
      days = countAnnualLeaveDays(startDate, endDate, holidaySet).countable;
    } else {
      days = allDatesInRange(startDate, endDate).length;
    }

    if (days === 0) {
      alert(
        'This leave period contains no countable days. ' +
        '(For annual leave, Fridays and holidays are excluded.)'
      );
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'leave_requests'), {
        staffId: selectedStaffId,
        staffName: staff.name,
        staffDepartment: staff.department,
        staffSN: staff.sn || '',
        staffIsSMT: staff.isSMT === true,
        leaveType,
        startDate,
        endDate,
        days,
        reason,
        status: 'pending',
        requestedAt: new Date().toISOString(),
        requestedBy: user?.email || '',
      });
      alert(`Leave request submitted (${days} day${days > 1 ? 's' : ''}).`);
      setShowForm(false);
      setReason('');
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
    setSubmitting(false);
  };

  const handleApprove = async (r: any) => {
    if (myStaff && r.staffId === myStaff.id) {
      alert('You cannot approve your own leave request. Ask another manager.');
      return;
    }

    const ok = window.confirm(
      `Approve ${r.leaveType} for ${r.staffName}?\n` +
      `${formatDisplay(r.startDate)} to ${formatDisplay(r.endDate)} (${r.days} days counted)\n\n` +
      `This will mark every day in the range as "${r.leaveType}" on the roster.`
    );
    if (!ok) return;

    try {
      await updateDoc(doc(db, 'leave_requests', r.id), {
        status: 'approved',
        reviewedBy: user?.email || '',
        reviewedAt: new Date().toISOString(),
      });

      // Mark EVERY day in the range (including Fridays and holidays) in the roster
      const dates = allDatesInRange(r.startDate, r.endDate);
      for (const d of dates) {
        const q = query(
          collection(db, 'roster_entries'),
          where('staffId', '==', r.staffId),
          where('date', '==', d)
        );
        const existing = await getDocs(q);
        for (const docSnap of existing.docs) {
          await deleteDoc(doc(db, 'roster_entries', docSnap.id));
        }
        await addDoc(collection(db, 'roster_entries'), {
          staffId: r.staffId,
          staffName: r.staffName,
          staffDepartment: r.staffDepartment,
          date: d,
          shiftTime: '',
          status: r.leaveType,
          leaveRequestId: r.id,
          createdAt: new Date().toISOString(),
        });
      }
      alert('Approved! Roster updated for every day in the range.');
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const handleReject = async (r: any) => {
    const note = window.prompt('Reason for rejection (optional):');
    if (note === null) return;
    try {
      await updateDoc(doc(db, 'leave_requests', r.id), {
        status: 'rejected',
        reviewedBy: user?.email || '',
        reviewedAt: new Date().toISOString(),
        reviewNotes: note || '',
      });
      alert('Rejected.');
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const handleDelete = async (r: any) => {
    const ok = window.confirm(
      `⚠️ DELETE this leave request permanently?\n\n` +
      `${r.staffName} — ${r.leaveType}\n` +
      `${formatDisplay(r.startDate)} to ${formatDisplay(r.endDate)}\n` +
      `Status: ${String(r.status).toUpperCase()}\n\n` +
      `This will also remove any roster entries created by this leave.\n` +
      `This cannot be undone.`
    );
    if (!ok) return;

    try {
      const q = query(
        collection(db, 'roster_entries'),
        where('leaveRequestId', '==', r.id)
      );
      const linkedRoster = await getDocs(q);
      for (const docSnap of linkedRoster.docs) {
        await deleteDoc(doc(db, 'roster_entries', docSnap.id));
      }
      await deleteDoc(doc(db, 'leave_requests', r.id));
      alert('Leave request deleted.');
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  // Preview for the form
  let previewDays = 0;
  let previewFridays = 0;
  let previewHolidays = 0;
  if (startDate && endDate && endDate >= startDate) {
    if (leaveType === 'ANNUAL LEAVE') {
      const r = countAnnualLeaveDays(startDate, endDate, holidaySet);
      previewDays = r.countable;
      previewFridays = r.skippedFridays;
      previewHolidays = r.skippedHolidays;
    } else {
      previewDays = allDatesInRange(startDate, endDate).length;
    }
  }

  if (loading) {
    return <div className="page-content"><p>Loading...</p></div>;
  }

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>Leave Management</h2>
        <button className="add-staff-btn" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Request Leave'}
        </button>
      </div>

      {/* Balance card */}
      {myStaff && !isDeptManager && (
        <div className="leave-balance-card">
          <h3>My Leave Balance ({currentYear})</h3>
          <div className="balance-grid">
            {LEAVE_TYPES.map((t) => {
              const entitlement = ENTITLEMENTS[t] || 0;
              const used = usedDays[t] || 0;
              const remaining = entitlement > 0 ? entitlement - used : null;
              return (
                <div key={t} className="balance-item">
                  <span className="balance-label">{t}</span>
                  <span className="balance-value">
                    {remaining !== null ? `${remaining} / ${entitlement} days` : `${used} days used`}
                  </span>
                  {entitlement > 0 && (
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      {used} used • {entitlement} entitled
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showForm && (
        <form className="staff-form" onSubmit={handleSubmit}>
          <div style={{ gridColumn: 'span 2', marginBottom: '4px', fontWeight: 600, color: '#1e293b' }}>
            📝 New Leave Request
          </div>

          {isDeptManager ? (
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              required
            >
              <option value="">Select Staff Member...</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.sn || 'No SN'}) — {s.department}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={myStaff ? `${myStaff.name} (${myStaff.sn || 'No SN'})` : 'Not linked to a staff record'}
              disabled
            />
          )}

          <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
            {LEAVE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </div>

          <input
            placeholder="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ gridColumn: 'span 2' }}
          />

          <div style={{ gridColumn: 'span 2', fontSize: '13px', color: '#475569', padding: '10px 12px', background: '#f1f5f9', borderRadius: '6px' }}>
            <div><strong>Countable days:</strong> {previewDays}</div>
            {leaveType === 'ANNUAL LEAVE' && previewFridays > 0 && (
              <div style={{ fontSize: '11px', color: '#92400e', marginTop: '4px' }}>
                ℹ️ {previewFridays} Friday{previewFridays > 1 ? 's' : ''} excluded from balance (still marked in roster)
              </div>
            )}
            {leaveType === 'ANNUAL LEAVE' && previewHolidays > 0 && (
              <div style={{ fontSize: '11px', color: '#92400e', marginTop: '4px' }}>
                ℹ️ {previewHolidays} holiday{previewHolidays > 1 ? 's' : ''} excluded from balance (still marked in roster)
              </div>
            )}
            {endDate < startDate && (
              <div style={{ color: '#dc2626', marginTop: '4px' }}>⚠ End date is before start date</div>
            )}
            {previewDays === 0 && endDate >= startDate && (
              <div style={{ color: '#dc2626', marginTop: '4px' }}>⚠ No countable days in this range</div>
            )}
          </div>

          <button type="submit" disabled={submitting || previewDays === 0}>
            {submitting ? 'Submitting...' : 'Submit Leave Request'}
          </button>
        </form>
      )}

      <div className="leave-tabs">
        <button className={tab === 'pending' ? 'leave-tab active' : 'leave-tab'} onClick={() => setTab('pending')}>
          Pending
        </button>
        <button className={tab === 'approved' ? 'leave-tab active' : 'leave-tab'} onClick={() => setTab('approved')}>
          Approved
        </button>
        <button className={tab === 'rejected' ? 'leave-tab active' : 'leave-tab'} onClick={() => setTab('rejected')}>
          Rejected
        </button>
        <button className={tab === 'all' ? 'leave-tab active' : 'leave-tab'} onClick={() => setTab('all')}>
          All
        </button>

        {isDeptManager && (
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            style={{
              marginLeft: 'auto',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontFamily: 'inherit',
            }}
          >
            <option value="all">All Departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        )}
      </div>

      <div className="staff-list" style={{ marginTop: '16px' }}>
        {visibleRequests.length === 0 ? (
          <div className="empty-state">
            <p>
              No {tab !== 'all' ? tab : ''} leave requests
              {filterDept !== 'all' ? ` for ${filterDept}` : ''}.
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Staff</th>
                <th>Dept</th>
                <th>Type</th>
                <th>From</th>
                <th>To</th>
                <th>Days</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRequests.map((r: any) => {
                const canApprove =
                  canApproveRequest(r) &&
                  r.status === 'pending' &&
                  r.staffId !== myStaff?.id;
                const canDelete = canDeleteRequest(r);
                return (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.staffName}</strong>
                      {r.staffIsSMT && (
                        <span style={{ marginLeft: '6px' }} title="SMT Member">⭐</span>
                      )}
                      {r.staffSN && (
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{r.staffSN}</div>
                      )}
                    </td>
                    <td>{r.staffDepartment || '—'}</td>
                    <td><span className="leave-type-badge">{r.leaveType}</span></td>
                    <td>{formatDisplay(r.startDate)}</td>
                    <td>{formatDisplay(r.endDate)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.days}</td>
                    <td>
                      <span className={`status-badge status-${r.status}`}>
                        {String(r.status).toUpperCase()}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {canApprove && (
                        <>
                          <button className="approve-btn" onClick={() => handleApprove(r)}>✓</button>
                          <button className="reject-btn" onClick={() => handleReject(r)}>✕</button>
                        </>
                      )}
                      {canDelete && (
                        <button
                          className="delete-btn"
                          onClick={() => handleDelete(r)}
                          style={{ marginLeft: '6px' }}
                        >
                          🗑 Delete
                        </button>
                      )}
                      {r.status !== 'pending' && (
                        <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                          {r.reviewedBy ? `By ${r.reviewedBy}` : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default LeavePage;