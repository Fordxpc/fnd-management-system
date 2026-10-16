import { useState, useEffect } from 'react';
import {
  collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../auth';

// ===== UPDATED OT RATES =====
const OT_RATES: { [key: string]: number } = {
  'Weekday OT': 1.25,
  'Friday / Off-day OT': 1.5,
  'Holiday OT': 1.5,
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

const detectOTType = (dateStr: string, holidayDates: Set<string>): string => {
  if (holidayDates.has(dateStr)) return 'Holiday OT';
  if (isFriday(dateStr)) return 'Friday / Off-day OT';
  return 'Weekday OT';
};

function OvertimePage() {
  const { profile, user } = useAuth();

  const isDeveloper: boolean = DEVELOPER_ROLES.includes(profile?.role || '');

  const [records, setRecords] = useState<any[]>([]);
  const [myStaff, setMyStaff] = useState<any>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [rosterEntries, setRosterEntries] = useState<any[]>([]);
  const [tab, setTab] = useState<string>('pending');
  const [filterDept, setFilterDept] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [monthFilter, setMonthFilter] = useState<string>(formatDate(new Date()).slice(0, 7));

  const [showMySummary, setShowMySummary] = useState<boolean>(true);
  const [showDeptSummary, setShowDeptSummary] = useState<boolean>(false);

  const [showForm, setShowForm] = useState<boolean>(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [date, setDate] = useState<string>(formatDate(new Date()));
  const [startTime, setStartTime] = useState<string>('14:00');
  const [endTime, setEndTime] = useState<string>('16:00');
  const [otType, setOtType] = useState<string>('Weekday OT');
  const [otTypeAuto, setOtTypeAuto] = useState<boolean>(true);
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
    const unsub = onSnapshot(collection(db, 'overtime_records'), (snap) => {
      setRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'holidays'), (snap) => {
      setHolidays(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'roster_entries'), (snap) => {
      setRosterEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const holidaySet: Set<string> = new Set(holidays.map((h: any) => h.date));

  useEffect(() => {
    if (otTypeAuto) {
      setOtType(detectOTType(date, holidaySet));
    }
  }, [date, otTypeAuto, holidays]);

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

  const computeHours = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let minutes = (eh * 60 + em) - (sh * 60 + sm);
    if (minutes < 0) minutes += 24 * 60;
    return Math.round((minutes / 60) * 100) / 100;
  };

  // Count Friday / Holiday shifts from the roster for a staff member in a given month
  const countHolidayShifts = (staffId: string, month: string): number => {
    return rosterEntries.filter((e: any) => {
      if (e.staffId !== staffId) return false;
      if (e.status !== 'scheduled') return false;
      if (!e.date || !e.date.startsWith(month)) return false;
      return isFriday(e.date) || holidaySet.has(e.date);
    }).length;
  };

  const previewHours = computeHours(startTime, endTime);
  const previewRate = OT_RATES[otType] || 1.25;

  const visibleRecords: any[] = records
    .filter((r: any): boolean => {
      if (!isDeptManager) {
        if (!myStaff) return false;
        return r.staffId === myStaff.id;
      }
      if (filterDept !== 'all' && r.staffDepartment !== filterDept) return false;
      return true;
    })
    .filter((r: any): boolean => (tab === 'all' ? true : r.status === tab))
    .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));

  // My monthly summary
  const myRecords = records.filter(
    (r: any) => myStaff && r.staffId === myStaff.id && r.status === 'approved'
  );
  const myMonthRecords = myRecords.filter((r: any) => (r.date || '').startsWith(monthFilter));
  const myMonthlyHours = myMonthRecords.reduce((sum: number, r: any) => sum + (r.hours || 0), 0);
  const myMonthlyPayable = myMonthRecords.reduce(
    (sum: number, r: any) => sum + (r.hours || 0) * (r.rateMultiplier || 1),
    0
  );
  const myHolidayShiftCount = myStaff ? countHolidayShifts(myStaff.id, monthFilter) : 0;
  const myHolidayAllowance =
    myHolidayShiftCount * (Number(myStaff?.holidayAllowanceRate) || 0);

  // Department summary
  const deptStaff = staffList
    .filter((s: any) => {
      if (s.isSMT === true) return false;
      if (s.department === 'Administration') return false;
      if (canApproveAny || isDeveloper) return true;
      if (myStaff?.department) return s.department === myStaff.department;
      return false;
    })
    .sort((a: any, b: any) => (a.sn || '').localeCompare(b.sn || ''));

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!selectedStaffId) {
      alert('Please select a staff member');
      return;
    }
    const hours = computeHours(startTime, endTime);
    if (hours <= 0) {
      alert('End time must be after start time');
      return;
    }
    const staff = staffList.find((s) => s.id === selectedStaffId);
    if (!staff) {
      alert('Staff not found');
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'overtime_records'), {
        staffId: selectedStaffId,
        staffName: staff.name,
        staffDepartment: staff.department,
        staffSN: staff.sn || '',
        date,
        startTime,
        endTime,
        hours,
        otType,
        rateMultiplier: OT_RATES[otType] || 1.25,
        reason,
        status: 'pending',
        requestedAt: new Date().toISOString(),
        requestedBy: user?.email || '',
      });
      alert(`Overtime submitted: ${hours} hour(s) at ${OT_RATES[otType] || 1.25}×`);
      setShowForm(false);
      setReason('');
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
    setSubmitting(false);
  };

  const handleApprove = async (r: any) => {
    if (myStaff && r.staffId === myStaff.id) {
      alert('You cannot approve your own overtime. Ask another manager.');
      return;
    }
    const ok = window.confirm(
      `Approve ${r.hours} hour(s) of ${r.otType} for ${r.staffName}?\n` +
      `Date: ${formatDisplay(r.date)}\n` +
      `${r.startTime} – ${r.endTime}\n` +
      `Rate: ${r.rateMultiplier}×`
    );
    if (!ok) return;

    try {
      await updateDoc(doc(db, 'overtime_records', r.id), {
        status: 'approved',
        reviewedBy: user?.email || '',
        reviewedAt: new Date().toISOString(),
      });
      alert('Approved!');
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const handleReject = async (r: any) => {
    const note = window.prompt('Reason for rejection (optional):');
    if (note === null) return;
    try {
      await updateDoc(doc(db, 'overtime_records', r.id), {
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
    const ok = window.confirm('Delete this overtime record?');
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'overtime_records', r.id));
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const exportMonthlyCSV = () => {
    const rows = [
      ['SN', 'Name', 'Department', 'Date', 'OT Type', 'Start', 'End', 'Hours', 'Rate', 'Payable Hours', 'Status', 'Reviewed By'],
    ];
    const monthRecords = records
      .filter((r: any) => (r.date || '').startsWith(monthFilter))
      .filter((r: any) => {
        if (!isDeptManager) return myStaff && r.staffId === myStaff.id;
        if (filterDept !== 'all' && r.staffDepartment !== filterDept) return false;
        return true;
      })
      .sort((a: any, b: any) => (a.date || '').localeCompare(b.date || ''));

    monthRecords.forEach((r: any) => {
      rows.push([
        r.staffSN || '',
        r.staffName || '',
        r.staffDepartment || '',
        r.date || '',
        r.otType || '',
        r.startTime || '',
        r.endTime || '',
        String(r.hours || 0),
        String(r.rateMultiplier || 1),
        String(Math.round((r.hours || 0) * (r.rateMultiplier || 1) * 100) / 100),
        r.status || '',
        r.reviewedBy || '',
      ]);
    });

    const csv = rows.map((row) => row.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `FND-Overtime-${monthFilter}.csv`;
    link.click();
  };

  const handlePrint = () => {
    document.body.classList.add('printing-roster');
    setTimeout(() => {
      window.print();
      document.body.classList.remove('printing-roster');
    }, 100);
  };

  if (loading) {
    return <div className="page-content"><p>Loading...</p></div>;
  }

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>Overtime &amp; Allowances</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="month"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontFamily: 'inherit',
              fontSize: '13px',
            }}
          />
          <button className="export-btn jpg-btn" onClick={exportMonthlyCSV}>
            📥 CSV
          </button>
          <button className="export-btn print-btn" onClick={handlePrint}>
            🖨️ Print
          </button>
          <button className="add-staff-btn" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Log Overtime'}
          </button>
        </div>
      </div>

      {/* ===== My Summary ===== */}
      {myStaff && (
        <div className="collapsible-card">
          <button
            className="collapsible-header"
            onClick={() => setShowMySummary(!showMySummary)}
          >
            <span>
              <strong>My Overtime &amp; Allowances — {monthFilter}</strong>
              <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500, marginLeft: '10px' }}>
                {myMonthlyHours.toFixed(2)} OT hrs · MVR {myHolidayAllowance.toFixed(2)} holiday allowance
              </span>
            </span>
            <span className="collapsible-toggle">{showMySummary ? '▼' : '▶'}</span>
          </button>

          {showMySummary && (
            <div className="collapsible-body">
              <div className="balance-grid">
                <div className="balance-item">
                  <span className="balance-label">OT records this month</span>
                  <span className="balance-value">{myMonthRecords.length}</span>
                </div>
                <div className="balance-item">
                  <span className="balance-label">Total OT hours</span>
                  <span className="balance-value">{myMonthlyHours.toFixed(2)}</span>
                </div>
                <div className="balance-item">
                  <span className="balance-label">Payable OT hours (× rate)</span>
                  <span className="balance-value">{myMonthlyPayable.toFixed(2)}</span>
                </div>
                <div className="balance-item">
                  <span className="balance-label">Friday / Holiday shifts worked</span>
                  <span className="balance-value">{myHolidayShiftCount}</span>
                </div>
                <div className="balance-item">
                  <span className="balance-label">Holiday Allowance</span>
                  <span className="balance-value">MVR {myHolidayAllowance.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== Department Summary ===== */}
      {isDeptManager && deptStaff.length > 0 && (
        <div className="collapsible-card">
          <button
            className="collapsible-header"
            onClick={() => setShowDeptSummary(!showDeptSummary)}
          >
            <span>
              <strong>
                {canApproveAny || isDeveloper
                  ? '👥 All Staff — Overtime & Allowances'
                  : `👥 ${myStaff?.department || ''} — Overtime & Allowances`}
              </strong>
              <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500, marginLeft: '10px' }}>
                ({deptStaff.length} staff · {monthFilter})
              </span>
            </span>
            <span className="collapsible-toggle">{showDeptSummary ? '▼' : '▶'}</span>
          </button>

          {showDeptSummary && (
            <div className="collapsible-body">
              <div style={{ overflowX: 'auto' }}>
                <table className="dept-balance-table">
                  <thead>
                    <tr>
                      <th>SN</th>
                      <th>Name</th>
                      <th>Dept</th>
                      <th>OT Records</th>
                      <th>Total OT Hours</th>
                      <th>Payable OT</th>
                      <th>Holiday Shifts</th>
                      <th>Holiday Allowance</th>
                      <th>Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptStaff.map((s: any) => {
                      const stMonthRecords = records.filter(
                        (r: any) =>
                          r.staffId === s.id &&
                          r.status === 'approved' &&
                          (r.date || '').startsWith(monthFilter)
                      );
                      const pendingCount = records.filter(
                        (r: any) =>
                          r.staffId === s.id &&
                          r.status === 'pending' &&
                          (r.date || '').startsWith(monthFilter)
                      ).length;
                      const totalHours = stMonthRecords.reduce((sum: number, r: any) => sum + (r.hours || 0), 0);
                      const payableHours = stMonthRecords.reduce(
                        (sum: number, r: any) => sum + (r.hours || 0) * (r.rateMultiplier || 1),
                        0
                      );
                      const holShifts = countHolidayShifts(s.id, monthFilter);
                      const allowance = holShifts * (Number(s.holidayAllowanceRate) || 0);

                      return (
                        <tr key={s.id}>
                          <td>{s.sn || '—'}</td>
                          <td><strong>{s.name}</strong></td>
                          <td style={{ fontSize: '12px' }}>{s.department}</td>
                          <td style={{ textAlign: 'center' }}>{stMonthRecords.length}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{totalHours.toFixed(2)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: '#065f46' }}>
                            {payableHours.toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: '#1d4ed8' }}>
                            {holShifts}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: '#065f46' }}>
                            MVR {allowance.toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'center', color: pendingCount > 0 ? '#92400e' : '#94a3b8', fontWeight: 600 }}>
                            {pendingCount > 0 ? pendingCount : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '10px' }}>
                <strong>OT Rates:</strong> Weekday 1.25× · Friday / Off-day 1.5× · Holiday 1.5×<br />
                <strong>Holiday Allowance:</strong> MVR per Friday or holiday shift worked (from each staff's profile).
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <form className="staff-form" onSubmit={handleSubmit}>
          <div style={{ gridColumn: 'span 2', marginBottom: '4px', fontWeight: 600, color: '#1e293b' }}>
            ⏰ Log Overtime
          </div>

          {isDeptManager ? (
            <select value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)} required>
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

          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Start Time</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>End Time</label>
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>OT Type</label>
            <select value={otType} onChange={(e) => { setOtType(e.target.value); setOtTypeAuto(false); }}>
              {Object.keys(OT_RATES).map((t) => (
                <option key={t} value={t}>{t} ({OT_RATES[t]}×)</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '22px' }}>
            <input
              type="checkbox"
              id="otAuto"
              checked={otTypeAuto}
              onChange={(e) => setOtTypeAuto(e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            <label htmlFor="otAuto" style={{ fontSize: '12px', color: '#64748b', cursor: 'pointer' }}>
              Auto-detect from date
            </label>
          </div>

          <input
            placeholder="Reason / details (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ gridColumn: 'span 2' }}
          />

          <div style={{ gridColumn: 'span 2', fontSize: '13px', color: '#475569', padding: '10px 12px', background: '#f1f5f9', borderRadius: '6px' }}>
            <div><strong>Duration:</strong> {previewHours} hour(s)</div>
            <div><strong>Rate:</strong> {previewRate}× ({otType})</div>
            <div><strong>Payable:</strong> {(previewHours * previewRate).toFixed(2)} hours</div>
            {isFriday(date) && otTypeAuto && (
              <div style={{ fontSize: '11px', color: '#92400e', marginTop: '4px' }}>
                ℹ️ This date is a Friday — auto rate set to 1.5×
              </div>
            )}
            {holidaySet.has(date) && (
              <div style={{ fontSize: '11px', color: '#92400e', marginTop: '4px' }}>
                ℹ️ This date is a company holiday — rate set to 1.5×
              </div>
            )}
          </div>

          <button type="submit" disabled={submitting || previewHours <= 0}>
            {submitting ? 'Submitting...' : 'Submit Overtime'}
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
        {visibleRecords.length === 0 ? (
          <div className="empty-state">
            <p>No {tab !== 'all' ? tab : ''} overtime records.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Staff</th>
                <th>Dept</th>
                <th>Date</th>
                <th>Time</th>
                <th>Hours</th>
                <th>Type</th>
                <th>Rate</th>
                <th>Payable</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((r: any) => {
                const canApprove =
                  canApproveRequest(r) && r.status === 'pending' && r.staffId !== myStaff?.id;
                const canDelete = canDeleteRequest(r);
                const payable = ((r.hours || 0) * (r.rateMultiplier || 1)).toFixed(2);
                return (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.staffName}</strong>
                      {r.staffSN && <div style={{ fontSize: '11px', color: '#64748b' }}>{r.staffSN}</div>}
                    </td>
                    <td style={{ fontSize: '12px' }}>{r.staffDepartment || '—'}</td>
                    <td>{formatDisplay(r.date)}</td>
                    <td style={{ fontSize: '12px' }}>{r.startTime} – {r.endTime}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.hours}</td>
                    <td><span className="leave-type-badge">{r.otType}</span></td>
                    <td style={{ textAlign: 'center' }}>{r.rateMultiplier}×</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#065f46' }}>{payable}</td>
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

export default OvertimePage;