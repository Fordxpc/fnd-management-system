import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../auth';
import { apiFetch } from '../lib/api';
import { toast } from 'sonner';

const CATEGORIES = ['Runway Check', 'FOD Collection', 'RWY Lights Inspection', 'Flight Ops Task'];
const formatDate = (date: Date) => date.toISOString().split('T')[0];

function ChecklistPage() {
  const { profile, user } = useAuth();
  
  // 🚨 RBAC LOGIC
  const isDev = profile?.role === 'developer';
  const isManager = profile?.role === 'manager' || profile?.role === 'admin';
  const isSMT = profile?.role === 'smt' || profile?.isSMT === true;
  const isOpsSMT = isSMT && (profile?.department || '').toLowerCase() === 'ground operations';
  
  const canView = isDev || isManager || isSMT;
  const canEdit = isDev || isManager || isOpsSMT;

  const [checks, setChecks] = useState<any[]>([]);
  const [dateFilter, setDateFilter] = useState(formatDate(new Date()));
  const [loading, setLoading] = useState(true);
  
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [time, setTime] = useState('06:00');
  const [status, setStatus] = useState('Completed - OK');
  const [remarks, setRemarks] = useState('');

  const fetchChecks = async () => {
    try {
      setLoading(true);
      const data = await apiFetch('/checklist').catch(() => []);
      setChecks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) { setLoading(false); return; }
    fetchChecks();
    const interval = setInterval(fetchChecks, 15000);
    return () => clearInterval(interval);
  }, [canView]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    try {
      await apiFetch('/checklist', {
        method: 'POST',
        body: JSON.stringify({
          date: dateFilter, category, time, status, remarks,
          checkedBy: user?.email || '',
          createdAt: new Date().toISOString()
        })
      });
      toast.success('Check logged successfully');
      setShowForm(false);
      setRemarks('');
      fetchChecks();
    } catch (err: any) { toast.error(err.message || 'Failed to save check'); }
  };

  const handleDelete = async (id: string) => {
    if (!canEdit) return;
    try {
      await apiFetch(`/checklist/${id}`, { method: 'DELETE' });
      toast.success('Record deleted');
      fetchChecks();
    } catch (err: any) { toast.error(err.message || 'Failed to delete'); }
  };

  const visibleChecks = checks.filter(c => c.date === dateFilter).sort((a,b) => a.time.localeCompare(b.time));

  if (!canView) return <div className="page-content"><div className="empty-state"><h2>Access Denied</h2></div></div>;

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>Daily Operations Checks</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
          {canEdit && (
            <button className="add-staff-btn" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Log Check'}</button>
          )}
        </div>
      </div>

      {showForm && canEdit && (
        <form className="staff-form" onSubmit={handleSubmit}>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} required />
          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option>Completed - OK</option>
            <option>Completed - Action Needed</option>
            <option>Pending</option>
          </select>
          <input placeholder="Remarks (e.g. FOD found, light broken)" value={remarks} onChange={e => setRemarks(e.target.value)} required />
          <button type="submit" style={{ gridColumn: 'span 2' }}>Save Record</button>
        </form>
      )}

      <div className="staff-list">
        {loading ? <p>Loading...</p> : visibleChecks.length === 0 ? <div className="empty-state"><p>No checks logged for {dateFilter}</p></div> : (
          <table>
            <thead><tr><th>Time</th><th>Category</th><th>Status</th><th>Remarks</th><th>Checked By</th>{canEdit && <th></th>}</tr></thead>
            <tbody>
              {visibleChecks.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.time}</strong></td>
                  <td>{c.category}</td>
                  <td><span className={`status-badge ${c.status.includes('Action') ? 'status-pending' : 'status-approved'}`}>{c.status}</span></td>
                  <td>{c.remarks}</td>
                  <td style={{ fontSize: '11px', color: '#64748b' }}>{c.checkedBy}</td>
                  {canEdit && <td><button className="delete-btn" onClick={() => handleDelete(c.id)}>Delete</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
export default ChecklistPage;