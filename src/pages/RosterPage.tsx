import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// --- Date Helpers ---
const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatDisplayDate = (date: Date) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

const getDayName = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[d.getDay()];
};

// Period runs from 16th of a month to 15th of next month
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

const generateDates = (start: Date, end: Date) => {
  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

// --- Options ---
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
  const gridRef = useRef<HTMLDivElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [staffId, setStaffId] = useState('');
  const [date, setDate] = useState(formatDate(new Date()));
  const [shiftTime, setShiftTime] = useState('06:00 - 14:00');
  const [customShift, setCustomShift] = useState('');
  const [status, setStatus] = useState('scheduled');

  const periodEnd = getPeriodEnd(periodStart);
  const periodDates = generateDates(periodStart, periodEnd);

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

  // --- Export Functions ---
  const captureCanvas = async () => {
    if (!gridRef.current) return null;

    // Clone the grid to export a clean version without sticky columns
    const original = gridRef.current;
    const clone = original.cloneNode(true) as HTMLElement;
    clone.style.position = 'fixed';
    clone.style.left = '-99999px';
    clone.style.top = '0';
    clone.style.width = 'auto';
    clone.style.overflow = 'visible';
    clone.style.background = '#ffffff';
    clone.style.padding = '20px';

    // Remove sticky positioning
    clone.querySelectorAll('.sticky-col, .sticky-col-name').forEach((el) => {
      (el as HTMLElement).style.position = 'static';
    });

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
      link.download = `FND-Roster-${formatDate(periodStart)}.jpg`;
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
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pdfWidth / canvas.width, (pdfHeight - 20) / canvas.height);
      const imgW = canvas.width * ratio;
      const imgH = canvas.height * ratio;
      const imgX = (pdfWidth - imgW) / 2;
      pdf.addImage(imgData, 'JPEG', imgX, 10, imgW, imgH);
      pdf.save(`FND-Roster-${formatDate(periodStart)}.pdf`);
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    }
    setExporting(false);
  };

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>Duty Roster</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
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

      {showForm && (
        <form className="staff-form" onSubmit={handleAdd}>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} required>
            <option value="">Select Staff Member...</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.sn || 'No SN'})
              </option>
            ))}
          </select>

          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />

          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="scheduled">Scheduled Shift</option>
            {LEAVE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>

          {status === 'scheduled' && (
            <>
              <select value={shiftTime} onChange={(e) => setShiftTime(e.target.value)}>
                {SHIFT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
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
        <span>
          {formatDisplayDate(periodStart)} — {formatDisplayDate(periodEnd)}
        </span>
        <button onClick={() => changePeriod(1)}>Next Month →</button>
      </div>

      {/* The exportable area */}
      <div ref={gridRef} className="roster-export-area">
        <div className="roster-title">
          <h1>FND GROUND OPERATIONS DUTY ROSTER</h1>
          <p>
            {formatDisplayDate(periodStart)} — {formatDisplayDate(periodEnd)}
          </p>
        </div>

        <div className="roster-grid-container">
          <table className="roster-grid">
            <thead>
              <tr>
                <th className="sticky-col">SN No.</th>
                <th className="sticky-col-name">NAME</th>
                {periodDates.map((d) => (
                  <th key={d} className="date-col">
                    <div className="day-name">{getDayName(d)}</div>
                    <div className="day-num">{d.slice(8, 10)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 ? (
                <tr>
                  <td colSpan={periodDates.length + 2} style={{ textAlign: 'center', padding: '20px' }}>
                    No staff members found. Add staff first.
                  </td>
                </tr>
              ) : (
                staff.map((s) => (
                  <tr key={s.id}>
                    <td className="sticky-col">{s.sn || '—'}</td>
                    <td className="sticky-col-name">
                      <strong>{s.name}</strong>
                    </td>
                    {periodDates.map((d) => {
                      const entry = entries.find((e) => e.staffId === s.id && e.date === d);
                      let displayValue = '';
                      let cellClass = 'empty-cell';

                      if (entry) {
                        displayValue = entry.status === 'scheduled' ? entry.shiftTime : entry.status;
                        if (entry.status === 'OFF DAY') {
                          cellClass = 'off-day-cell';
                        } else if (entry.status && entry.status !== 'scheduled') {
                          cellClass = 'leave-cell';
                        } else {
                          cellClass = 'shift-cell';
                        }
                      }

                      return (
                        <td key={d} className={cellClass}>
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
      </div>
    </div>
  );
}

export default RosterPage;