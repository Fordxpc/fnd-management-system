import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../auth';
import { apiFetch } from '../lib/api';
import { toast } from 'sonner';
import { ConfirmDialog } from '../components/Dialogs';

const CATEGORIES = ['Runway Check', 'FOD Collection', 'RWY Lights Inspection', 'Flight Ops Task'];
const STATUSES = ['Completed - OK', 'Completed - Action Needed', 'Pending'];
const formatDate = (date: Date) => date.toISOString().slice(0, 10);

function ChecklistPage() {
  const { profile } = useAuth();
  const role = profile?.role || '';
  const fullAccess = ['developer', 'manager', 'admin', 'owner'].includes(role);
  const canView = fullAccess || role === 'smt' || profile?.isSMT === true || profile?.isSmt === true || profile?.isIncharge === true || profile?.specialOpsAccess === true || profile?.opsBoardViewAccess === true || profile?.opsBoardEditAccess === true;
  const canEdit = fullAccess || profile?.specialOpsAccess === true || profile?.opsBoardEditAccess === true;

  const [checks, setChecks] = useState<any[]>([]);
  const [dateFilter, setDateFilter] = useState(() => formatDate(new Date()));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [time, setTime] = useState('06:00');
  const [status, setStatus] = useState(STATUSES[0]);
  const [remarks, setRemarks] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const fetchChecks = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try { setChecks(await apiFetch('/checklist')); }
    catch (err: any) { toast.error(err.message || 'Unable to load operations checks'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { if (canView) void fetchChecks(true); else setLoading(false); }, [canView, fetchChecks]);

  const visibleChecks = useMemo(() => checks.filter(check => check.date === dateFilter)
    .sort((a, b) => String(a.time || '').localeCompare(String(b.time || ''))), [checks, dateFilter]);
  const okCount = visibleChecks.filter(check => check.status === 'Completed - OK').length;
  const attentionCount = visibleChecks.filter(check => check.status === 'Completed - Action Needed').length;
  const pendingCount = visibleChecks.filter(check => check.status === 'Pending').length;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault(); if (!canEdit || saving) return; setSaving(true);
    try {
      await apiFetch('/checklist', { method: 'POST', body: JSON.stringify({ date: dateFilter, category, time, status, remarks }) });
      toast.success('Operations check recorded'); setShowForm(false); setRemarks(''); await fetchChecks(true);
    } catch (err: any) { toast.error(err.message || 'Failed to save check'); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try { await apiFetch(`/checklist/${deleteTarget.id}`, { method: 'DELETE' }); toast.success('Check removed'); setDeleteTarget(null); await fetchChecks(true); }
    catch (err: any) { toast.error(err.message || 'Failed to delete check'); }
  };

  if (!canView) return <div className="page-content"><div className="empty-state"><h2>Access denied</h2><p>Operations Board viewing permission is required.</p></div></div>;

  return <div className="page-content checks-page">
    <section className="checks-hero">
      <div><span>Airside assurance</span><h2>Daily Operations Checks</h2><p>Track runway, lighting, FOD and flight operations checks through a single daily control log.</p></div>
      <div className="checks-hero-actions"><button onClick={() => void fetchChecks()} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>{canEdit && <button className="primary" onClick={() => setShowForm(value => !value)}>{showForm ? 'Close form' : '+ Log check'}</button>}</div>
    </section>

    <section className="checks-toolbar"><label>Operational date<input type="date" value={dateFilter} onChange={event => setDateFilter(event.target.value)} /></label><div><strong>{visibleChecks.length}</strong><span>checks logged</span></div></section>
    <section className="checks-summary"><div className="ok"><span>Completed — OK</span><strong>{okCount}</strong></div><div className="attention"><span>Action needed</span><strong>{attentionCount}</strong></div><div className="pending"><span>Pending</span><strong>{pendingCount}</strong></div><div><span>Coverage</span><strong>{Math.min(100, Math.round((new Set(visibleChecks.map(check => check.category)).size / CATEGORIES.length) * 100))}%</strong></div></section>

    {showForm && canEdit && <form className="checks-form" onSubmit={handleSubmit}><header><div><span>New entry</span><h3>Log an operational check</h3></div><small>Reporter identity is taken from your signed-in account.</small></header><div className="checks-form-grid"><label>Category<select value={category} onChange={event => setCategory(event.target.value)}>{CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></label><label>Time<input type="time" value={time} onChange={event => setTime(event.target.value)} required /></label><label>Status<select value={status} onChange={event => setStatus(event.target.value)}>{STATUSES.map(value => <option key={value}>{value}</option>)}</select></label><label className="wide">Remarks<textarea rows={3} maxLength={500} placeholder="Record findings, defects, FOD or action taken…" value={remarks} onChange={event => setRemarks(event.target.value)} required /></label></div><footer><span>{remarks.length}/500 characters</span><button disabled={saving}>{saving ? 'Saving…' : 'Save check'}</button></footer></form>}

    <section className="checks-register"><header><div><h3>Daily control log</h3><p>{dateFilter}</p></div><span className={attentionCount ? 'checks-alert' : 'checks-clear'}>{attentionCount ? `${attentionCount} item${attentionCount === 1 ? '' : 's'} need action` : 'No active alerts'}</span></header>{loading ? <p className="checks-empty">Loading operations checks…</p> : visibleChecks.length === 0 ? <p className="checks-empty">No checks have been recorded for this date.</p> : <div className="checks-table-wrap"><table><thead><tr><th>Time</th><th>Category</th><th>Status</th><th>Remarks</th><th>Checked by</th>{canEdit && <th>Action</th>}</tr></thead><tbody>{visibleChecks.map(check => <tr key={check.id}><td><strong>{check.time || '—'}</strong></td><td>{check.category || '—'}</td><td><span className={`checks-status ${check.status === 'Completed - OK' ? 'ok' : check.status === 'Pending' ? 'pending' : 'attention'}`}>{check.status || 'Unknown'}</span></td><td className="checks-remarks">{check.remarks || '—'}</td><td><small>{check.checkedBy || '—'}</small></td>{canEdit && <td><button className="delete-btn" onClick={() => setDeleteTarget(check)}>Delete</button></td>}</tr>)}</tbody></table></div>}</section>

    <ConfirmDialog isOpen={!!deleteTarget} title="Delete operations check?" message={`${deleteTarget?.category || 'This check'} at ${deleteTarget?.time || 'the recorded time'} will be permanently removed.`} confirmText="Delete" isDanger onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
  </div>;
}
export default ChecklistPage;