import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import { ConfirmDialog } from '../components/Dialogs';

const today = new Date().toISOString().slice(0, 10);
const currentYear = String(new Date().getFullYear());
const formatHolidayDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};

function HolidaysPage() {
  const { profile } = useAuth();
  const canEdit = ['developer', 'manager', 'admin', 'owner'].includes(profile?.role || '');
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [year, setYear] = useState(currentYear);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const fetchHolidays = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try { setHolidays(await apiFetch('/holidays')); }
    catch (err: any) { toast.error(err.message || 'Unable to load holidays'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void fetchHolidays(true); }, [fetchHolidays]);

  const years = useMemo(() => Array.from(new Set([currentYear, ...holidays.map(holiday => String(holiday.date || '').slice(0, 4)).filter(Boolean)])).sort(), [holidays]);
  const visible = useMemo(() => holidays.filter(holiday => String(holiday.date || '').startsWith(year) && String(holiday.name || '').toLowerCase().includes(search.toLowerCase())).sort((a, b) => String(a.date).localeCompare(String(b.date))), [holidays, search, year]);
  const upcoming = holidays.filter(holiday => holiday.date >= today).sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];
  const thisYear = holidays.filter(holiday => String(holiday.date || '').startsWith(currentYear)).length;

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault(); if (saving) return; setSaving(true);
    try {
      await apiFetch('/holidays', { method: 'POST', body: JSON.stringify({ date, name }) });
      toast.success('Public holiday added'); setDate(''); setName(''); setShowForm(false); setYear(date.slice(0, 4)); await fetchHolidays(true);
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try { await apiFetch(`/holidays/${deleteTarget.id}`, { method: 'DELETE' }); toast.success('Holiday removed'); setDeleteTarget(null); await fetchHolidays(true); }
    catch (err: any) { toast.error(err.message); }
  };

  return <div className="page-content holidays-page">
    <section className="holidays-hero"><div><span>Workforce calendar</span><h2>Public Holiday Management</h2><p>Maintain the official holiday calendar used by roster planning, leave calculations and staff allowances.</p></div><div className="holidays-hero-actions"><button onClick={() => void fetchHolidays()} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>{canEdit && <button className="primary" onClick={() => setShowForm(value => !value)}>{showForm ? 'Close form' : '+ Add holiday'}</button>}</div></section>
    <section className="holidays-summary"><div><span>Total configured</span><strong>{holidays.length}</strong><small>All calendar years</small></div><div><span>Current year</span><strong>{thisYear}</strong><small>{currentYear}</small></div><div><span>Next holiday</span><strong className="date-value">{upcoming ? formatHolidayDate(upcoming.date) : 'None scheduled'}</strong><small>{upcoming?.name || 'Add the next official holiday'}</small></div></section>

    {showForm && canEdit && <form className="holidays-form" onSubmit={handleAdd}><header><div><span>Calendar entry</span><h3>Add an official holiday</h3></div><small>Only one holiday can be recorded per date.</small></header><div><label>Date<input type="date" value={date} onChange={event => setDate(event.target.value)} required /></label><label>Holiday name<input maxLength={100} placeholder="e.g. National Day" value={name} onChange={event => setName(event.target.value)} required /></label><button disabled={saving}>{saving ? 'Saving…' : 'Save holiday'}</button></div></form>}

    <section className="holidays-controls"><label>Calendar year<select value={year} onChange={event => setYear(event.target.value)}>{years.map(value => <option key={value}>{value}</option>)}</select></label><label>Search holidays<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by holiday name" /></label></section>
    <section className="holidays-register"><header><div><h3>{year} holiday calendar</h3><p>{visible.length} configured date{visible.length === 1 ? '' : 's'}</p></div></header>{loading ? <p className="holidays-empty">Loading public holidays…</p> : visible.length === 0 ? <p className="holidays-empty">No holidays match this calendar view.</p> : <div className="holidays-grid">{visible.map(holiday => { const isPast = holiday.date < today; return <article className={isPast ? 'past' : ''} key={holiday.id}><div className="holiday-date-block"><strong>{new Date(`${holiday.date}T00:00:00`).toLocaleDateString(undefined, { day: '2-digit' })}</strong><span>{new Date(`${holiday.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short' })}</span></div><div className="holiday-details"><h4>{holiday.name}</h4><p>{formatHolidayDate(holiday.date)}</p><span>{isPast ? 'Completed' : holiday.date === today ? 'Today' : 'Upcoming'}</span></div>{canEdit && <button className="delete-btn" onClick={() => setDeleteTarget(holiday)}>Delete</button>}</article>; })}</div>}</section>

    <ConfirmDialog isOpen={!!deleteTarget} title="Delete public holiday?" message={`${deleteTarget?.name || 'This holiday'} on ${formatHolidayDate(deleteTarget?.date || '')} will be removed from roster and leave calculations.`} confirmText="Delete" isDanger onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
  </div>;
}
export default HolidaysPage;