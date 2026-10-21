import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import {
  collection, addDoc, onSnapshot, doc, writeBatch,
  query, where, getDocs, deleteDoc
} from 'firebase/firestore';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useAuth } from '../auth';
import { toast } from 'sonner';

const ROSTER_DEPARTMENTS = ['Ground Operations', 'Maintenance', 'Security', 'Fire & Rescue', 'Administration', 'Safety'];
const FULL_ACCESS_ROLES = ['developer', 'manager', 'owner', 'admin', 'smt'];

const formatDate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const monthsFull = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
const monthsShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const daysShort = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const formatLongDate = (date: Date): string => `${date.getDate()} ${monthsFull[date.getMonth()]} ${date.getFullYear()}`;
const formatHeaderDate = (date: Date): string => `${daysShort[date.getDay()]}, ${date.getDate()} ${monthsShort[date.getMonth()]}, ${date.getFullYear()}`;

const getPeriodStart = (date: Date): Date => {
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  if (d.getDate() >= 16) d.setDate(16);
  else { d.setMonth(d.getMonth() - 1); d.setDate(16); }
  return d;
};

const getPeriodEnd = (start: Date): Date => {
  const d = new Date(start); d.setMonth(d.getMonth() + 1); d.setDate(15); return d;
};

const getSaturdayOnOrBefore = (date: Date): Date => {
  const d = new Date(date); d.setHours(0, 0, 0, 0); const diff = (d.getDay() + 1) % 7; d.setDate(d.getDate() - diff); return d;
};

const chunkIntoWeeks = (start: Date, end: Date): Date[][] => {
  const weeks: Date[][] = []; let current = getSaturdayOnOrBefore(start);
  while (current <= end) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) { week.push(new Date(current)); current.setDate(current.getDate() + 1); }
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

const getShortLeave = (status: string) => {
  if (!status) return '';
  if (status === 'ANNUAL LEAVE') return 'AL';
  if (status === 'SICK LEAVE') return 'SL';
  if (status === 'SICK LEAVE / MC') return 'SLMC';
  if (status === 'NO PAY LEAVE') return 'NPL';
  if (status === 'DUTY TRAVEL') return 'DT';
  if (status === 'PATERNITY LEAVE') return 'PL';
  if (status === 'MATERNITY LEAVE') return 'ML';
  if (status === 'FAMILY RESPONSIBILITY LEAVE (FRL)') return 'FRL';
  if (status === 'OFF DAY') return 'OFF';
  if (status === 'ABSENT') return 'AB';
  if (status === 'LATE') return 'LT';
  return status;
};

// COLOR CODING FUNCTIONS
const getShiftColorClass = (time: string) => {
  if (time.includes('06:00 - 14:00')) return 'shift-morning';
  if (time.includes('08:00 - 16:00')) return 'shift-day';
  if (time.includes('16:00 - 00:00')) return 'shift-afternoon';
  if (time.includes('00:00 - 08:00')) return 'shift-night';
  return 'shift-custom';
};

const getLeaveColorClass = (status: string) => {
  if (status === 'OFF DAY') return 'leave-off';
  if (status.includes('ANNUAL')) return 'leave-annual';
  if (status.includes('SICK')) return 'leave-sick';
  if (status.includes('NO PAY')) return 'leave-nopay';
  if (status.includes('DUTY TRAVEL')) return 'leave-travel';
  if (status.includes('PATERNITY')) return 'leave-pat';
  if (status.includes('MATERNITY')) return 'leave-mat';
  if (status.includes('FAMILY')) return 'leave-frl';
  if (status === 'ABSENT') return 'leave-absent';
  if (status === 'LATE') return 'leave-late';
  return 'leave-other';
};

const SHIFT_OPTIONS = ['06:00 - 14:00', '08:00 - 16:00', '16:00 - 00:00', '00:00 - 08:00', 'CUSTOM'];
const LEAVE_OPTIONS = [
  'OFF DAY', 'ANNUAL LEAVE', 'SICK LEAVE', 'SICK LEAVE / MC', 
  'NO PAY LEAVE', 'DUTY TRAVEL', 'PATERNITY LEAVE', 'MATERNITY LEAVE', 
  'FAMILY RESPONSIBILITY LEAVE (FRL)', 'ABSENT', 'LATE'
];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function RosterPage() {
  const { profile } = useAuth();
  const isAdmin = FULL_ACCESS_ROLES.includes(profile?.role || '');
  const userDepartment = profile?.department;

  const [zoom, setZoom] = useState(1);
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [entries, setEntries] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [periodStart, setPeriodStart] = useState<Date>(getPeriodStart(new Date()));
  const [exporting, setExporting] = useState<boolean>(false);
  const [reorderMode, setReorderMode] = useState<boolean>(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const [showForm, setShowForm] = useState<boolean>(false);
  const [staffId, setStaffId] = useState<string>('');
  const [date, setDate] = useState<string>(formatDate(new Date()));
  const [shiftTime, setShiftTime] = useState<string>('06:00 - 14:00');
  const [customShift, setCustomShift] = useState<string>('');
  const [status, setStatus] = useState<string>('scheduled');

  const [editCell, setEditCell] = useState<{ staffId: string, staffName: string, date: string } | null>(null);
  const [editStatus, setEditStatus] = useState('scheduled');
  const [editShift, setEditShift] = useState('06:00 - 14:00');

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
      if (!ROSTER_DEPARTMENTS.includes(s.department)) return false;
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

  useEffect(() => { setBulkStartDate(formatDate(periodStart)); setBulkEndDate(formatDate(periodEnd)); }, [periodStart]);

  const handleAdd = async (e: any) => {
    e.preventDefault();
    if (!staffId) { toast.error('Please select a staff member'); return; }
    const staffMember = staff.find((s) => s.id === staffId);
    let finalShiftTime = '';
    if (status === 'scheduled') {
      finalShiftTime = shiftTime === 'CUSTOM' ? customShift : shiftTime;
      if (!finalShiftTime) { toast.error('Please enter the custom shift time'); return; }
    }
    try {
      const q = query(collection(db, 'roster_entries'), where('staffId', '==', staffId), where('date', '==', date));
      const existing = await getDocs(q);
      for (const docSnap of existing.docs) await deleteDoc(doc(db, 'roster_entries', docSnap.id));

      await addDoc(collection(db, 'roster_entries'), {
        staffId, staffName: staffMember?.name || 'Unknown', staffDepartment: staffMember?.department || '',
        date, shiftTime: finalShiftTime, status: status === 'scheduled' ? 'scheduled' : status,
        createdAt: new Date().toISOString(),
      });
      toast.success('Roster entry added!');
      setShowForm(false); setCustomShift('');
    } catch (error: any) { toast.error('Error: ' + error.message); }
  };

  const handleSaveCell = async () => {
    if (!editCell) return;
    let finalShift = editStatus === 'scheduled' ? editShift : '';
    try {
      const q = query(collection(db, 'roster_entries'), where('staffId', '==', editCell.staffId), where('date', '==', editCell.date));
      const existing = await getDocs(q);
      for (const docSnap of existing.docs) await deleteDoc(doc(db, 'roster_entries', docSnap.id));

      if (editStatus !== 'clear') {
        await addDoc(collection(db, 'roster_entries'), {
          staffId: editCell.staffId, staffName: editCell.staffName, staffDepartment: selectedDept === 'all' ? '' : selectedDept,
          date: editCell.date, shiftTime: finalShift, status: editStatus, createdAt: new Date().toISOString(),
        });
      }
      toast.success('Cell updated!');
      setEditCell(null);
    } catch (err: any) { toast.error(err.message); }
  };

  const previewBulkDates = (): string[] => {
    const dates: string[] = [];
    if (!bulkStartDate || !bulkEndDate) return dates;
    const s = new Date(bulkStartDate + 'T00:00:00'); const e = new Date(bulkEndDate + 'T00:00:00');
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return dates;
    const cur = new Date(s);
    while (cur <= e) {
      if (bulkDaysOfWeek.includes(cur.getDay())) dates.push(formatDate(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  };

  const toggleBulkDay = (day: number) => setBulkDaysOfWeek((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort());

  const handleBulkAssign = async () => {
    if (!bulkStaffId) { toast.error('Please select a staff member'); return; }
    const dates = previewBulkDates();
    if (dates.length === 0) { toast.error('No dates match the selected days'); return; }
    if (dates.length > 90) { toast.error(`Too many dates (${dates.length}). Limit is 90.`); return; }

    const staffMember = staff.find((s) => s.id === bulkStaffId);
    if (!staffMember) return;

    let finalShiftTime = '';
    if (bulkType === 'scheduled') {
      finalShiftTime = bulkShift === 'CUSTOM' ? bulkCustomShift : bulkShift;
      if (!finalShiftTime) { toast.error('Please enter the custom shift time'); return; }
    }

    setBulkSubmitting(true);
    try {
      for (const d of dates) {
        const q = query(collection(db, 'roster_entries'), where('staffId', '==', bulkStaffId), where('date', '==', d));
        const existing = await getDocs(q);
        for (const docSnap of existing.docs) await deleteDoc(doc(db, 'roster_entries', docSnap.id));
      }

      let created = 0;
      for (const d of dates) {
        await addDoc(collection(db, 'roster_entries'), {
          staffId: bulkStaffId, staffName: staffMember.name, staffDepartment: staffMember.department,
          date: d, shiftTime: finalShiftTime, status: bulkType === 'scheduled' ? 'scheduled' : bulkType,
          createdAt: new Date().toISOString(),
        });
        created++;
      }
      toast.success(`Created ${created} roster entries!`);
      setShowBulkForm(false);
    } catch (err: any) { toast.error('Error: ' + err.message); }
    setBulkSubmitting(false);
  };

  const handleCopyPreviousPeriod = async () => {
    const prevStart = new Date(periodStart); prevStart.setMonth(prevStart.getMonth() - 1);
    const prevEnd = new Date(periodEnd); prevEnd.setMonth(prevEnd.getMonth() - 1);
    const prevStartStr = formatDate(prevStart); const prevEndStr = formatDate(prevEnd);
    const curStartStr = formatDate(periodStart); const curEndStr = formatDate(periodEnd);

    const prevEntries = entries.filter((e) => e.date >= prevStartStr && e.date <= prevEndStr);
    if (prevEntries.length === 0) { toast.error('No entries found in the previous period to copy.'); return; }

    setCopying(true);
    try {
      const current = entries.filter((e) => e.date >= curStartStr && e.date <= curEndStr);
      for (const e of current) await deleteDoc(doc(db, 'roster_entries', e.id));

      let created = 0;
      for (const e of prevEntries) {
        const oldDate = new Date(e.date + 'T00:00:00'); const newDate = new Date(oldDate); newDate.setMonth(newDate.getMonth() + 1);
        const newDateStr = formatDate(newDate);

        await addDoc(collection(db, 'roster_entries'), {
          staffId: e.staffId, staffName: e.staffName, staffDepartment: e.staffDepartment,
          date: newDateStr, shiftTime: e.shiftTime || '', status: e.status || 'scheduled',
          createdAt: new Date().toISOString(),
        });
        created++;
      }
      toast.success(`Copied ${created} entries!`);
    } catch (err: any) { toast.error('Error: ' + err.message); }
    setCopying(false);
  };

  const changePeriod = (direction: number) => {
    const newDate = new Date(periodStart); newDate.setMonth(newDate.getMonth() + direction); setPeriodStart(newDate);
  };

  const moveStaff = async (id: string, direction: 'up' | 'down') => {
    const list = [...visibleStaff]; const index = list.findIndex((s) => s.id === id);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;
    [list[index], list[targetIndex]] = [list[targetIndex], list[index]];
    try {
      const batch = writeBatch(db);
      list.forEach((s, i) => batch.update(doc(db, 'staff', s.id), { order: i }));
      await batch.commit();
    } catch (err: any) { toast.error('Reorder failed: ' + err.message); }
  };

  const captureCanvas = async () => {
    if (!gridRef.current) return null;
    const original = gridRef.current;
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, { position: 'absolute', left: '-10000px', top: '0', width: '1400px', background: '#ffffff', padding: '16px', fontFamily: 'Arial, Helvetica, sans-serif', zIndex: '1' });
    const clone = original.cloneNode(true) as HTMLElement;
    clone.style.width = '100%'; clone.style.background = '#ffffff'; clone.style.padding = '0'; clone.style.borderRadius = '0'; clone.style.boxShadow = 'none';
    clone.style.zoom = '1'; // Reset zoom for export
    clone.querySelectorAll('.sticky-col, .sticky-col-name').forEach((el) => { (el as HTMLElement).style.position = 'static'; });
    clone.querySelectorAll('.reorder-col').forEach((el) => el.remove());
    wrapper.appendChild(clone); document.body.appendChild(wrapper);
    try {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const canvas = await html2canvas(wrapper, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, width: wrapper.scrollWidth, height: wrapper.scrollHeight, windowWidth: wrapper.scrollWidth, windowHeight: wrapper.scrollHeight });
      document.body.removeChild(wrapper); return canvas;
    } catch (err) { document.body.removeChild(wrapper); throw err; }
  };

  const exportToJPG = async () => {
    setExporting(true);
    try {
      const canvas = await captureCanvas(); if (!canvas) return;
      const link = document.createElement('a'); link.download = `FND-Roster-${formatDate(periodStart)}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95); link.click();
      toast.success('JPG downloaded!');
    } catch (err: any) { toast.error('Export failed: ' + err.message); }
    setExporting(false);
  };

  const exportToPDF = async () => {
    setExporting(true);
    try {
      const canvas = await captureCanvas(); if (!canvas) return;
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      
      // Force landscape A4
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth(); 
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Calculate scaling to fit on 1 page
      const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
      const imgW = canvas.width * ratio; 
      const imgH = canvas.height * ratio;
      
      // Center the image
      const imgX = (pageWidth - imgW) / 2; 
      const imgY = (pageHeight - imgH) / 2;
      
      pdf.addImage(imgData, 'JPEG', imgX, imgY, imgW, imgH);
      pdf.save(`FND-Roster-${formatDate(periodStart)}.pdf`);
      toast.success('PDF downloaded!');
    } catch (err: any) { toast.error('Export failed: ' + err.message); }
    setExporting(false);
  };

  const handlePrint = () => {
    document.body.classList.add('printing-roster');
    setTimeout(() => { window.print(); document.body.classList.remove('printing-roster'); }, 100);
  };

  return (
    <div className="page-content">
      <div className="staff-header no-print">
        <h2>Duty Roster</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          
          {/* ZOOM CONTROLS */}
          <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
            <button style={{ padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setZoom(z => Math.max(0.5, z - 0.2))}>A-</button>
            <div style={{ padding: '8px 12px', background: '#fff', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1' }}>
              {Math.round(zoom * 100)}%
            </div>
            <button style={{ padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setZoom(z => Math.min(2.5, z + 0.2))}>A+</button>
            <button style={{ padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '11px', color: '#64748b' }} onClick={() => setZoom(1)}>Reset</button>
          </div>

          {isAdmin && (
            <button className={`export-btn ${reorderMode ? 'pdf-btn' : 'jpg-btn'}`} onClick={() => setReorderMode(!reorderMode)}>
              {reorderMode ? '✅ Done' : '↕️ Reorder'}
            </button>
          )}
          <button className="export-btn jpg-btn" onClick={exportToJPG} disabled={exporting}>{exporting ? '...' : '📷 JPG'}</button>
          <button className="export-btn pdf-btn" onClick={exportToPDF} disabled={exporting}>{exporting ? '...' : '📄 PDF (1 Page)'}</button>
          <button className="export-btn print-btn" onClick={handlePrint}>🖨️ Print</button>
          {isAdmin && (
            <>
              <button className="export-btn copy-btn" onClick={handleCopyPreviousPeriod} disabled={copying}>{copying ? '...' : '📋 Copy Last Month'}</button>
              <button className="export-btn bulk-btn" onClick={() => { setShowBulkForm(!showBulkForm); setShowForm(false); }}>{showBulkForm ? 'Cancel Bulk' : '⚡ Bulk Assign'}</button>
              <button className="add-staff-btn" onClick={() => { setShowForm(!showForm); setShowBulkForm(false); }}>{showForm ? 'Cancel' : '+ Single'}</button>
            </>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="dept-tabs no-print">
          <button className={selectedDept === 'all' ? 'dept-tab active' : 'dept-tab'} onClick={() => setSelectedDept('all')}>All Departments</button>
          {ROSTER_DEPARTMENTS.map((d) => (
            <button key={d} className={selectedDept === d ? 'dept-tab active' : 'dept-tab'} onClick={() => setSelectedDept(d)}>{d}</button>
          ))}
        </div>
      )}

      {reorderMode && <div className="reorder-banner no-print">↕️ <strong>Reorder Mode:</strong> Use arrows to arrange staff.</div>}

      {showForm && isAdmin && (
        <form className="staff-form no-print" onSubmit={handleAdd}>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} required>
            <option value="">Select Staff Member...</option>
            {visibleStaff.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.sn || 'No SN'})</option>)}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="scheduled">Scheduled Shift</option>
            {LEAVE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          {status === 'scheduled' && (
            <>
              <select value={shiftTime} onChange={(e) => setShiftTime(e.target.value)}>
                {SHIFT_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              {shiftTime === 'CUSTOM' && <input placeholder="Custom time" value={customShift} onChange={(e) => setCustomShift(e.target.value)} required />}
            </>
          )}
          <button type="submit">Save Entry</button>
        </form>
      )}

      {showBulkForm && isAdmin && (
        <div className="bulk-form no-print">
          <div className="bulk-form-title">⚡ Bulk Assign</div>
          <div className="bulk-form-grid">
            <div className="bulk-field bulk-field-full">
              <label>Staff Member</label>
              <select value={bulkStaffId} onChange={(e) => setBulkStaffId(e.target.value)}>
                <option value="">Select Staff...</option>
                {visibleStaff.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.sn || 'No SN'})</option>)}
              </select>
            </div>
            <div className="bulk-field"><label>Start</label><input type="date" value={bulkStartDate} onChange={(e) => setBulkStartDate(e.target.value)} /></div>
            <div className="bulk-field"><label>End</label><input type="date" value={bulkEndDate} onChange={(e) => setBulkEndDate(e.target.value)} /></div>
            <div className="bulk-field bulk-field-full">
              <label>Days</label>
              <div className="bulk-day-buttons">
                {DAY_LABELS.map((label, i) => <button key={i} type="button" className={bulkDaysOfWeek.includes(i) ? 'day-btn active' : 'day-btn'} onClick={() => toggleBulkDay(i)}>{label}</button>)}
              </div>
            </div>
            <div className="bulk-field"><label>Type</label><select value={bulkType} onChange={(e) => setBulkType(e.target.value)}><option value="scheduled">Shift</option>{LEAVE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select></div>
            <div className="bulk-field"><label>Shift</label><select value={bulkShift} onChange={(e) => setBulkShift(e.target.value)}>{SHIFT_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select></div>
          </div>
          <button className="bulk-submit-btn" onClick={handleBulkAssign} disabled={bulkSubmitting}>{bulkSubmitting ? '...' : `⚡ Create Entries`}</button>
        </div>
      )}

      <div className="week-nav no-print">
        <button onClick={() => changePeriod(-1)}>← Previous Month</button>
        <span>{formatLongDate(periodStart)} — {formatLongDate(periodEnd)}</span>
        <button onClick={() => changePeriod(1)}>Next Month →</button>
      </div>

      <div ref={gridRef} className="roster-export-area" style={{ zoom: zoom }}>
        <div className="roster-title"><h1>FND DUTY ROSTER {formatLongDate(periodStart)} - {formatLongDate(periodEnd)}</h1></div>
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="roster-week-section">
            <div className="week-label">WEEK {weekIndex + 1}</div>
            <table className="roster-grid week-grid">
              <thead>
                <tr>
                  {reorderMode && <th className="reorder-col no-print">↕️</th>}
                  <th className="col-sn">SN No.</th><th className="col-name">NAME</th>
                  {week.map((d) => <th key={formatDate(d)} className="col-date">{formatHeaderDate(d)}</th>)}
                </tr>
              </thead>
              <tbody>
                {visibleStaff.length === 0 ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: '15px' }}>No staff.</td></tr> : visibleStaff.map((s, staffIndex) => (
                  <tr key={s.id}>
                    {reorderMode && <td className="reorder-col no-print"><button className="reorder-btn" onClick={() => moveStaff(s.id, 'up')}>▲</button><button className="reorder-btn" onClick={() => moveStaff(s.id, 'down')}>▼</button></td>}
                    <td className="col-sn">{s.sn || '—'}</td><td className="col-name">{s.name}</td>
                    {week.map((d) => {
                      const dStr = formatDate(d);
                      const isInPeriod = dStr >= formatDate(periodStart) && dStr <= formatDate(periodEnd);
                      if (!isInPeriod) return <td key={dStr} className="out-of-period-cell">&nbsp;</td>;

                      const entry = entries.find((e) => e.staffId === s.id && e.date === dStr);
                      let displayValue = ''; let cellClass = 'empty-cell';
                      
                      if (entry) {
                        displayValue = entry.status === 'scheduled' ? entry.shiftTime : getShortLeave(entry.status);
                        
                        // APPLY NEW COLOR CLASSES
                        if (entry.status === 'scheduled') {
                          cellClass = getShiftColorClass(entry.shiftTime);
                        } else {
                          cellClass = getLeaveColorClass(entry.status);
                        }
                      }
                      
                      return (
                        <td key={dStr} className={`${cellClass} ${isAdmin ? 'clickable-cell' : ''}`} 
                            onClick={() => {
                              if (isAdmin) {
                                setEditCell({ staffId: s.id, staffName: s.name, date: dStr });
                                setEditStatus(entry ? entry.status : 'scheduled');
                                setEditShift(entry && entry.status === 'scheduled' ? entry.shiftTime : '06:00 - 14:00');
                              }
                            }}>
                          {displayValue}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* CELL EDIT MODAL */}
      {editCell && isAdmin && (
        <div className="modal-backdrop no-print" onClick={() => setEditCell(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Roster: {editCell.staffName}</h3>
            <p style={{ color: '#475569', marginBottom: '20px' }}>Date: {editCell.date}</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <select value={editStatus} onChange={e => setEditStatus(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                <option value="scheduled">Scheduled Shift</option>
                {LEAVE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                <option value="clear">Clear (Remove Entry)</option>
              </select>
              
              {editStatus === 'scheduled' && (
                <select value={editShift} onChange={e => setEditShift(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  {SHIFT_OPTIONS.filter(o => o !== 'CUSTOM').map(o => <option key={o} value={o}>{o}</option>)}
                  <option value="08:00 - 16:00">08:00 - 16:00</option>
                </select>
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button className="cancel-btn" onClick={() => setEditCell(null)}>Cancel</button>
              <button className="submit-btn" onClick={handleSaveCell}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RosterPage;