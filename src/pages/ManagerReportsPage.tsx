import { useState } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import '../styles/manager-reports.css';

const departments = ['Ground Operations', 'Maintenance', 'Security', 'Fire & Rescue', 'Administration', 'Safety'];
const today = new Date();
const firstDate = new Date(today.getFullYear(), today.getMonth(), 1);
const ymd = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export default function ManagerReportsPage() {
  const { profile } = useAuth();
  const role = String(profile?.role || '').toLowerCase();
  const allowed = ['developer', 'admin', 'manager', 'owner'].includes(role);
  const [from, setFrom] = useState(ymd(firstDate));
  const [to, setTo] = useState(ymd(today));
  const [department, setDepartment] = useState('');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  if (!allowed) return <div className="page-content"><h2>Restricted report</h2><p>Management access is required.</p></div>;
  const generate = async () => {
    if (!from || !to || from > to) { toast.error('Select a valid date range'); return; }
    setLoading(true);
    try { setReport(await apiFetch(`/manager/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&department=${encodeURIComponent(department)}`)); }
    catch (error: any) { toast.error(error.message || 'Report failed'); }
    finally { setLoading(false); }
  };
  const exportCsv = () => {
    if (!report) return;
    const rows = [ ['Department', 'Duty shifts', 'Approved leave requests', 'Approved OT hours'],
      ...report.byDepartment.map((d: any) => [d.department, d.dutyShifts, d.leaveRequests, d.approvedOtHours]) ];
    const csv = rows.map(row => row.map((value: any) => `"${String(value).replaceAll('"','""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `FND-manager-${from}-to-${to}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  return <div className="page-content manager-reports"><div className="manager-reports-control no-print"><h2>Manager report generator</h2>
    <p>Generate duty, leave, OT and operational summaries for your selected period. Individual leave reasons are excluded.</p>
    <div className="manager-reports-filters"><label>From<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
    <label>To<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label>
    <label>Department<select value={department} onChange={event => setDepartment(event.target.value)}><option value="">All departments</option>{departments.map(value => <option key={value}>{value}</option>)}</select></label>
    <button disabled={loading} onClick={() => void generate()}>{loading ? 'Generating…' : 'Generate'}</button></div></div>
    {report && <section className="manager-report-paper"><header><span>FUNADHOO AIRPORT</span><h2>Management Summary</h2><p>{report.period.from} to {report.period.to} · {report.period.department}</p></header>
      <div className="manager-report-cards"><div><small>Duty shifts</small><strong>{report.roster.dutyShifts}</strong></div><div><small>Approved leave</small><strong>{report.leave.approved}</strong></div>
        <div><small>Approved overtime</small><strong>{report.overtime.approvedHours} h</strong></div><div><small>Flights</small><strong>{report.operations.scheduledFlights}</strong></div></div>
      <h3>Workforce and requests</h3><table><tbody><tr><th>Roster duplicates detected</th><td>{report.roster.duplicates}</td></tr>
        <tr><th>Pending leave requests</th><td>{report.leave.pending}</td></tr><tr><th>Rejected leave requests</th><td>{report.leave.rejected}</td></tr><tr><th>Pending overtime entries</th><td>{report.overtime.pending}</td></tr></tbody></table>
      <h3>Airport operations</h3><table><tbody><tr><th>Bird counts</th><td>{report.operations.birdCounts}</td></tr><tr><th>FOD collections</th><td>{report.operations.fodCollections}</td></tr>
        <tr><th>Ramp reports</th><td>{report.operations.rampReports}</td></tr><tr><th>RWY lights inspections</th><td>{report.operations.rwyInspections}</td></tr></tbody></table>
      <h3>By department</h3><table><thead><tr><th>Department</th><th>Duty shifts</th><th>Approved leave</th><th>Approved OT (h)</th></tr></thead>
        <tbody>{report.byDepartment.map((item: any) => <tr key={item.department}><td>{item.department}</td><td>{item.dutyShifts}</td><td>{item.leaveRequests}</td><td>{item.approvedOtHours}</td></tr>)}</tbody></table>
      <p className="manager-report-note">Counts reflect stored records in this period; leave requests spanning the range are counted once. OT uses stored approved hours; historical entries should be audited separately.</p>
      <div className="manager-report-actions no-print"><button onClick={() => window.print()}>Print / Save PDF</button><button onClick={exportCsv}>Export CSV</button></div>
    </section>}
  </div>;
}
