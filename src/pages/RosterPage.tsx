import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, doc, writeBatch } from 'firebase/firestore';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// --- Date helpers ---
const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const monthsFull = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];

const formatLongDate = (date: Date) =>
  `${date.getDate()} ${monthsFull[date.getMonth()]} ${date.getFullYear()}`;

const getPeriodStart = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  if (d.getDate() >= 16) {
    d.setDate(16);
  } else {
    d.setMonth(d.getMonth() - 1);
    d.setDate(16);
  }
  return d;
};

const getPeriodEnd = (start: Date) => {
  const d = new Date(start);
  d.setMonth(d.getMonth() + 1);
  d.setDate(15);
  return d;
};

const chunkIntoWeeks = (start: Date, end: Date): Date[][] => {
  const weeks: Date[][] = [];
  let current = new Date(start);
  const firstWeek: Date[] = [];
  while (current <= end && current.getDay() !== 6) {
    firstWeek.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  if (firstWeek.length > 0) weeks.push(firstWeek);
  while (current <= end) {
    const week: Date[] = [];
    for (let i = 0; i < 7 && current <= end; i++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
};

// Sort: by custom order if set, otherwise by SN
const sortStaff = (a: any, b: any) => {
  const aOrder = typeof a.order === 'number' ? a.order : 9999;
  const bOrder = typeof b.order === 'number' ? b.order : 9999;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return (a.sn || '').localeCompare(b.sn || '');
};

const SHIFT_OPTIONS = [
  '06:00 - 14:00',
  '08:00 - 16:00',
  '16:00 - 00:00',
  '00:00 - 08:00',
  'CUSTOM',
];

const LEAVE_OPTIONS = [
  'OFF DAY',
  'ANNUAL LEAVE',
  'SICK LEAVE',
  'SICK LEAVE / MC',
  'PATERNITY LEAVE',
  'MATERNITY LEAVE',
  'FAMILY RESPONSIBILITY LEAVE (FRL)',
];

function RosterPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [periodStart, setPeriodStart] = useState(getPeriodStart(new Date()));
  const [exporting, setExporting] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [staffId, setStaffId] = useState('');
  const [date, setDate] = useState(formatDate(new Date()));
  const [shiftTime, setShiftTime] = useState('06:00 - 14:00');
  const [customShift, setCustomShift] = useState('');
  const [status, setStatus] = useState('scheduled');

  const periodEnd = getPeriodEnd(periodStart);
  const weeks = chunkIntoWeeks(periodStart, periodEnd);
  const sortedStaff = [...staff].sort(sortStaff);

  useEffect(() => {
    const unsubStaff = onSnapshot(collection(db, 'staff'), (snapshot) => {
      setStaff(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubRoster = onSnapshot(collection(db, 'roster_entries'), (snapshot) => {
      setEntries(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubStaff();
      unsubRoster();
    };
  }, []);

  const handleAdd = async (e: any) => {
    e.preventDefault();
    if (!staffId) {
      alert('Please select a staff member');
      return;
    }
    const staffMember = staff.find((s) => s.id === staffId);

    let finalShiftTime = '';
    if (status === 'scheduled') {
      finalShiftTime = shiftTime === 'CUSTOM' ? customShift : shiftTime;
      if (!finalShiftTime) {
        alert('Please enter the custom shift time');
        return;
      }
    }

    try {
      await addDoc(collection(db, 'roster_entries'), {
        staffId,
        staffName: staffMember?.name || 'Unknown',
        date,
        shiftTime: finalShiftTime,
        status: status === 'scheduled' ? 'scheduled' : status,
        createdAt: new Date().toISOString(),
      });
      setShowForm(false);
      setCustomShift('');
      alert('Roster entry added!');
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const changePeriod = (direction: number) => {
    const newDate = new Date(periodStart);
    newDate.setMonth(newDate.getMonth() + direction);
    setPeriodStart(newDate);
  };

  // --- Reorder logic ---
  const moveStaff = async (id: string, direction: 'up' | 'down') => {
    const list = [...sortedStaff];
    const index = list.findIndex((s) => s.id === id);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    // Swap positions
    [list[index], list[targetIndex]] = [list[targetIndex], list[index]];

    // Save new order to Firestore
    try {
      const batch = writeBatch(db);
      list.forEach((s, i) => {
        batch.update(doc(db, 'staff', s.id), { order: i });
      });
      await batch.commit();
    } catch (err: any) {
      alert('Reorder failed: ' + err.message);
    }
  };

  // --- Export helpers ---
  const captureCanvas = async () => {
    if (!gridRef.current) return null;
    const original = gridRef.current;
    const clone = original.cloneNode(true) as HTMLElement;
    clone.style.position = 'fixed';
    clone.style.left = '-99999px';
    clone.style.top = '0';
    clone.style.width = 'auto';
    clone.style.background = '#ffffff';
    clone.style.padding = '20px';
    // Remove sticky + reorder column from export
    clone.querySelectorAll('.sticky-col, .sticky-col-name').forEach((el) => {
      (el as HTMLElement).style.position = 'static';
    });
    clone.querySelectorAll('.reorder-col').forEach((el) => el.remove());
    document.body.appendChild(clone);

    try {
      const canvas = await html2canvas(clone, {
        scale: 2,
        backgroundColor: '#ffffff',
        windowWidth: clone.scrollWidth,
        width: clone.scrollWidth,
      });
      document.body.removeChild(clone);
      return canvas;
    } catch (err) {
      document.body.removeChild(clone);
      throw err;
    }
  };

  const exportToJPG = async () => {
    setExporting(true);
    try {
      const canvas = await captureCanvas();
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `FND-Duty-Roster-${formatDate(periodStart)}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    }
    setExporting(false);
  };

  const exportToPDF = async () => {
    setExporting(true);
    try {
      const canvas = await captureCanvas();
      if (!canvas) return;
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pdfWidth / canvas.width, (pdfHeight - 20) / canvas.height);
      const imgW = canvas.width * ratio;
      const imgH = canvas.height * ratio;
      const imgX = (pdfWidth - imgW) / 2;
      pdf.addImage(imgData, 'JPEG', imgX, 10, imgW, imgH);
      pdf.save(`FND-Duty-Roster-${formatDate(periodStart)}.pdf`);
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    }
    setExporting(false);
  };

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>Duty Roster</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`export-btn ${reorderMode ? 'pdf-btn' : 'jpg-btn'}`}
            onClick={() => setReorderMode(!reorderMode)}
          >
            {reorderMode ? '✅ Done Reordering' : '↕️ Reorder Staff'}
          </button>
          <button className="export-btn jpg-btn" onClick={exportToJPG} disabled={exporting}>
            {exporting ? 'Exporting...' : '📷 Export JPG'}
          </button>
          <button className="export-btn pdf-btn" onClick={exportToPDF} disabled={exporting}>
            {exporting ? 'Exporting...' : '📄 Export PDF'}
          </button>
          <button className="add-staff-btn" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Assign Shift'}
          </button>
        </div>
      </div>

      {reorderMode && (
        <div className="reorder-banner">
          ↕️ <strong>Reorder Mode:</strong> Use the ↑ ↓ arrows next to each name to arrange the staff in your preferred order. 
          The changes save automatically and will apply to the exported JPG/PDF.
        </div>
      )}

      {showForm && (
        <form className="staff-form" onSubmit={handleAdd}>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} required>
            <option value="">Select Staff Member...</option>
            {sortedStaff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.sn || 'No SN'})
              </option>
            ))}
          </select>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="scheduled">Scheduled Shift</option>
            {LEAVE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {status === 'scheduled' && (
            <>
              <select value={shiftTime} onChange={(e) => setShiftTime(e.target.value)}>
                {SHIFT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
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

      <div className="week-nav">
        <button onClick={() => changePeriod(-1)}>← Previous Month</button>
        <span>{formatLongDate(periodStart)} — {formatLongDate(periodEnd)}</span>
        <button onClick={() => changePeriod(1)}>Next Month →</button>
      </div>

      {/* Exportable area */}
      <div ref={gridRef} className="roster-export-area">
        <div className="roster-title">
          <h1>FND GROUND OPERATIONS DUTY ROSTER</h1>
          <p>{formatLongDate(periodStart)} - {formatLongDate(periodEnd)}</p>
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
                      {formatDate(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedStaff.length === 0 ? (
                  <tr>
                    <td colSpan={week.length + (reorderMode ? 3 : 2)} style={{ textAlign: 'center', padding: '15px' }}>
                      No staff members found.
                    </td>
                  </tr>
                ) : (
                  sortedStaff.map((s, staffIndex) => (
                    <tr key={s.id}>
                      {reorderMode && (
                        <td className="reorder-col" style={{ padding: '2px' }}>
                          <button
                            className="reorder-btn"
                            onClick={() => moveStaff(s.id, 'up')}
                            disabled={staffIndex === 0}
                            title="Move Up"
                          >
                            ▲
                          </button>
                          <button
                            className="reorder-btn"
                            onClick={() => moveStaff(s.id, 'down')}
                            disabled={staffIndex === sortedStaff.length - 1}
                            title="Move Down"
                          >
                            ▼
                          </button>
                        </td>
                      )}
                      <td className="col-sn">{s.sn || '—'}</td>
                      <td className="col-name">{s.name}</td>
                      {week.map((d) => {
                        const dStr = formatDate(d);
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