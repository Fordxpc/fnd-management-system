import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import { ConfirmDialog } from '../components/Dialogs';

const formatDate = (date: Date) => date.toISOString().split('T')[0];

export default function RWYLightsPage() {
  const { profile, user, lightsInspectors } = useAuth();
  
  const isDev = profile?.role === 'developer';
  const isManager = profile?.role === 'manager' || profile?.role === 'admin';
  const isSMT = profile?.role === 'smt' || profile?.isSMT === true;
  
  const myStaffId = profile?.id; 
  const isSelectedInspector = lightsInspectors.some((i: any) => 
    i.staffName.toLowerCase() === (profile?.name || '').toLowerCase() || i.staffId === myStaffId
  );

  // Only these roles can fill the form
  const canEdit = isDev || isManager || isSelectedInspector;
  
  const [records, setRecords] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Form State
  const [date, setDate] = useState(formatDate(new Date()));
  const [inspector, setInspector] = useState('');
  const [remarks, setRemarks] = useState('');
  
  // Dynamic Lights Data
  const [lights, setLights] = useState<any>({
    edge: { sideA: 0, sideB: 0, status: 'In Service' },
    end: { sideA: 0, sideB: 0, status: 'In Service' },
    threshold: { count: 0, status: 'In Service' },
    apron: { masts: 0, perMast: 3, status: 'In Service' },
    rob: { status: 'In Service' },
    windcone: { status: 'In Service' }
  });

  const fetchData = useCallback(async () => {
    try {
      const [recData, staffData] = await Promise.all([apiFetch('/lights'), apiFetch('/staff')]);
      setRecords(recData);
      setStaffList(staffData);
      setLoading(false);
    } catch (err: any) { toast.error(err.message); setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleLightChange = (category: string, field: string, value: any) => {
    setLights((prev: any) => ({ ...prev, [category]: { ...prev[category], [field]: value } }));
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!inspector) { toast.error('Select the inspector'); return; }

    try {
      await apiFetch('/lights', {
        method: 'POST',
        body: JSON.stringify({ date, inspectorName: inspector, data: lights, remarks })
      });
      toast.success('Lights inspection saved!');
      setShowForm(false);
      setRemarks('');
      fetchData();
    } catch (err: any) { toast.error(err.message); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/lights/${deleteTarget}`, { method: 'DELETE' });
      toast.success('Record deleted');
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) { toast.error(err.message); }
  };

  if (loading) return <div className="page-content"><p>Loading...</p></div>;

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>🚨 Runway Lights Inspection</h2>
        {canEdit && (
          <button className="add-staff-btn" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New Inspection'}</button>
        )}
      </div>

      {showForm && canEdit && (
        <form className="staff-form" onSubmit={handleSubmit} style={{ marginBottom: '24px' }}>
          <div style={{ gridColumn: 'span 2', fontWeight: 600, marginBottom: '8px' }}>New Inspection Log</div>
          <div><label>Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
          <div>
            <label>Inspected By</label>
            <select value={inspector} onChange={e => setInspector(e.target.value)} required style={{ color: '#1e293b' }}>
              <option value="">Select Staff...</option>
              {staffList.map(s => <option key={s.id} value={s.name}>{s.name} ({s.department})</option>)}
            </select>
          </div>

          <div style={{ gridColumn: 'span 2', fontWeight: 600, marginTop: '16px', borderBottom: '1px solid #cbd5e1' }}>Light Details</div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', gridColumn: 'span 2', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
            {/* Edge Lights */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Edge Lights (Side A / B)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" placeholder="A" value={lights.edge.sideA} onChange={e => handleLightChange('edge', 'sideA', e.target.value)} />
                <input type="number" placeholder="B" value={lights.edge.sideB} onChange={e => handleLightChange('edge', 'sideB', e.target.value)} />
              </div>
            </div>
            {/* End Lights */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>End Lights (RWY01 / RWY19)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" placeholder="01" value={lights.end.sideA} onChange={e => handleLightChange('end', 'sideA', e.target.value)} />
                <input type="number" placeholder="19" value={lights.end.sideB} onChange={e => handleLightChange('end', 'sideB', e.target.value)} />
              </div>
            </div>
            {/* Threshold Lights */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Threshold Lights</label>
              <input type="number" placeholder="Count" value={lights.threshold.count} onChange={e => handleLightChange('threshold', 'count', e.target.value)} />
            </div>
            {/* Apron Mast */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Apron Mast (Masts x Lights)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" placeholder="Masts" value={lights.apron.masts} onChange={e => handleLightChange('apron', 'masts', e.target.value)} />
                <input type="number" placeholder="Per Mast" value={lights.apron.perMast} onChange={e => handleLightChange('apron', 'perMast', e.target.value)} />
              </div>
            </div>
            {/* ROB */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>ROB Status</label>
              <select value={lights.rob.status} onChange={e => handleLightChange('rob', 'status', e.target.value)} style={{ color: '#1e293b' }}>
                <option>In Service</option><option>Faulty</option>
              </select>
            </div>
            {/* Windcone */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Windcone Light</label>
              <select value={lights.windcone.status} onChange={e => handleLightChange('windcone', 'status', e.target.value)} style={{ color: '#1e293b' }}>
                <option>In Service</option><option>Faulty</option>
              </select>
            </div>
          </div>

          <div style={{ gridColumn: 'span 2' }}>
            <label>Technician Remarks / Notes</label>
            <textarea rows={2} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Details of faults or repairs..." />
          </div>

          <button type="submit" style={{ gridColumn: 'span 2', background: '#16a34a' }}>Save Inspection</button>
        </form>
      )}

      <div className="staff-list">
        <table>
          <thead><tr><th>Date</th><th>Inspector</th><th>Edge (A/B)</th><th>End (01/19)</th><th>Threshold</th><th>Apron</th><th>ROB</th><th>Windcone</th><th>Remarks</th><th>Actions</th></tr></thead>
          <tbody>
            {records.length === 0 ? <tr><td colSpan={10} style={{ textAlign: 'center', padding: '20px' }}>No records found.</td></tr> : records.map(r => (
              <tr key={r.id}>
                <td>{r.date}</td>
                <td><strong>{r.inspectorName}</strong></td>
                <td>{r.data.edge?.sideA || 0} / {r.data.edge?.sideB || 0}</td>
                <td>{r.data.end?.sideA || 0} / {r.data.end?.sideB || 0}</td>
                <td>{r.data.threshold?.count || 0}</td>
                <td>{r.data.apron?.masts || 0} x {r.data.apron?.perMast || 0}</td>
                <td>{r.data.rob?.status}</td>
                <td>{r.data.windcone?.status}</td>
                <td style={{ fontSize: '12px', color: '#64748b' }}>{r.remarks || '—'}</td>
                <td>
                  {(isDev || isManager) && <button className="delete-btn" onClick={() => setDeleteTarget(r.id)}>Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog isOpen={!!deleteTarget} title="Delete Record?" message="Permanently delete this light inspection record?" confirmText="Delete" isDanger={true} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  );
}