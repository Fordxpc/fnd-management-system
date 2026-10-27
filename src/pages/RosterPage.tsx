import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import { ConfirmDialog } from '../components/Dialogs';

const ROSTER_DEPARTMENTS = ['Ground Operations', 'Maintenance', 'Security', 'Fire & Rescue', 'Administration', 'Safety'];
const ADMIN_DEPARTMENTS = ['Administration'];

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
  const aOrder = typeof a.orderIndex === 'number' ? a.orderIndex : 9999;
  const bOrder = typeof b.orderIndex === 'number' ? b.orderIndex : 9999;
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
  if (status === 'PRE-MATERNITY LEAVE') return 'PML';
  if (status === 'FAMILY RESPONSIBILITY LEAVE (FRL)') return 'FRL';
  if (status === 'OFF DAY') return 'OFF';
  if (status === 'ABSENT') return 'AB';
  return status;
};

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
  return 'leave-other';
};

const SHIFT_OPTIONS = ['06:00 - 14:00', '08:00 - 16:00', '16:00 - 00:00', '00:00 - 08:00', 'CUSTOM'];
const ROSTER_STATUS_OPTIONS = [
  'OFF DAY', 'ABSENT', 'ANNUAL LEAVE', 'SICK LEAVE', 'SICK LEAVE / MC', 'NO PAY LEAVE', 'DUTY TRAVEL',
  'PATERNITY LEAVE', 'MATERNITY LEAVE', 'PRE-MATERNITY LEAVE', 'FAMILY RESPONSIBILITY LEAVE (FRL)'
];

const APPROVED_LEAVE_STATUSES = ROSTER_STATUS_OPTIONS.filter(o => o !== 'OFF DAY' && o !== 'ABSENT');
const isApprovedLeaveStatus = (status?: string) => !!status && APPROVED_LEAVE_STATUSES.includes(status);
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function RosterPage() {
  const { profile } = useAuth();
  
  const [zoom, setZoom] = useState(1);
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [entries, setEntries] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [periodStart, setPeriodStart] = useState<Date>(getPeriodStart(new Date()));
  const [loading, setLoading] = useState(true);
  const [reorderMode, setReorderMode] = useState<boolean>(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const [deleteStaffTarget, setDeleteStaffTarget] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const [showForm, setShowForm] = useState<boolean>(false);
  const [staffId, setStaffId] = useState<string>('');
  const [date, setDate] = useState<string>(formatDate(new Date()));
  const [shiftTime, setShiftTime] = useState<string>('06:00 - 14:00');
  const [customShift, setCustomShift] = useState<string>('');
  const [status, setStatus] = useState<string>('scheduled');

  const [editCell, setEditCell] = useState<{ staffId: string, staffName: string, date: string, dept: string } | null>(null);
  const [editStatus, setEditStatus] = useState('scheduled');
  const [editShift, setEditShift] = useState('06:00 - 14:00');

  const [showBulkForm, setShowBulkForm] = useState<boolean>(false);
  const [bulkStaffIds, setBulkStaffIds] = useState<string[]>([]);
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

  const myStaff = staff.find((s) => (s.email || '').toLowerCase() === (profile?.email || '').toLowerCase());
  
  const isDev = profile?.role === 'developer';
  const isManager = profile?.role === 'manager' || profile?.role === 'admin' || profile?.role === 'owner';
  const isSMT = profile?.role === 'smt' || myStaff?.isSMT === true; 
  
  const userDepartment = myStaff?.department || profile?.department;
  const isAdmin = isDev || isManager || isSMT;

  const canEditDept = (dept: string) => {
    if (isDev || isManager) return true;
    const targetDept = (dept || '').trim().toLowerCase();
    const currentDept = (userDepartment || '').trim().toLowerCase();
    if (currentDept === 'safety' && targetDept === 'security') return true;
    if (!isSMT) return false;
    if (currentDept === targetDept) return true;
    return false;
  };

  const activeDeptName = isAdmin
    ? (selectedDept === 'all' ? '' : selectedDept.toUpperCase())
    : (userDepartment?.toUpperCase() || '');

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

  const holidayDateSet = new Set<string>(holidays.map((h: any) => h.date));

  const fetchData = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        apiFetch('/staff'), apiFetch('/roster'), apiFetch('/holidays')
      ]);

      const getData = (index: number) => {
        if (results[index].status === 'fulfilled') return (results[index] as PromiseFulfilledResult<any>).value;
        return []; 
      };

      const rawRoster = getData(1);
      const uniqueRoster = Array.from(new Map(rawRoster.map((item: any) => [`${item.staffName}-${item.date}`, item])).values());

      setStaff(getData(0));
      setEntries(uniqueRoster);
      setHolidays(getData(2));
      setLoading(false);
    } catch (err: any) {
      toast.error(err.message);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    document.body.classList.remove('print-all', 'print-large', 'print-small');
    if (selectedDept === 'all' && isAdmin) document.body.classList.add('print-all');
    else if (visibleStaff.length > 8) document.body.classList.add('print-large');
    else document.body.classList.add('print-small');
  }, [weeks.length, selectedDept, visibleStaff.length, isAdmin]);

  useEffect(() => { 
    setBulkStartDate(formatDate(periodStart)); 
    setBulkEndDate(formatDate(periodEnd)); 
  }, [periodStart]);

  const handleAdd = async (e: any) => {
    e.preventDefault();
    if (!staffId) { toast.error('Please select a staff member'); return; }
    
    const staffMember = staff.find((s) => s.id === staffId);
    if (!staffMember || !canEditDept(staffMember.department)) {
      toast.error('You do not have permission to edit this department.');
      return;
    }
    if (isApprovedLeaveStatus(status)) {
      toast.error('Use Leave Requests page to apply for leave.');
      return;
    }

    let finalShiftTime = '';
    if (status === 'scheduled') {
      finalShiftTime = shiftTime === 'CUSTOM' ? customShift : shiftTime;
      if (!finalShiftTime) { toast.error('Please enter the custom shift time'); return; }
    }
    
    try {
      await apiFetch('/roster', {
        method: 'POST',
        body: JSON.stringify({
          staffId, staffName: staffMember.name, staffDepartment: staffMember.department,
          date, shiftTime: finalShiftTime, status: status === 'scheduled' ? 'scheduled' : status
        })
      });
      toast.success('Roster entry added!');
      setShowForm(false); setCustomShift('');
      fetchData();
    } catch (error: any) { toast.error('Error: ' + error.message); }
  };

  const handleSaveCell = async () => {
    if (!editCell) return;
    if (!canEditDept(editCell.dept)) {
      toast.error('You do not have permission to edit this department.');
      return;
    }
    
    const finalShift = editStatus === 'scheduled' ? editShift : '';
    try {
      await apiFetch('/roster', {
        method: 'POST',
        body: JSON.stringify({
          staffId: editCell.staffId, staffName: editCell.staffName, staffDepartment: editCell.dept,
          date: editCell.date, shiftTime: finalShift, status: editStatus
        })
      });
      toast.success('Cell updated!');
      setEditCell(null);
      fetchData();
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
  const toggleBulkStaff = (id: string) => { setBulkStaffIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };

  const handleBulkAssign = async () => {
    if (bulkStaffIds.length === 0) { toast.error('Please select at least one staff member'); return; }
    const dates = previewBulkDates();
    if (dates.length === 0) { toast.error('No dates match the selected days'); return; }
    
    let finalShiftTime = '';
    if (bulkType === 'scheduled') {
      finalShiftTime = bulkShift === 'CUSTOM' ? bulkCustomShift : bulkShift;
      if (!finalShiftTime) { toast.error('Please enter the custom shift time'); return; }
    }

    setBulkSubmitting(true);
    try {
      const newEntries: any[] = [];
      for (const selectedStaffId of bulkStaffIds) {
        const staffMember = staff.find((s) => s.id === selectedStaffId);
        if (!staffMember || !canEditDept(staffMember.department)) continue;

        for (const d of dates) {
          newEntries.push({
            staffId: selectedStaffId, staffName: staffMember.name, staffDepartment: staffMember.department,
            date: d, shiftTime: finalShiftTime, status: bulkType === 'scheduled' ? 'scheduled' : bulkType
          });
        }
      }
      
      await apiFetch('/roster/bulk', {
        method: 'POST',
        body: JSON.stringify({ entries: newEntries })
      });
      
      toast.success(`Created ${newEntries.length} roster entries!`);
      setShowBulkForm(false);
      setBulkStaffIds([]);
      fetchData();
    } catch (err: any) { toast.error('Error: ' + err.message); }
    setBulkSubmitting(false);
  };

  // FIXED: Exact relative week/day mapping
  const handleCopyPreviousPeriod = async () => {
    const prevStart = new Date(periodStart); prevStart.setMonth(prevStart.getMonth() - 1);
    const prevEnd = new Date(periodEnd); prevEnd.setMonth(prevEnd.getMonth() - 1);
    const prevStartStr = formatDate(prevStart); const prevEndStr = formatDate(prevEnd);

    const prevEntries = entries.filter((e) =>
      e.date >= prevStartStr && e.date <= prevEndStr && !isApprovedLeaveStatus(e.status) && !e.leaveRequestId
    );
    if (prevEntries.length === 0) { toast.error('No entries found in the previous period to copy.'); return; }

    setCopying(true);
    try {
      const newEntries: any[] = [];
      
      const prevFirstSat = getSaturdayOnOrBefore(prevStart);
      const currentFirstSat = getSaturdayOnOrBefore(periodStart);

      for (const e of prevEntries) {
        const oldDate = new Date(e.date + 'T00:00:00');
        // Calculate exact day offset from the first Saturday of the period
        const diffDays = Math.floor((oldDate.getTime() - prevFirstSat.getTime()) / (1000 * 3600 * 24));
        
        const newDate = new Date(currentFirstSat);
        newDate.setDate(newDate.getDate() + diffDays);
        const newDateStr = formatDate(newDate);

        // Skip if there's currently approved leave on this new date
        const isProtected = entries.some(curr => curr.staffId === e.staffId && curr.date === newDateStr && (isApprovedLeaveStatus(curr.status) || curr.leaveRequestId));
        if (isProtected) continue;

        newEntries.push({
          staffId: e.staffId, staffName: e.staffName, staffDepartment: e.staffDepartment,
          date: newDateStr, shiftTime: e.shiftTime || '', status: e.status || 'scheduled'
        });
      }
      
      await apiFetch('/roster/bulk', {
        method: 'POST',
        body: JSON.stringify({ entries: newEntries })
      });
      
      toast.success(`Copied ${newEntries.length} entries!`);
      fetchData();
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
      await apiFetch('/staff/reorder', {
        method: 'PUT',
        body: JSON.stringify({ orderedIds: list.map(s => s.id) })
      });
      fetchData();
    } catch (err: any) { toast.error('Reorder failed: ' + err.message); }
  };

  const captureCanvas = async () => {
    if (!gridRef.current) return null;
    const original = gridRef.current;
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, { position: 'absolute', left: '-10000px', top: '0', width: '1400px', background: '#ffffff', padding: '16px', fontFamily: 'Arial, Helvetica, sans-serif', zIndex: '1' });
    const clone = original.cloneNode(true) as HTMLElement;
    clone.style.width = '100%'; clone.style.background = '#ffffff'; clone.style.padding = '0'; clone.style.borderRadius = '0'; clone.style.boxShadow = 'none';
    clone.style.zoom = '1';
    clone.querySelectorAll('.sticky-col, .sticky-col-name').forEach((el) => { (el as HTMLElement).style.position = 'static'; });
    clone.querySelectorAll('.reorder-col').forEach((el) => el.remove());
    clone.querySelectorAll('.print-week-header').forEach((el) => el.remove());
    wrapper.appendChild(clone); document.body.appendChild(wrapper);
    try {
      await new Promise((resolve) => setTimeout(resolve, 200));
      const canvas = await html2canvas(wrapper, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false, width: wrapper.scrollWidth, height: wrapper.scrollHeight, windowWidth: wrapper.scrollWidth, windowHeight: wrapper.scrollHeight });
      document.body.removeChild(wrapper); return canvas;
    } catch (err) { document.body.removeChild(wrapper); throw err; }
  };

  const exportToJPG = async () => {
    try {
      const canvas = await captureCanvas(); if (!canvas) return;
      const link = document.createElement('a'); link.download = `FND-Roster-${formatDate(periodStart)}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95); link.click();
      toast.success('JPG downloaded!');
    } catch (err: any) { toast.error('Export failed: ' + err.message); }
  };

  const exportToPDF = async () => {
    try {
      const canvas = await captureCanvas(); if (!canvas) return;
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth(); const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8; const availWidth = pageWidth - margin * 2; const availHeight = pageHeight - margin * 2;
      const ratio = Math.min(availWidth / canvas.width, availHeight / canvas.height);
      const imgW = canvas.width * ratio; const imgH = canvas.height * ratio;
      const imgX = (pageWidth - imgW) / 2; const imgY = (pageHeight - imgH) / 2;
      pdf.addImage(imgData, 'JPEG', imgX, imgY, imgW, imgH);
      pdf.save(`FND-Roster-${formatDate(periodStart)}.pdf`);
      toast.success('PDF downloaded!');
    } catch (err: any) { toast.error('Export failed: ' + err.message); }
  };

  const handlePrint = () => {
    document.body.classList.add('printing-roster');
    setTimeout(() => { window.print(); document.body.classList.remove('printing-roster'); }, 100);
  };

  const editableStaffList = visibleStaff.filter(s => canEditDept(s.department));

  if (loading) return <div className="page-content"><p>Loading Roster...</p></div>;

  return (
    <div className="page-content">
      <div className="staff-header no-print">
        <h2>Duty Roster</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
            <button style={{ padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setZoom(z => Math.max(0.5, z - 0.2))}>A-</button>
            <div style={{ padding: '8px 12px', background: '#fff', fontSize: '13px', fontWeight: 'bold', display: 'flex', alignItems: 'center', borderLeft: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1' }}>
              {Math.round(zoom * 100)}%
            </div>
            <button style={{ padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setZoom(z => Math.min(2.5, z + 0.2))}>A+</button>
            <button style={{ padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '11px', color: '#64748b' }} onClick={() => setZoom(1)}>Reset</button>
          </div>

          <button className="export-btn print-btn" onClick={handlePrint}>🖨️ Print</button>
          <button className="export-btn jpg-btn" onClick={exportToJPG}>📸 JPG</button>
          <button className="export-btn pdf-btn" onClick={exportToPDF}>📄 PDF</button>
          
          {isAdmin && (
            <button className="export-btn bulk-btn" onClick={() => setReorderMode(!reorderMode)} style={{ background: reorderMode ? '#dc2626' : '#8b5cf6', color: 'white' }}>
              {reorderMode ? 'Cancel Reorder' : '🔄 Reorder Staff'}
            </button>
          )}

          {isAdmin && (
             <button className="export-btn bulk-btn" onClick={() => { setShowBulkForm(!showBulkForm); setShowForm(false); }}>{showBulkForm ? 'Cancel Bulk' : '⚡ Bulk Assign'}</button>
          )}
          
          {editableStaffList.length > 0 && (
            <button className="add-staff-btn" onClick={() => { setShowForm(!showForm); setShowBulkForm(false); }}>{showForm ? 'Cancel' : '+ Single'}</button>
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

      {showForm && (
        <form className="staff-form no-print" onSubmit={handleAdd}>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} required>
            <option value="">Select Staff Member...</option>
            {editableStaffList.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.sn || 'No SN'})</option>)}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="scheduled">Scheduled Shift</option>
            {ROSTER_STATUS_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
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
              <label>Staff Members (Tick to select)</label>
              <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #c4b5fd', borderRadius: '6px', padding: '8px', background: '#fff' }}>
                {editableStaffList.map(s => (
                  <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: '13px' }}>
                    <input type="checkbox" checked={bulkStaffIds.includes(s.id)} onChange={() => toggleBulkStaff(s.id)} />
                    {s.name} ({s.sn || 'No SN'})
                  </label>
                ))}
              </div>
            </div>
            <div className="bulk-field"><label>Start</label><input type="date" value={bulkStartDate} onChange={(e) => setBulkStartDate(e.target.value)} /></div>
            <div className="bulk-field"><label>End</label><input type="date" value={bulkEndDate} onChange={(e) => setBulkEndDate(e.target.value)} /></div>
            <div className="bulk-field bulk-field-full">
              <label>Days</label>
              <div className="bulk-day-buttons">
                {DAY_LABELS.map((label, i) => <button key={i} type="button" className={bulkDaysOfWeek.includes(i) ? 'day-btn active' : 'day-btn'} onClick={() => toggleBulkDay(i)}>{label}</button>)}
              </div>
            </div>
            <div className="bulk-field">
              <label>Type</label>
              <select value={bulkType} onChange={(e) => setBulkType(e.target.value)}>
                <option value="scheduled">Shift</option>
                {ROSTER_STATUS_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            {bulkType === 'scheduled' && (
              <div className="bulk-field">
                <label>Shift</label>
                <select value={bulkShift} onChange={(e) => setBulkShift(e.target.value)}>
                  {SHIFT_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            )}
            {bulkType === 'scheduled' && bulkShift === 'CUSTOM' && (
              <div className="bulk-field bulk-field-full">
                <label>Custom Time</label>
                <input placeholder="e.g. 09:00 - 17:00" value={bulkCustomShift} onChange={(e) => setBulkCustomShift(e.target.value)} />
              </div>
            )}
          </div>
          <button className="bulk-submit-btn" onClick={handleBulkAssign} disabled={bulkSubmitting}>{bulkSubmitting ? '...' : `⚡ Create Entries`}</button>
        </div>
      )}

      <div className="week-nav no-print">
        <button onClick={() => changePeriod(-1)}>← Previous Month</button>
        <span>{formatLongDate(periodStart)} — {formatLongDate(periodEnd)}</span>
        <button onClick={() => changePeriod(1)}>Next Month →</button>
        {isAdmin && <button onClick={handleCopyPreviousPeriod} disabled={copying} style={{ background: '#8b5cf6' }}>{copying ? 'Copying...' : '📋 Copy Previous Period'}</button>}
      </div>

      <div ref={gridRef} className="roster-export-area" style={{ zoom: zoom }}>
        <div className="roster-title">
          <h1>FND {activeDeptName ? `${activeDeptName} ` : ''}DUTY ROSTER {formatLongDate(periodStart)} - {formatLongDate(periodEnd)}</h1>
        </div>

        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="roster-week-section">
            <div className="week-label">WEEK {weekIndex + 1}</div>
            <table className="roster-grid week-grid">
              <thead>
                <tr>
                  <th className="col-sn">SN No.</th><th className="col-name">NAME</th>
                  {reorderMode && <th className="reorder-col" style={{ width: '30px' }}>↕</th>}
                  {week.map((d) => <th key={formatDate(d)} className="col-date">{formatHeaderDate(d)}</th>)}
                </tr>
              </thead>
              <tbody>
                {visibleStaff.length === 0 ? <tr><td colSpan={reorderMode ? 10 : 9} style={{ textAlign: 'center', padding: '15px' }}>No staff found for this department.</td></tr> : visibleStaff.map((s) => (
                  <tr key={s.id}>
                    <td className="col-sn">{s.sn || '—'}</td>
                    <td className="col-name">{s.name}</td>
                    {reorderMode && (
                      <td className="reorder-col">
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <button onClick={(e) => { e.stopPropagation(); moveStaff(s.id, 'up'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '0' }}>▲</button>
                          <button onClick={(e) => { e.stopPropagation(); moveStaff(s.id, 'down'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: '0' }}>▼</button>
                        </div>
                      </td>
                    )}
                    {week.map((d) => {
                      const dStr = formatDate(d);
                      const isInPeriod = dStr >= formatDate(periodStart) && dStr <= formatDate(periodEnd);
                      if (!isInPeriod) return <td key={dStr} className="out-of-period-cell">&nbsp;</td>;

                      let entry = entries.find((e) => e.staffId === s.id && e.date === dStr);
                      if (!entry) {
                        entry = entries.find((e) => e.staffName === s.name && e.date === dStr);
                      }

                      let displayValue = ''; let cellClass = 'empty-cell';
                      let cellEditable = canEditDept(s.department) && !reorderMode;

                      if (entry) {
                        displayValue = entry.status === 'scheduled' ? (entry.shiftTime || '') : getShortLeave(entry.status);
                        if (entry.status === 'scheduled') cellClass = getShiftColorClass(entry.shiftTime || '');
                        else cellClass = getLeaveColorClass(entry.status);
                      } else if (ADMIN_DEPARTMENTS.includes(s.department)) {
                        const dayOfWeek = new Date(dStr + 'T00:00:00').getDay();
                        if (holidayDateSet.has(dStr) || dayOfWeek === 5 || dayOfWeek === 6) {
                          displayValue = 'HOLIDAY'; cellClass = 'admin-holiday';
                        }
                      }

                      return (
                        <td key={dStr} className={`${cellClass} ${cellEditable ? 'clickable-cell' : ''}`}
                            onClick={() => {
                              if (!cellEditable) return;
                              if (entry && (isApprovedLeaveStatus(entry.status) || entry.leaveRequestId)) {
                                toast.error('Approved leave cannot be edited here.');
                                return;
                              }
                              setEditCell({ staffId: s.id, staffName: s.name, date: dStr, dept: s.department });
                              setEditStatus(entry ? entry.status : 'scheduled');
                              setEditShift(entry && entry.status === 'scheduled' ? entry.shiftTime : '06:00 - 14:00');
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

      {editCell && (
        <div className="modal-backdrop no-print" onClick={() => setEditCell(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Roster: {editCell.staffName}</h3>
            <p style={{ color: '#475569', marginBottom: '20px' }}>Date: {editCell.date}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <select value={editStatus} onChange={(e) => { setEditStatus(e.target.value); if (e.target.value !== 'scheduled') setEditShift(''); }} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                <option value="scheduled">Scheduled Shift</option>
                {ROSTER_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                <option value="clear">Clear (Remove Entry)</option>
              </select>
              {editStatus === 'scheduled' && (
                <select value={editShift} onChange={e => setEditShift(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  {SHIFT_OPTIONS.filter(o => o !== 'CUSTOM').map(o => <option key={o} value={o}>{o}</option>)}
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

      <ConfirmDialog 
        isOpen={!!deleteStaffTarget}
        title="Remove Staff?"
        message="Are you sure you want to remove this staff member from the active pool?"
        confirmText="Remove"
        isDanger={true}
        onConfirm={() => setDeleteStaffTarget(null)}
        onCancel={() => setDeleteStaffTarget(null)}
      />

      <ConfirmDialog 
        isOpen={showClearConfirm}
        title="Clear All Selections?"
        message="Are you sure you want to clear all selections for this board?"
        confirmText="Clear"
        isDanger={true}
        onConfirm={() => setShowClearConfirm(false)}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}

export default RosterPage;