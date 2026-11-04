import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth';
import { apiFetch } from '../lib/api';
import { toast } from 'sonner';
import { ConfirmDialog } from '../components/Dialogs';

const AUDIENCES = ['FND Staffs', 'Ground Operations', 'Maintenance', 'Security', 'Fire & Rescue', 'Flight Operations', 'SMT & Management', 'Managers & Admins Only'];
const EMPTY_FORM = { title: '', message: '', audience: 'FND Staffs', priority: 'normal', status: 'published', publishAt: '', expiresAt: '' };
const toLocalInput = (value?: string) => value ? new Date(value).toISOString().slice(0, 16) : '';
const formatDate = (value?: string) => value ? new Date(value).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Immediately';

export default function AnnouncementsPage() {
  const { profile } = useAuth();
  const role = String(profile?.role || '').toLowerCase();
  const canManage = ['developer', 'admin', 'manager', 'owner'].includes(role);
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('All');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const load = useCallback(async () => {
    try { const data = await apiFetch('/announcements'); setItems(Array.isArray(data) ? data : []); }
    catch (error: any) { toast.error(error.message || 'Unable to load announcements'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => items.filter(item => filter === 'All' || item.priority === filter || item.status === filter), [filter, items]);
  const published = items.filter(item => item.status === 'published').length;
  const urgent = items.filter(item => item.priority === 'urgent' && item.status === 'published').length;

  const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(false); };
  const edit = (item: any) => { setEditingId(item.id); setForm({ title: item.title || '', message: item.message || '', audience: item.audience || 'FND Staffs', priority: item.priority || 'normal', status: item.status || 'published', publishAt: toLocalInput(item.publishAt), expiresAt: toLocalInput(item.expiresAt) }); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (saving) return; setSaving(true);
    try {
      const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      const requestedStatus = submitter?.value || form.status;
      const payload = { ...form, status: requestedStatus, publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : undefined, expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null };
      await apiFetch(editingId ? `/announcements/${editingId}` : '/announcements', { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      toast.success(editingId ? 'Announcement updated' : requestedStatus === 'draft' ? 'Draft saved' : 'Announcement published'); resetForm(); await load();
    } catch (error: any) { toast.error(error.message || 'Announcement could not be saved'); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!deleteTarget) return;
    try { await apiFetch(`/announcements/${deleteTarget.id}`, { method: 'DELETE' }); toast.success('Announcement deleted'); setDeleteTarget(null); await load(); }
    catch (error: any) { toast.error(error.message || 'Announcement could not be deleted'); }
  };

  return <div className="page-content announcements-page">
    <section className="announcements-hero"><div><span>Airport communications</span><h2>Announcements</h2><p>Publish clear, targeted notices to the right airport teams without unnecessary access controls.</p></div><div className="announcements-hero-actions"><button onClick={() => void load()}>Refresh</button>{canManage && <button className="primary" onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}>{showForm ? 'Close editor' : '+ New announcement'}</button>}</div></section>
    <section className="announcements-summary"><div><span>Visible notices</span><strong>{items.length}</strong><small>Your permitted audiences</small></div><div><span>Published</span><strong>{published}</strong><small>Active communication</small></div><div><span>Urgent</span><strong>{urgent}</strong><small>Requires attention</small></div></section>

    {showForm && canManage && <form className="announcement-editor" onSubmit={save}><header><div><span>{editingId ? 'Edit communication' : 'New communication'}</span><h3>{editingId ? 'Update announcement' : 'Publish an announcement'}</h3></div><small>Developer, Admin and Manager only</small></header><div className="announcement-editor-grid"><label className="wide">Title<input maxLength={120} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} required /></label><label className="wide">Message<textarea rows={5} maxLength={4000} value={form.message} onChange={event => setForm({ ...form, message: event.target.value })} required /></label><label>Audience<select value={form.audience} onChange={event => setForm({ ...form, audience: event.target.value })}>{AUDIENCES.map(audience => <option key={audience}>{audience}</option>)}</select></label><label>Priority<select value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value })}><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></label><label>Publish time<input type="datetime-local" value={form.publishAt} onChange={event => setForm({ ...form, publishAt: event.target.value })} /></label><label>Expiry (optional)<input type="datetime-local" value={form.expiresAt} onChange={event => setForm({ ...form, expiresAt: event.target.value })} /></label></div><footer><button type="button" onClick={resetForm}>Cancel</button><button type="submit" value="draft" disabled={saving}>Save draft</button><button type="submit" value="published" className="primary" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Publish'}</button></footer></form>}

    <section className="announcement-toolbar"><div><strong>Communication board</strong><span>{visible.length} announcement{visible.length === 1 ? '' : 's'}</span></div><select value={filter} onChange={event => setFilter(event.target.value)}><option>All</option><option value="urgent">Urgent</option><option value="important">Important</option>{canManage && <option value="draft">Drafts</option>}</select></section>
    <section className="announcement-feed">{loading ? <p className="announcement-empty">Loading announcements…</p> : visible.length === 0 ? <p className="announcement-empty">No announcements are available for this audience.</p> : visible.map(item => <article key={item.id} className={`announcement-card priority-${item.priority} ${item.status === 'draft' ? 'is-draft' : ''}`}><div className="announcement-priority-mark">{item.priority === 'urgent' ? '!' : item.priority === 'important' ? 'i' : 'FND'}</div><div className="announcement-content"><header><div><span>{item.audience}</span><h3>{item.title}</h3></div><div className="announcement-badges"><em>{item.priority}</em>{item.status === 'draft' && <em>draft</em>}</div></header><p>{item.message}</p><footer><span>By {item.createdByName || item.createdBy}</span><span>Published {formatDate(item.publishAt || item.createdAt)}</span>{item.expiresAt && <span>Expires {formatDate(item.expiresAt)}</span>}</footer></div>{canManage && <div className="announcement-actions"><button onClick={() => edit(item)}>Edit</button><button className="danger" onClick={() => setDeleteTarget(item)}>Delete</button></div>}</article>)}</section>
    <ConfirmDialog isOpen={!!deleteTarget} title="Delete announcement?" message={`“${deleteTarget?.title || 'This announcement'}” will be permanently removed.`} confirmText="Delete" isDanger onConfirm={remove} onCancel={() => setDeleteTarget(null)} />
  </div>;
}