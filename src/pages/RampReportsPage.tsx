import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import RampForm from './RampForm';
import { ConfirmDialog } from '../components/Dialogs';
import { canViewRamp, canEditRamp } from '../lib/permissions';

const DEFAULT_AC_TYPES = ['ATR-42/600', 'ATR-72/600', 'A320', 'A321', 'B737-800', 'DASH-8/300', 'DASH-8/200'];
const today = new Date().toISOString().slice(0, 10);
interface RampReportsPageProps { onEdit?: (report: any) => void; }

const normalizeRampLoads = (report: any) => {
  const normalized = { ...report };
  const aliases: Record<string, string> = { baggage: 'bag' };
  Object.entries(aliases).forEach(([legacy, current]) => {
    ['In', 'Out', 'Trans'].forEach(direction => {
      if (!normalized[`${current}${direction}`] && normalized[`${legacy}${direction}`]) normalized[`${current}${direction}`] = normalized[`${legacy}${direction}`];
      if (!normalized[`${current}${direction}Pcs`] && normalized[`${legacy}${direction}Pcs`]) normalized[`${current}${direction}Pcs`] = normalized[`${legacy}${direction}Pcs`];
      if (!normalized[`${current}${direction}Kg`] && normalized[`${legacy}${direction}Kg`]) normalized[`${current}${direction}Kg`] = normalized[`${legacy}${direction}Kg`];
    });
  });
  ['cargo', 'mail', 'bag', 'other'].forEach(prefix => {
    ['In', 'Out', 'Trans'].forEach(direction => {
      const combinedKey = `${prefix}${direction}`;
      const piecesKey = `${combinedKey}Pcs`;
      const kgKey = `${combinedKey}Kg`;
      const combined = String(normalized[combinedKey] || '').trim();
      if (combined && (!normalized[piecesKey] || !normalized[kgKey])) {
        const parts = combined.split(/[\/|]/).map(value => value.trim());
        if (!normalized[piecesKey]) normalized[piecesKey] = parts[0] || '';
        if (!normalized[kgKey]) normalized[kgKey] = parts[1] || '';
      }
      if (!normalized[combinedKey] && (normalized[piecesKey] || normalized[kgKey])) normalized[combinedKey] = `${normalized[piecesKey] || ''}/${normalized[kgKey] || ''}`;
    });
  });
  return normalized;
};
function RampReportsPage({ onEdit }: RampReportsPageProps) {
  const { profile, user } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [myStaff, setMyStaff] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewingReport, setViewingReport] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchReports = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const [data, staffData] = await Promise.all([apiFetch('/ramp/reports'), apiFetch('/staff').catch(() => [])]);
      setReports(Array.isArray(data) ? data.map(normalizeRampLoads) : []);
      const myEmail = String(profile?.email || user?.email || '').toLowerCase();
      setMyStaff(Array.isArray(staffData) ? staffData.find((staff: any) => String(staff.email || '').toLowerCase() === myEmail) || null : null);
    } catch (err: any) { toast.error(err.message || 'Unable to load Ramp reports'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [profile?.email, user?.email]);

  useEffect(() => { void fetchReports(true); }, [fetchReports]);
  const canView = canViewRamp(profile, myStaff);
  const canEdit = canEditRamp(profile, myStaff);
  const visibleReports = useMemo(() => reports.filter(report => {
    const queryMatch = [report.fltNo, report.acReg, report.route, report.acType].some(value => String(value || '').toLowerCase().includes(search.toLowerCase()));
    return queryMatch && (!dateFrom || report.date >= dateFrom) && (!dateTo || report.date <= dateTo);
  }), [reports, search, dateFrom, dateTo]);

  const handlePrintModal = () => {
    document.body.classList.add('printing-modal', 'printing-ramp'); window.print();
    window.setTimeout(() => document.body.classList.remove('printing-modal', 'printing-ramp'), 1000);
  };

  if (loading) return <div className="ramp-reports-empty">Loading Ramp reports…</div>;
  if (!canView) return <div className="empty-state"><p>No access to Ramp Reports.</p></div>;

  return <div className="ramp-reports-workspace">
    <section className="ramp-reports-summary"><div><span>Total reports</span><strong>{reports.length}</strong></div><div><span>Today</span><strong>{reports.filter(report => report.date === today).length}</strong></div><div><span>Departed</span><strong>{reports.filter(report => Boolean(report.atd)).length}</strong></div><div><span>With delay notes</span><strong>{reports.filter(report => String(report.delayTime || '').trim()).length}</strong></div></section>
    <section className="ramp-reports-controls"><label>Search<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Flight, registration, route or aircraft" /></label><label>From<input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} /></label><label>To<input type="date" value={dateTo} min={dateFrom} onChange={event => setDateTo(event.target.value)} /></label><button onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }}>Clear</button><button className="refresh" onClick={() => void fetchReports()} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button></section>
    <section className="ramp-reports-register"><header><div><h3>Saved Ramp reports</h3><p>{visibleReports.length} report{visibleReports.length === 1 ? '' : 's'} shown</p></div></header>{visibleReports.length === 0 ? <p className="ramp-reports-empty">No Ramp reports match the selected filters.</p> : <div className="ramp-reports-table"><table><thead><tr><th>Date</th><th>Flight</th><th>Aircraft</th><th>Route</th><th>Operational status</th><th>Actions</th></tr></thead><tbody>{visibleReports.map(report => <tr key={report.id}><td>{report.date || '—'}</td><td><strong>{report.fltNo || '—'}</strong><small>{report.acType || ''}</small></td><td>{report.acReg || '—'}</td><td>{report.route || '—'}</td><td><span className={`ramp-report-status ${report.atd ? 'departed' : report.ata ? 'arrived' : 'scheduled'}`}>{report.atd ? `Departed ${report.atd}` : report.ata ? `Arrived ${report.ata}` : 'Scheduled'}</span></td><td><div className="ramp-report-actions"><button onClick={() => setViewingReport(report)}>View / Print</button>{onEdit && canEdit && <button className="edit" onClick={() => setEditTarget(report)}>Edit</button>}{canEdit && <button className="delete" onClick={() => setDeleteTarget(report)}>Delete</button>}</div></td></tr>)}</tbody></table></div>}</section>

    {viewingReport && <div className="modal-backdrop" onClick={() => setViewingReport(null)}><div className="modal-content ramp-report-modal" id="viewReportModal" onClick={event => event.stopPropagation()}><header className="no-print"><div><span>Saved Ramp report</span><h3>{viewingReport.fltNo || 'Flight report'} · {viewingReport.date || 'No date'}</h3></div><div><button className="print" onClick={handlePrintModal}>Print / Save PDF</button><button onClick={() => setViewingReport(null)}>Close</button></div></header><div className="modal-scrollable-body"><RampForm formData={viewingReport} handleChange={() => {}} isManager={false} acTypes={Array.from(new Set([...DEFAULT_AC_TYPES, viewingReport.acType].filter(Boolean)))} routeCodes={[]} handleAddAcType={() => {}} handleAddRoute={() => {}} appendRoute={() => {}} isViewOnlyMode /></div></div></div>}

    <ConfirmDialog isOpen={!!editTarget} title="Load saved report for editing?" message={`The current form will be replaced with ${editTarget?.fltNo || 'this report'}.`} confirmText="Load report" onConfirm={() => { if (editTarget && onEdit) onEdit(editTarget); setEditTarget(null); }} onCancel={() => setEditTarget(null)} />
    <ConfirmDialog isOpen={!!deleteTarget} title="Delete Ramp report?" message={`${deleteTarget?.fltNo || 'This report'} on ${deleteTarget?.date || 'the recorded date'} will be permanently removed.`} confirmText="Delete" isDanger onConfirm={async () => { if (!deleteTarget) return; try { await apiFetch(`/ramp/reports/${deleteTarget.id}`, { method: 'DELETE' }); toast.success('Report deleted'); setDeleteTarget(null); await fetchReports(true); } catch (err: any) { toast.error(err.message); } }} onCancel={() => setDeleteTarget(null)} />
  </div>;
}
export default RampReportsPage;