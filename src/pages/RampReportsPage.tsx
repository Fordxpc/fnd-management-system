import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { toast } from 'sonner';

function RampReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [viewingReport, setViewingReport] = useState<any>(null);

  useEffect(() => {
    const q = query(collection(db, 'ramp_inspections'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this report permanently?')) return;
    try {
      await deleteDoc(doc(db, 'ramp_inspections', id));
      toast.success('Report deleted');
    } catch (err: any) { toast.error(err.message); }
  };

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>📁 Saved Ramp Reports</h2>
      </div>
      
      <div className="dash-card">
        <div style={{ overflowX: 'auto' }}>
          <table className="mini-table">
            <thead>
              <tr><th>Date</th><th>Flight No</th><th>A/C Reg</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {reports.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>No reports saved yet.</td></tr>
              ) : reports.map(r => (
                <tr key={r.id}>
                  <td>{r.date || '—'}</td>
                  <td><strong>{r.fltNo || '—'}</strong></td>
                  <td>{r.acReg || '—'}</td>
                  <td>
                    <button className="reset-pw-btn" onClick={() => setViewingReport(r)}>👁️ View / Print</button>
                    <button className="delete-btn" onClick={() => handleDelete(r.id)} style={{ marginLeft: '6px' }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for viewing and printing a specific report */}
      {viewingReport && (
        <div className="modal-backdrop" onClick={() => setViewingReport(null)}>
          <div className="modal-content" style={{ maxWidth: '1000px', width: '100%', padding: '20px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <h3>Report: {viewingReport.fltNo}</h3>
              <div>
                <button className="quick-btn" style={{ background: '#166534', color: 'white', marginRight: '10px' }} onClick={() => window.print()}>🖨️ Print / Save as PDF</button>
                <button className="cancel-btn" onClick={() => setViewingReport(null)}>Close</button>
              </div>
            </div>
            {/* 
              For the modal to print properly, we'd need to move the print CSS logic here. 
              For simplicity, we will just show the data in a summary table inside the modal.
            */}
            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <p><strong>A/C Type:</strong> {viewingReport.acType || '—'}</p>
                  <p><strong>ATA:</strong> {viewingReport.ata || '—'}</p>
                  <p><strong>STA:</strong> {viewingReport.sta || '—'}</p>
                  <p><strong>ETA:</strong> {viewingReport.eta || '—'}</p>
                  <p><strong>ATD:</strong> {viewingReport.atd || '—'}</p>
                </div>
                <div>
                  <p><strong>Route:</strong> {viewingReport.route || '—'}</p>
                  <p><strong>PAX IN:</strong> {viewingReport.paxInTotal || '0'}</p>
                  <p><strong>PAX OUT:</strong> {viewingReport.paxOutTotal || '0'}</p>
                  <p><strong>Cargo In/Out:</strong> {viewingReport.cargoIn || '0'} / {viewingReport.cargoOut || '0'}</p>
                  <p><strong>Comments:</strong> {viewingReport.comments || '—'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RampReportsPage;