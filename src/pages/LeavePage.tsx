import { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc,
  query, where, getDocs
} from 'firebase/firestore';
import { useAuth } from '../auth';

const LEAVE_TYPES = [
  'ANNUAL LEAVE',
  'SICK LEAVE',
  'SICK LEAVE / MC',
  'PATERNITY LEAVE',
  'MATERNITY LEAVE',
  'FAMILY RESPONSIBILITY LEAVE (FRL)',
];

const FULL_ACCESS_ROLES = ['developer', 'manager', 'owner', 'admin', 'smt'];
const FULL_ACCESS_DEPARTMENTS = ['Administration', 'Airport Manager'];

const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDisplay = (dateStr: string) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
};

// Count calendar days between two dates (inclusive)
const countDays = (start: string, end: string) => {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
  return Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
};

// Build a YYYY-MM-DD range from start to end inclusive
const dateRange = (start: string, end: string) => {
  const dates: string[] = [];
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const cur = new Date(s);
  while (cur <= e) {
    dates.push(formatDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
};

function LeavePage() {
  const { profile, user } = useAuth();

  const isAdmin =
    FULL_ACCESS_ROLES.includes(profile?.role) ||
    FULL_ACCESS_DEPARTMENTS.includes(profile?.department);

  const userDepartment = profile?.department;

  const [requests, setRequests] = useState<any[]>([]);
  const [myStaff, setMyStaff] = useState<any>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [leaveType, setLeaveType] = useState('ANNUAL LEAVE');
  const [startDate, setStartDate] = useState(formatDate(new Date()));
  const [endDate, setEndDate] = useState(formatDate(new Date()));
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Load staff list + find "my" staff record by email match
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'staff'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setStaffList(list);

      // Match current user to staff record by email
      const mine = list.find(
        (s: any) => (s.email || '').toLowerCase() === (user?.email || '').toLowerCase()
      );
      setMyStaff(mine || null);
      if (mine) setSelectedStaffId(mine.id);

      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  // Load leave requests
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'leave_requests'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRequests(list);
    });
    return () => unsub();
  }, []);

  // Filter requests based on role + tab + dept
  const visibleRequests = requests
    .filter((r) => {
      // Staff see only their own
      if (!isAdmin) {
        return myStaff && r.staffId === myStaff.id;
      }
      // Admins: filter by dept if set
      if (filterDept !== 'all' && r.staffDepartment !== filterDept) return false;
      return true;
    })
    .filter((r) => {
      if (tab === 'all') return true;
      return r.status === tab;
    })
    .sort((a, b) => (b.requestedAt || '').localeCompare(a.requestedAt || ''));

  // Balance for current staff (approved days this year by type)
  const currentYear = new Date().getFullYear();
  const balance = LEAVE_TYPES.reduce((acc: any, t) => {
    acc[t] = 0;
    return acc;
  }, {});
  if (myStaff) {
    requests
      .filter(
        (r) =>
          r.staffId === myStaff.id &&
          r.status === 'approved' &&
          (r.startDate || '').startsWith(String(currentYear))
      )
      .forEach((r) => {
        if (balance[r.leaveType] !== undefined) balance[r.leaveType] += r.days || 0;
      });
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!selectedStaffId) {
      alert('Please select a staff member');
      return;
    }
    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
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
    const days = countDays(startDate, endDate);

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'leave_requests'), {
        staffId: selectedStaffId,
        staffName: staff.name,
        staffDepartment: staff.department,
        staffSN: staff.sn || '',
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

  // Approve — also creates roster entries
  const handleApprove = async (r: any) => {
    if (!window.confirm(
      `Approve ${r.leaveType} for ${r.staffName}?\n` +
      `${formatDisplay(r.startDate)} to ${formatDisplay(r.endDate)} (${r.days} days)\n\n` +
      `This will mark these days as "${r.leaveType}" on the roster.`
    )) return;

    try {
      // 1. Update the leave request
      await updateDoc(doc(db, 'leave_requests', r.id), {
        status: 'approved',
        reviewedBy: user?.email || '',
        reviewedAt: new Date().toISOString(),
      });

      // 2. Create roster entries for each day
      const days = dateRange(r.startDate, r.endDate);
      for (const d of days) {
        // Remove any existing roster entry for that staff+date
        const q = query(
          collection(db, 'roster_entries'),
          where('staffId', '==', r.staffId),
          where('date', '==', d)
        );
        const existing = await getDocs(q);
        for (const docSnap of existing.docs) {
          await deleteDoc(doc(db, 'roster_entries', docSnap.id));
        }

        // Add new entry with leave status
        await addDoc(collection(db, 'roster_entries'), {
          staffId: r.staffId,
          staffName: r.staffName,
          staffDepartment: r.staffDepartment,
          date: d,
          shiftTime: '',
          status: r.leaveType, // e.g. ANNUAL LEAVE
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
    if (note === null) return; // cancelled

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
    if (!window.confirm('Cancel this leave request?')) return;
    try {
      await updateDoc(doc(db, 'leave_requests', r.id), {
        status: 'cancelled',
        reviewedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

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

      {/* Balance card (only for staff viewing their own) */}
      {myStaff && !isAdmin && (
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

      {/* Request form */}
      {showForm && (
        <form className="staff-form" onSubmit={handleSubmit}>
          <div style={{ gridColumn: 'span 2', marginBottom: '4px', fontWeight: 600, color: '#1e293b' }}>
            📝 New Leave Request
          </div>

          {/* Staff selector (admins can pick anyone; staff sees only themselves) */}
          {isAdmin ? (
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
              value={myStaff ? `${myStaff.name} (${myStaff.sn || 'No SN'})` : 'Not linked'}
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
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>

          <input
            placeholder="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ gridColumn: 'span 2' }}
          />

          <div style={{ gridColumn: 'span 2', fontSize: '13px', color: '#475569', padding: '8px 12px', background: '#f1f5f9', borderRadius: '6px' }}>
            <strong>Total:</strong> {countDays(startDate, endDate)} day(s)
            {endDate < startDate && <span style={{ color: '#dc2626', marginLeft: '8px' }}>⚠ End date is before start date</span>}
          </div>

          <button type="submit" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Leave Request'}
          </button>
        </form>
      )}

      {/* Filters */}
      <div className="leave-tabs">
        <button
          className={tab === 'pending' ? 'leave-tab active' : 'leave-tab'}
          onClick={() => setTab('pending')}
        >
          Pending ({requests.filter((r) => (!isAdmin ? myStaff && r.staffId === myStaff.id : true) && r.status === 'pending').length})
        </button>
        <button
          className={tab === 'approved' ? 'leave-tab active' : 'leave-tab'}
          onClick={() => setTab('approved')}
        >
          Approved
        </button>
        <button
          className={tab === 'rejected' ? 'leave-tab active' : 'leave-tab'}
          onClick={() => setTab('rejected')}
        >
          Rejected
        </button>
        <button
          className={tab === 'all' ? 'leave-tab active' : 'leave-tab'}
          onClick={() => setTab('all')}
        >
          All
        </button>

        {/* Department filter for admins */}
        {isAdmin && (
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            style={{ marginLeft: 'auto', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontFamily: 'inherit' }}
          >
            <option value="all">All Departments</option>
            <option value="Ground Operations">Ground Operations</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Security">Security</option>
            <option value="Fire & Rescue">Fire & Rescue</option>
          </select>
        )}
      </div>

      {/* Requests table */}
      <div className="staff-list" style={{ marginTop: '16px' }}>
        {visibleRequests.length === 0 ? (
          <div className="empty-state">
            <p>No {tab !== 'all' ? tab : ''} leave requests{filterDept !== 'all' ? ` for ${filterDept}` : ''}.</p>
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
              {visibleRequests.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.staffName}</strong>
                    {r.staffSN && <div style={{ fontSize: '11px', color: '#64748b' }}>{r.staffSN}</div>}
                  </td>
                  <td>{r.staffDepartment || '—'}</td>
                  <td>
                    <span className="leave-type-badge">{r.leaveType}</span>
                  </td>
                  <td>{formatDisplay(r.startDate)}</td>
                  <td>{formatDisplay(r.endDate)}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.days}</td>
                  <td>
                    <span className={`status-badge status-${r.status}`}>
                      {r.status.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    {isAdmin && r.status === 'pending' && (
                      <>
                        <button className="approve-btn" onClick={() => handleApprove(r)}>✓ Approve</button>
                        <button className="reject-btn" onClick={() => handleReject(r)}>✕ Reject</button>
                      </>
                    )}
                    {!isAdmin && r.status === 'pending' && myStaff && r.staffId === myStaff.id && (
                      <button className="delete-btn" onClick={() => handleCancelMine(r)}>Cancel</button>
                    )}
                    {r.status !== 'pending' && (
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        {r.reviewedBy ? `By ${r.reviewedBy}` : ''}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default LeavePage;