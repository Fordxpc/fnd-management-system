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
  'PATERNITY LEAVE',
  'MATERNITY LEAVE',
  'FAMILY RESPONSIBILITY LEAVE (FRL)',
];

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

// Check if a date string (YYYY-MM-DD) is a Friday
const isFriday = (dateStr: string): boolean => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.getDay() === 5; // Friday
};

// Count days between start and end (inclusive)
// For ANNUAL LEAVE: Fridays are skipped (off day)
const countDays = (start: string, end: string, leaveType: string): number => {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;

  const skipFridays = leaveType === 'ANNUAL LEAVE';
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const dStr = formatDate(cur);
    if (!(skipFridays && isFriday(dStr))) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

// Build a YYYY-MM-DD range from start to end inclusive
// For ANNUAL LEAVE: Fridays are excluded
const dateRange = (start: string, end: string, leaveType: string): string[] => {
  const dates: string[] = [];
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const skipFridays = leaveType === 'ANNUAL LEAVE';
  const cur = new Date(s);
  while (cur <= e) {
    const dStr = formatDate(cur);
    if (!(skipFridays && isFriday(dStr))) {
      dates.push(dStr);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
};

// Count only Fridays in the range (for display info)
const countFridaysInRange = (start: string, end: string): number => {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    if (cur.getDay() === 5) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

function LeavePage() {
  const { profile, user } = useAuth();

  const isDeveloper: boolean = DEVELOPER_ROLES.includes(profile?.role || '');

  const [requests, setRequests] = useState<any[]>([]);
  const [myStaff, setMyStaff] = useState<any>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
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
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRequests(list);
    });
    return () => unsub();
  }, []);

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

  const visibleRequests: any[] = requests
    .filter((r: any): boolean => {
      if (!isDeptManager) {
        if (!myStaff) return false;
        return r.staffId === myStaff.id;
      }
      if (filterDept !== 'all' && r.staffDepartment !== filterDept) return false;
      return true;
    })
    .filter((r: any): boolean => {
      if (tab === 'all') return true;
      return r.status === tab;
    })
    .sort((a: any, b: any) =>
      (b.requestedAt || '').localeCompare(a.requestedAt || '')
    );

  const currentYear: number = new Date().getFullYear();
  const balance: { [key: string]: number } = {};
  LEAVE_TYPES.forEach((t) => { balance[t] = 0; });
  if (myStaff) {
    requests
      .filter(
        (r: any) =>
          r.staffId === myStaff.id &&
          r.status === 'approved' &&
          (r.startDate || '').startsWith(String(currentYear))
      )
      .forEach((r: any) => {
        if (balance[r.leaveType] !== undefined) {
          balance[r.leaveType] += r.days || 0;
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

    const days = countDays(startDate, endDate, leaveType);
    if (days === 0) {
      alert('This leave period contains no countable days (all Fridays for annual leave).');
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
      `${formatDisplay(r.startDate)} to ${formatDisplay(r.endDate)} (${r.days} days)\n\n` +
      `This will mark these days as "${r.leaveType}" on the roster.`
    );
    if (!ok) return;

    try {
      await updateDoc(doc(db, 'leave_requests', r.id), {
        status: 'approved',
        reviewedBy: user?.email || '',
        reviewedAt: new Date().toISOString(),
      });

      // Use dateRange which skips Fridays for annual leave
      const days = dateRange(r.startDate, r.endDate, r.leaveType);
      for (const d of days) {
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
      alert('Approved! Roster updated.');
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

  const handleCancelMine = async (r: any) => {
    const ok = window.confirm('Cancel this leave request?');
    if (!ok) return;
    try {
      await updateDoc(doc(db, 'leave_requests', r.id), {
        status: 'cancelled',
        reviewedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  // Preview values for the form
  const previewDays = countDays(startDate, endDate, leaveType);
  const previewFridays = leaveType === 'ANNUAL LEAVE' ? countFridaysInRange(startDate, endDate) : 0;

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

      {myStaff && !isDeptManager && (
        <div className="leave-balance-card">
          <h3>My Leave Balance ({currentYear})</h3>
          <div className="balance-grid">
            {LEAVE_TYPES.map((t) => (
              <div key={t} className="balance-item">
                <span className="balance-label">{t}</span>
                <span className="balance-value">{balance[t]} days used</span>
              </div>
            ))}
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
            <div>
              <strong>Countable days:</strong> {previewDays}
            </div>
            {previewFridays > 0 && (
              <div style={{ fontSize: '11px', color: '#92400e', marginTop: '4px' }}>
                ℹ️ {previewFridays} Friday{previewFridays > 1 ? 's' : ''} excluded (weekly off day for annual leave)
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
                    <td>
                      {canApprove && (
                        <>
                          <button className="approve-btn" onClick={() => handleApprove(r)}>✓ Approve</button>
                          <button className="reject-btn" onClick={() => handleReject(r)}>✕ Reject</button>
                        </>
                      )}
                      {!isDeptManager && r.status === 'pending' && myStaff && r.staffId === myStaff.id && (
                        <button className="delete-btn" onClick={() => handleCancelMine(r)}>Cancel</button>
                      )}
                      {r.status !== 'pending' && (
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
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