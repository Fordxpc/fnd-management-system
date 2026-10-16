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

const ENTITLEMENTS: { [key: string]: number } = {
  'ANNUAL LEAVE': 30,
  'SICK LEAVE': 15,
  'SICK LEAVE / MC': 15,
  'FAMILY RESPONSIBILITY LEAVE (FRL)': 10,
  'PATERNITY LEAVE': 0,
  'MATERNITY LEAVE': 0,
  'NO PAY LEAVE': 0,
};

// After this many years of service, annual leave renews yearly.
// Before this, new hires get a ONE-TIME 30-day allocation for the whole 2-year period.
const ANNUAL_LEAVE_SERVICE_YEARS = 2;
const ANNUAL_LEAVE_TOTAL = 30;

const APPROVER_DESIGNATIONS = [
  'Airport Manager',
  'Assistant Manager',
  'Assistant Safety Officer',
  'Senior Airport Officer',
  'Operations Officer',
  'Assistant Operations Officer',
  'Assistant Security Officer',
  'Assistant Administrative Officer',
  'Leading Fireman',
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
    if (isFriday(d)) skippedFridays++;
    else if (holidayDates.has(d)) skippedHolidays++;
    else countable++;
  }
  return { countable, skippedFridays, skippedHolidays };
};

// ====== Leave year based on join date anniversary ======
const getCurrentLeaveYear = (joinDateStr: string): { start: Date; end: Date } | null => {
  if (!joinDateStr) return null;
  const jd = new Date(joinDateStr + 'T00:00:00');
  if (isNaN(jd.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let startYear = today.getFullYear();
  let anniversary = new Date(startYear, jd.getMonth(), jd.getDate());
  if (today < anniversary) {
    startYear -= 1;
    anniversary = new Date(startYear, jd.getMonth(), jd.getDate());
  }
  const start = anniversary;
  const end = new Date(startYear + 1, jd.getMonth(), jd.getDate());
  end.setDate(end.getDate() - 1);
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

  // ====== Compute usage ======
  const myYearsOfService = myStaff?.joinDate ? getYearsOfService(myStaff.joinDate) : 0;
  const myIsAnnualRenewing = myYearsOfService >= ANNUAL_LEAVE_SERVICE_YEARS;
  const myLeaveYear = myStaff?.joinDate ? getCurrentLeaveYear(myStaff.joinDate) : null;

  const usedDays: { [key: string]: number } = {};
  LEAVE_TYPES.forEach((t) => { usedDays[t] = 0; });

  if (myStaff && myLeaveYear) {
    const lyStart = formatDate(myLeaveYear.start);
    const lyEnd = formatDate(myLeaveYear.end);

    requests
      .filter((r: any) => r.staffId === myStaff.id && r.status === 'approved')
      .forEach((r: any) => {
        if (usedDays[r.leaveType] === undefined) return;

        // Annual leave for new hires: count ALL usage since join date
        if (r.leaveType === 'ANNUAL LEAVE' && !myIsAnnualRenewing) {
          usedDays[r.leaveType] += r.days || 0;
        }
        // All other cases: only count within current leave year
        else if ((r.startDate || '') >= lyStart && (r.startDate || '') <= lyEnd) {
          usedDays[r.leaveType] += r.days || 0;
        }
      });
  }

  // Helper: compute used annual days for a given staff member
  const computeUsedAnnual = (staffId: string, joinDate: string): number => {
    const years = getYearsOfService(joinDate);
    const renews = years >= ANNUAL_LEAVE_SERVICE_YEARS;
    const ly = getCurrentLeaveYear(joinDate);
    let used = 0;

    requests
      .filter(
        (r: any) =>
          r.staffId === staffId &&
          r.status === 'approved' &&
          r.leaveType === 'ANNUAL LEAVE'
      )
      .forEach((r: any) => {
        if (!renews) {
          used += r.days || 0;
        } else if (ly) {
          const lyStart = formatDate(ly.start);
          const lyEnd = formatDate(ly.end);
          if ((r.startDate || '') >= lyStart && (r.startDate || '') <= lyEnd) {
            used += r.days || 0;
          }
        }
      });
    return used;
  };

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

    // Annual leave eligibility & cap check
    if (leaveType === 'ANNUAL LEAVE') {
      if (!staff.joinDate) {
        alert(
          `${staff.name} does not have a Join Date set.\n\n` +
          `Please add their Join Date on the Staff page first.`
        );
        return;
      }
      const daysForRequest = countAnnualLeaveDays(startDate, endDate, holidaySet).countable;
      const usedAnnual = computeUsedAnnual(staff.id, staff.joinDate);
      const years = getYearsOfService(staff.joinDate);
      const renews = years >= ANNUAL_LEAVE_SERVICE_YEARS;

      if (usedAnnual + daysForRequest > ANNUAL_LEAVE_TOTAL) {
        const rule = renews
          ? `Annual leave renews every year on ${staff.name}'s join-date anniversary.`
          : `New hires have a one-time ${ANNUAL_LEAVE_TOTAL}-day allocation for their first ${ANNUAL_LEAVE_SERVICE_YEARS} years.`;
        alert(
          `⛔ Cannot submit — exceeds annual leave entitlement.\n\n` +
          `Used so far: ${usedAnnual} days\n` +
          `This request: ${daysForRequest} days\n` +
          `Total: ${usedAnnual + daysForRequest} / ${ANNUAL_LEAVE_TOTAL} days\n\n` +
          rule
        );
        return;
      }
    }

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
      `${formatDisplay(r.startDate)} to ${formatDisplay(r.endDate)}\n\n` +
      `Roster entries created by this leave will also be removed.`
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

  // Preview
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

      {/* Balance card — visible to EVERY logged-in staff member */}
      {myStaff && (
        <div className="leave-balance-card">
          <h3>
            My Leave Balance
            {myLeaveYear && myIsAnnualRenewing && (
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, marginLeft: '8px' }}>
                ({formatDisplay(formatDate(myLeaveYear.start))} – {formatDisplay(formatDate(myLeaveYear.end))})
              </span>
            )}
            {myStaff.joinDate && !myIsAnnualRenewing && (
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, marginLeft: '8px' }}>
                (New hire — {ANNUAL_LEAVE_SERVICE_YEARS - myYearsOfService} year(s) until annual renewal)
              </span>
            )}
          </h3>

          {!myStaff.joinDate && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: '6px', marginBottom: '14px', fontSize: '13px', fontWeight: 600 }}>
              ⚠️ Your Join Date is not set. Please ask an administrator to add it.
            </div>
          )}

          <div className="balance-grid">
            {LEAVE_TYPES.map((t) => {
              const isAnnual = t === 'ANNUAL LEAVE';
              const entitlement = ENTITLEMENTS[t] || 0;
              const used = usedDays[t] || 0;

              // Annual leave for new hires — one-time 30-day allocation
              if (isAnnual && !myIsAnnualRenewing && myStaff.joinDate) {
                const remaining = ANNUAL_LEAVE_TOTAL - used;
                return (
                  <div key={t} className="balance-item">
                    <span className="balance-label">{t}</span>
                    <span className="balance-value">{remaining} / {ANNUAL_LEAVE_TOTAL} days</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      One-time allocation (until {ANNUAL_LEAVE_SERVICE_YEARS} yrs of service)
                    </span>
                  </div>
                );
              }

              // Standard display for renewing leaves
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
                ℹ️ {previewFridays} Friday{previewFridays > 1 ? 's' : ''} excluded from balance
              </div>
            )}
            {leaveType === 'ANNUAL LEAVE' && previewHolidays > 0 && (
              <div style={{ fontSize: '11px', color: '#92400e', marginTop: '4px' }}>
                ℹ️ {previewHolidays} holiday{previewHolidays > 1 ? 's' : ''} excluded from balance
              </div>
            )}
            {endDate < startDate && (
              <div style={{ color: '#dc2626', marginTop: '4px' }}>⚠ End date is before start date</div>
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
                  canApproveRequest(r) && r.status === 'pending' && r.staffId !== myStaff?.id;
                const canDelete = canDeleteRequest(r);
                return (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.staffName}</strong>
                      {r.staffIsSMT && <span style={{ marginLeft: '6px' }} title="SMT Member">⭐</span>}
                      {r.staffSN && <div style={{ fontSize: '11px', color: '#64748b' }}>{r.staffSN}</div>}
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