import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import { ConfirmDialog } from '../components/Dialogs';

function HolidaysPage() {
  const { profile } = useAuth();
  const isDev = profile?.role === 'developer';
  const isManager = profile?.role === 'manager' || profile?.role === 'admin';
  const canEdit = isDev || isManager;

  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const fetchHolidays = useCallback(async () => {
    try {
      const data = await apiFetch('/holidays');
      setHolidays(data);
      setLoading(false);
    } catch (err: any) { toast.error(err.message); setLoading(false); }
  }, []);

  useEffect(() => { fetchHolidays(); }, [fetchHolidays]);

  const handleAdd = async (e: any) => {
    e.preventDefault();
    if (!date || !name) { toast.error('Please fill all fields'); return; }
    try {
      await apiFetch('/holidays', { method: 'POST', body: JSON.stringify({ date, name }) });
      toast.success('Holiday added!');
      setDate(''); setName(''); setShowForm(false);
      fetchHolidays();
    } catch (err: any) { toast.error(err.message); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/holidays/${deleteTarget.id}`, { method: 'DELETE' });
      toast.success('Holiday deleted');
      setDeleteTarget(null);
      fetchHolidays();
    } catch (err: any) { toast.error(err.message); }
  };

  if (loading) return <div className="page-content"><p>Loading...</p></div>;

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>Public Holidays</h2>
        {canEdit && (
          <button className="add-staff-btn" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Holiday'}
          </button>
        )}
      </div>

      {showForm && canEdit && (
        <form className="staff-form" onSubmit={handleAdd}>
          <div><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
          <div><label>Holiday Name</label><input placeholder="e.g. National Day" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <button type="submit" style={{ gridColumn: 'span 2' }}>Save Holiday</button>
        </form>
      )}

      <div className="staff-list">
        {holidays.length === 0 ? (
          <div className="empty-state"><p>No holidays configured.</p></div>
        ) : (
          <table>
            <thead><tr><th>Date</th><th>Name</th>{canEdit && <th>Actions</th>}</tr></thead>
            <tbody>
              {holidays.map(h => (
                <tr key={h.id}>
                  <td><strong>{h.date}</strong></td>
                  <td>{h.name}</td>
                  {canEdit && (
                    <td>
                      <button className="delete-btn" onClick={() => setDeleteTarget(h)}>Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Holiday?"
        message={`Delete ${deleteTarget?.name} on ${deleteTarget?.date}?`}
        confirmText="Delete"
        isDanger={true}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default HolidaysPage;