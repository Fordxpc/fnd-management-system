import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import {
  collection, addDoc, onSnapshot, doc, writeBatch,
  query, where, getDocs, deleteDoc
} from 'firebase/firestore';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useAuth } from '../auth';

const ROSTER_DEPARTMENTS = ['Ground Operations', 'Maintenance', 'Security', 'Fire & Rescue'];

const FULL_ACCESS_ROLES = ['developer', 'manager', 'owner', 'admin', 'smt'];
const FULL_ACCESS_DEPARTMENTS = ['Administration', 'Airport Manager'];

const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const monthsFull = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
const monthsShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const daysShort = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const formatLongDate = (date: Date): string =>
  `${date.getDate()} ${monthsFull[date.getMonth()]} ${date.getFullYear()}`;

const formatHeaderDate = (date: Date): string =>
  `${daysShort[date.getDay()]}, ${date.getDate()} ${monthsShort[date.getMonth()]}, ${date.getFullYear()}`;

const getPeriodStart = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  if (d.getDate() >= 16) d.setDate(16);
  else { d.setMonth(d.getMonth() - 1); d.setDate(16); }
  return d;
};

const getPeriodEnd = (start: Date): Date => {
  const d = new Date(start);
  d.setMonth(d.getMonth() + 1);
  d.setDate(15);
  return d;
};

const getSaturdayOnOrBefore = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day + 1) % 7;
  d.setDate(d.getDate() - diff);
  return d;
};

const chunkIntoWeeks = (start: Date, end: Date): Date[][] => {
  const weeks: Date[][] = [];
  let current = getSaturdayOnOrBefore(start);
  while (current <= end) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
};

const sortStaff = (a: any, b: any): number => {
  const aOrder = typeof a.order === 'number' ? a.order : 9999;
  const bOrder = typeof b.order === 'number' ? b.order : 9999;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return (a.sn || '').localeCompare(b.sn || '');
};

const SHIFT_OPTIONS = ['06:00 - 14:00', '08:00 - 16:00', '16:00 - 00:00', '00:00 - 08:00', 'CUSTOM'];

const LEAVE_OPTIONS = [
  'OFF DAY',
  'ANNUAL LEAVE',
  'SICK LEAVE',
  'SICK LEAVE / MC',
  'PATERNITY LEAVE',
  'MATERNITY LEAVE',
  'FAMILY RESPONSIBILITY LEAVE (FRL)',
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function RosterPage() {
  const { profile } = useAuth();

  const isAdmin =
    FULL_ACCESS_ROLES.includes(profile?.role || '') ||
    FULL_ACCESS_DEPARTMENTS.includes(profile?.department || '');

  const userDepartment = profile?.department;

  const [selectedDept, setSelectedDept] = useState<string>('all');

  const [entries, setEntries] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [periodStart, setPeriodStart] = useState<Date>(getPeriodStart(new Date()));
  const [exporting, setExporting] = useState<boolean>(false);
  const [reorderMode, setReorderMode] = useState<boolean>(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // Single-assign state
  const [showForm, setShowForm] = useState<boolean>(false);
  const [staffId, setStaffId] = useState<string>('');
  const [date, setDate] = useState<string>(formatDate(new Date()));
  const [shiftTime, setShiftTime] = useState<string>('06:00 - 14:00');
  const [customShift, setCustomShift] = useState<string>('');
  const [status, setStatus] = useState<string>('scheduled');

  // Bulk-assign state
  const [showBulkForm, setShowBulkForm] = useState<boolean>(false);
  const [bulkStaffId, setBulkStaffId] = useState<string>('');
  const [bulkStartDate, setBulkStartDate] = useState<string>('');
  const [bulkEndDate, setBulkEndDate] = useState<string>('');
  const [bulkDaysOfWeek, setBulkDaysOfWeek] = useState<number[]>([0, 1, 2, 3, 4, 6]);
  const [bulkType, setBulkType] = useState<string>('scheduled');
  const [bulkShift, setBulkShift] = useState<string>('06:00 - 14:00');
  const [bulkCustomShift, setBulkCustomShift] = useState<string>('');
  const [bulkSubmitting, setBulkSubmitting] = useState<boolean>(false);
  const [copying, setCopying] = useState<boolean>(false);

  const periodEnd = getPeriodEnd(periodStart);
  const weeks = chunkIntoWeeks(periodStart, periodEnd);

  const visibleStaff = [...staff]
    .filter((s) => {
      if (isAdmin) {
        if (selectedDept === 'all') return true;
        return s.department === selectedDept;
      }
      return s.department === userDepartment;
    })
    .sort(sortStaff);

  useEffect(() => {
    const unsubStaff = onSnapshot(collection(db, 'staff'), (snapshot) => {
      setStaff(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubRoster = onSnapshot(collection(db, 'roster_entries'), (snapshot) => {
      setEntries(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubStaff(); unsubRoster(); };
  }, []);

  // When period changes, reset bulk dates to the period
  useEffect(() => {
    setBulkStartDate(formatDate(periodStart));
    setBulkEndDate(formatDate(periodEnd));
  }, [periodStart]);

  // ====== SINGLE ASSIGN ======
  const handleAdd = async (e: any) => {
    e.preventDefault();
    if (!staffId) { alert('Please select a staff member'); return; }
    const staffMember = staff.find((s) => s.id === staffId);

    let finalShiftTime = '';
    if (status === 'scheduled') {
      finalShiftTime = shiftTime === 'CUSTOM' ? customShift : shiftTime;
      if (!finalShiftTime) { alert('Please enter the custom shift time'); return; }
    }

    try {
      // Remove any existing entry for that staff + date
      const q = query(
        collection(db, 'roster_entries'),
        where('staffId', '==', staffId),
        where('date', '==', date)
      );
      const existing = await getDocs(q);
      for (const docSnap of existing.docs) {
        await deleteDoc(doc(db, 'roster_entries', docSnap.id));
      }

      await addDoc(collection(db, 'roster_entries'), {
        staffId,
        staffName: staffMember?.name || 'Unknown',
        staffDepartment: staffMember?.department || '',
        date,
        shiftTime: finalShiftTime,
        status: status === 'scheduled' ? 'scheduled' : status,
        createdAt: new Date().toISOString(),
      });
      setShowForm(false);
      setCustomShift('');
      alert('Roster entry added!');
    } catch (error: any) { alert('Error: ' + error.message); }
  };

  // ====== BULK ASSIGN ======
  const previewBulkDates = (): string[] => {
    const dates: string[] = [];
    if (!bulkStartDate || !bulkEndDate) return dates;
    const s = new Date(bulkStartDate + 'T00:00:00');
    const e = new Date(bulkEndDate + 'T00:00:00');
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return dates;
    const cur = new Date(s);
    while (cur <= e) {
      if (bulkDaysOfWeek.includes(cur.getDay())) {
        dates.push(formatDate(cur));
      }
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  };

  const toggleBulkDay = (day: number) => {
    setBulkDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleBulkAssign = async () => {
    if (!bulkStaffId) { alert('Please select a staff member'); return; }
    const dates = previewBulkDates();
    if (dates.length === 0) { alert('No dates match the selected days'); return; }
    if (dates.length > 90) {
      alert(`Too many dates (${dates.length}). Limit is 90.`);
      return;
    }

    const staffMember = staff.find((s) => s.id === bulkStaffId);
    if (!staffMember) return;

    let finalShiftTime = '';
    if (bulkType === 'scheduled') {
      finalShiftTime = bulkShift === 'CUSTOM' ? bulkCustomShift : bulkShift;
      if (!finalShiftTime) { alert('Please enter the custom shift time'); return; }
    }

    const ok = window.confirm(
      `Create ${dates.length} roster entries for ${staffMember.name}?\n\n` +
      `Any existing entries for those days will be overwritten.`
    );
    if (!ok) return;

    setBulkSubmitting(true);
    try {
      // Delete existing entries for those dates
      for (const d of dates) {
        const q = query(
          collection(db, 'roster_entries'),
          where('staffId', '==', bulkStaffId),
          where('date', '==', d)
        );
        const existing = await getDocs(q);
        for (const docSnap of existing.docs) {
          await deleteDoc(doc(db, 'roster_entries', docSnap.id));
        }
      }

      // Create new entries
      let created = 0;
      for (const d of dates) {
        await addDoc(collection(db, 'roster_entries'), {
          staffId: bulkStaffId,
          staffName: staffMember.name,
          staffDepartment: staffMember.department,
          date: d,
          shiftTime: finalShiftTime,
          status: bulkType === 'scheduled' ? 'scheduled' : bulkType,
          createdAt: new Date().toISOString(),
        });
        created++;
      }
      alert(`✅ Created ${created} roster entries!`);
      setShowBulkForm(false);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
    setBulkSubmitting(false);
  };

  // ====== COPY PREVIOUS PERIOD ======
  const handleCopyPreviousPeriod = async () => {
    const prevStart = new Date(periodStart);
    prevStart.setMonth(prevStart.getMonth() - 1);
    const prevEnd = new Date(periodEnd);
    prevEnd.setMonth(prevEnd.getMonth() - 1);

    const prevStartStr = formatDate(prevStart);
    const prevEndStr = formatDate(prevEnd);
    const curStartStr = formatDate(periodStart);
    const curEndStr = formatDate(periodEnd);

    const prevEntries = entries.filter((e) => e.date >= prevStartStr && e.date <= prevEndStr);
    if (prevEntries.length === 0) {
      alert('No entries found in the previous period to copy.');
      return;
    }

    const ok = window.confirm(
      `📋 Copy ${prevEntries.length} entries from the previous period?\n\n` +
      `From: ${formatLongDate(prevStart)} – ${formatLongDate(prevEnd)}\n` +
      `To:   ${formatLongDate(periodStart)} – ${formatLongDate(periodEnd)}\n\n` +
      `⚠ Existing entries in the current period will be OVERWRITTEN.\n\n` +
      `Continue?`
    );
    if (!ok) return;

    setCopying(true);
    try {
      // Delete all current-period entries
      const current = entries.filter((e) => e.date >= curStartStr && e.date <= curEndStr);
      for (const e of current) {
        await deleteDoc(doc(db, 'roster_entries', e.id));
      }

      // Copy previous period entries forward one month
      let created = 0;
      for (const e of prevEntries) {
        const oldDate = new Date(e.date + 'T00:00:00');
        const newDate = new Date(oldDate);
        newDate.setMonth(newDate.getMonth() + 1);
        const newDateStr = formatDate(newDate);

        await addDoc(collection(db, 'roster_entries'), {
          staffId: e.staffId,
          staffName: e.staffName,
          staffDepartment: e.staffDepartment,
          date: newDateStr,
          shiftTime: e.shiftTime || '',
          status: e.status || 'scheduled',
          createdAt: new Date().toISOString(),
        });
        created++;
      }
      alert(`✅ Copied ${created} entries!`);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
    setCopying(false);
  };

  // ====== OTHER HANDLERS ======
  const changePeriod = (direction: number) => {
    const newDate = new Date(periodStart);
    newDate.setMonth(newDate.getMonth() + direction);
    setPeriodStart(newDate);
  };

  const moveStaff = async (id: string, direction: 'up' | 'down') => {
    const list = [...visibleStaff];
    const index = list.findIndex((s) => s.id === id);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    [list[index], list[targetIndex]] = [list[targetIndex], list[index]];
    try {
      const batch = writeBatch(db);
      list.forEach((s, i) => batch.update(doc(db, 'staff', s.id), { order: i }));
      await batch.commit();
    } catch (err: any) { alert('Reorder failed: ' + err.message); }
  };

  const captureCanvas = async () => {
    if (!gridRef.current) return null;
    const original = gridRef.current;

    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      position: 'absolute',
      left: '-10000px',
      top: '0',
      width: '1600px',
      background: '#ffffff',
      padding: '16px',
      fontFamily: 'Arial, Helvetica, sans-serif',
      zIndex: '1',
    });

    const clone = original.cloneNode(true) as HTMLElement;
    clone.style.width = '100%';
    clone.style.background = '#ffffff';
    clone.style.padding = '0';
    clone.style.borderRadius = '0';
    clone.style.boxShadow = 'none';

    clone.querySelectorAll('.sticky-col, .sticky-col-name').forEach((el) => {
      (el as HTMLElement).style.position = 'static';
    });
    clone.querySelectorAll('.reorder-col').forEach((el) => el.remove());

    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    try {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const canvas = await html2canvas(wrapper, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        width: wrapper.scrollWidth,
        height: wrapper.scrollHeight,
        windowWidth: wrapper.scrollWidth,
        windowHeight: wrapper.scrollHeight,
      });
      document.body.removeChild(wrapper);
      return canvas;
    } catch (err) {
      document.body.removeChild(wrapper);
      throw err;
    }
  };

  const exportToJPG = async () => {
    setExporting(true);
    try {
      const canvas = await captureCanvas();
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `FND-Roster-${titleDeptSafe}-${formatDate(periodStart)}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
    } catch (err: any) { alert('Export failed: ' + err.message); }
    setExporting(false);
  };

  const exportToPDF = async () => {
    setExporting(true);
    try {
      const canvas = await captureCanvas();
      if (!canvas) return;
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const availWidth = pageWidth - margin * 2;
      const availHeight = pageHeight - margin * 2;
      const ratio = Math.min(availWidth / canvas.width, availHeight / canvas.height);
      const imgW = canvas.width * ratio;
      const imgH = canvas.height * ratio;
      const imgX = (pageWidth - imgW) / 2;
      const imgY = (pageHeight - imgH) / 2;
      pdf.addImage(imgData, 'JPEG', imgX, imgY, imgW, imgH);
      pdf.save(`FND-Roster-${titleDeptSafe}-${formatDate(periodStart)}.pdf`);
    } catch (err: any) { alert('Export failed: ' + err.message); }
    setExporting(false);
  };

  const handlePrint = () => {
    document.body.classList.add('printing-roster');
    setTimeout(() => {
      window.print();
      document.body.classList.remove('printing-roster');
    }, 100);
  };

  const titleDept = isAdmin
    ? (selectedDept === 'all' ? 'ALL DEPARTMENTS' : selectedDept.toUpperCase())
    : (userDepartment || '').toUpperCase();

  const titleDeptSafe = titleDept.replace(/\s+/g, '-');
  const bulkDatesCount = previewBulkDates().length;

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>
          Duty Roster
          <span style={{ fontSize: '13px', marginLeft: '10px', color: '#64748b', fontWeight: 500 }}>
            ({isAdmin ? (selectedDept === 'all' ? 'All Departments' : selectedDept) : userDepartment})
          </span>
        </h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`export-btn ${reorderMode ? 'pdf-btn' : 'jpg-btn'}`}
            onClick={() => setReorderMode(!reorderMode)}
          >
            {reorderMode ? '✅ Done' : '↕️ Reorder'}
          </button>
          <button className="export-btn jpg-btn" onClick={exportToJPG} disabled={exporting}>
            {exporting ? '...' : '📷 JPG'}
          </button>
          <button className="export-btn pdf-btn" onClick={exportToPDF} disabled={exporting}>
            {exporting ? '...' : '📄 PDF'}
          </button>
          <button className="export-btn print-btn" onClick={handlePrint}>🖨️ Print</button>
          <button
            className="export-btn copy-btn"
            onClick={handleCopyPreviousPeriod}
            disabled={copying}
            title="Copy last month's roster into this month"
          >
            {copying ? 'Copying...' : '📋 Copy Last Month'}
          </button>
          <button
            className="export-btn bulk-btn"
            onClick={() => { setShowBulkForm(!showBulkForm); setShowForm(false); }}
          >
            {showBulkForm ? 'Cancel Bulk' : '⚡ Bulk Assign'}
          </button>
          <button
            className="add-staff-btn"
            onClick={() => { setShowForm(!showForm); setShowBulkForm(false); }}
          >
            {showForm ? 'Cancel' : '+ Single'}
          </button>
        </div>
      </div>

      {isAdmin && (
        <div className="dept-tabs">
          <button
            className={selectedDept === 'all' ? 'dept-tab active' : 'dept-tab'}
            onClick={() => setSelectedDept('all')}
          >
            All Departments
          </button>
          {ROSTER_DEPARTMENTS.map((d) => (
            <button
              key={d}
              className={selectedDept === d ? 'dept-tab active' : 'dept-tab'}
              onClick={() => setSelectedDept(d)}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {reorderMode && (
        <div className="reorder-banner">
          ↕️ <strong>Reorder Mode:</strong> Use the ▲ ▼ arrows to arrange staff. Changes save automatically.
        </div>
      )}

      {/* ===== SINGLE ASSIGN FORM ===== */}
      {showForm && (
        <form className="staff-form" onSubmit={handleAdd}>
          <div style={{ gridColumn: 'span 2', marginBottom: '4px', fontWeight: 600, color: '#1e293b' }}>
            ➕ Single Day Assignment
          </div>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} required>
            <option value="">Select Staff Member...</option>
            {visibleStaff.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.sn || 'No SN'})</option>
            ))}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="scheduled">Scheduled Shift</option>
            {LEAVE_OPTIONS.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
          </select>
          {status === 'scheduled' && (
            <>
              <select value={shiftTime} onChange={(e) => setShiftTime(e.target.value)}>
                {SHIFT_OPTIONS.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
              </select>
              {shiftTime === 'CUSTOM' && (
                <input
                  placeholder="Custom time (e.g. 07:00 - 15:00)"
                  value={customShift}
                  onChange={(e) => setCustomShift(e.target.value)}
                  required
                />
              )}
            </>
          )}
          <button type="submit">Save Entry</button>
        </form>
      )}

      {/* ===== BULK ASSIGN FORM ===== */}
      {showBulkForm && (
        <div className="bulk-form">
          <div className="bulk-form-title">
            ⚡ Bulk Assign — Create many shifts at once
          </div>

          <div className="bulk-form-grid">
            <div className="bulk-field bulk-field-full">
              <label>Staff Member</label>
              <select value={bulkStaffId} onChange={(e) => setBulkStaffId(e.target.value)}>
                <option value="">Select Staff...</option>
                {visibleStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.sn || 'No SN'}) — {s.department}
                  </option>
                ))}
              </select>
            </div>

            <div className="bulk-field">
              <label>Start Date</label>
              <input type="date" value={bulkStartDate} onChange={(e) => setBulkStartDate(e.target.value)} />
            </div>

            <div className="bulk-field">
              <label>End Date</label>
              <input type="date" value={bulkEndDate} onChange={(e) => setBulkEndDate(e.target.value)} />
            </div>

            <div className="bulk-field bulk-field-full">
              <label>Days of Week</label>
              <div className="bulk-day-buttons">
                {DAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    className={bulkDaysOfWeek.includes(i) ? 'day-btn active' : 'day-btn'}
                    onClick={() => toggleBulkDay(i)}
                  >
                    {label}
                  </button>
                ))}
                <button type="button" className="day-btn quick" onClick={() => setBulkDaysOfWeek([0,1,2,3,4,5,6])}>All</button>
                <button type="button" className="day-btn quick" onClick={() => setBulkDaysOfWeek([0,1,2,3,4,6])}>No Fri</button>
                <button type="button" className="day-btn quick" onClick={() => setBulkDaysOfWeek([1,2,3,4,6])}>Mon–Thu+Sat+Sun</button>
                <button type="button" className="day-btn quick" onClick={() => setBulkDaysOfWeek([])}>Clear</button>
              </div>
            </div>

            <div className="bulk-field">
              <label>Type</label>
              <select value={bulkType} onChange={(e) => setBulkType(e.target.value)}>
                <option value="scheduled">Scheduled Shift</option>
                {LEAVE_OPTIONS.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
              </select>
            </div>

            <div className="bulk-field">
              <label>Shift Time</label>
              {bulkType === 'scheduled' ? (
                <>
                  <select value={bulkShift} onChange={(e) => setBulkShift(e.target.value)}>
                    {SHIFT_OPTIONS.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}
                  </select>
                  {bulkShift === 'CUSTOM' && (
                    <input
                      placeholder="e.g. 07:00 - 15:00"
                      value={bulkCustomShift}
                      onChange={(e) => setBulkCustomShift(e.target.value)}
                      style={{ marginTop: '6px' }}
                    />
                  )}
                </>
              ) : (
                <div style={{ padding: '10px', background: '#f1f5f9', borderRadius: '6px', fontSize: '12px', color: '#64748b' }}>
                  Not applicable for {bulkType}
                </div>
              )}
            </div>
          </div>

          <div className="bulk-preview">
            <strong>{bulkDatesCount}</strong> entr{bulkDatesCount === 1 ? 'y' : 'ies'} will be created
            {bulkStartDate && bulkEndDate && (
              <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '8px' }}>
                ({formatDate(new Date(bulkStartDate + 'T00:00:00'))} → {formatDate(new Date(bulkEndDate + 'T00:00:00'))})
              </span>
            )}
          </div>

          <button
            className="bulk-submit-btn"
            onClick={handleBulkAssign}
            disabled={bulkSubmitting || bulkDatesCount === 0}
          >
            {bulkSubmitting
              ? 'Creating...'
              : `⚡ Create ${bulkDatesCount} Entr${bulkDatesCount === 1 ? 'y' : 'ies'}`}
          </button>
        </div>
      )}

      <div className="week-nav">
        <button onClick={() => changePeriod(-1)}>← Previous Month</button>
        <span>{formatLongDate(periodStart)} — {formatLongDate(periodEnd)}</span>
        <button onClick={() => changePeriod(1)}>Next Month →</button>
      </div>

      <div ref={gridRef} className="roster-export-area">
        <div className="roster-title">
          <h1>FND {titleDept} DUTY ROSTER {formatLongDate(periodStart)} - {formatLongDate(periodEnd)}</h1>
        </div>

        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="roster-week-section">
            <div className="week-label">WEEK {weekIndex + 1}</div>
            <table className="roster-grid week-grid">
              <thead>
                <tr>
                  {reorderMode && <th className="reorder-col" style={{ width: '50px' }}>↕️</th>}
                  <th className="col-sn">SN No.</th>
                  <th className="col-name">NAME</th>
                  {week.map((d) => (
                    <th key={formatDate(d)} className="col-date">
                      {formatHeaderDate(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleStaff.length === 0 ? (
                  <tr>
                    <td
                      colSpan={week.length + (reorderMode ? 3 : 2)}
                      style={{ textAlign: 'center', padding: '15px' }}
                    >
                      No staff members found.
                    </td>
                  </tr>
                ) : (
                  visibleStaff.map((s, staffIndex) => (
                    <tr key={s.id}>
                      {reorderMode && (
                        <td className="reorder-col" style={{ padding: '2px' }}>
                          <button
                            className="reorder-btn"
                            onClick={() => moveStaff(s.id, 'up')}
                            disabled={staffIndex === 0}
                          >
                            ▲
                          </button>
                          <button
                            className="reorder-btn"
                            onClick={() => moveStaff(s.id, 'down')}
                            disabled={staffIndex === visibleStaff.length - 1}
                          >
                            ▼
                          </button>
                        </td>
                      )}
                      <td className="col-sn">{s.sn || '—'}</td>
                      <td className="col-name">{s.name}</td>
                      {week.map((d) => {
                        const dStr = formatDate(d);
                        const isInPeriod =
                          dStr >= formatDate(periodStart) && dStr <= formatDate(periodEnd);

                        if (!isInPeriod) {
                          return (
                            <td key={dStr} className="out-of-period-cell">&nbsp;</td>
                          );
                        }

                        const entry = entries.find((e) => e.staffId === s.id && e.date === dStr);
                        let displayValue = '';
                        let cellClass = 'empty-cell';
                        if (entry) {
                          displayValue = entry.status === 'scheduled' ? entry.shiftTime : entry.status;
                          if (entry.status === 'OFF DAY') cellClass = 'off-day-cell';
                          else if (entry.status && entry.status !== 'scheduled') cellClass = 'leave-cell';
                          else cellClass = 'shift-cell';
                        }
                        return (
                          <td key={dStr} className={cellClass}>
                            {displayValue}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RosterPage;