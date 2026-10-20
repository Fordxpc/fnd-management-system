import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import RampForm from './RampForm'; // Import the reusable form

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

  const handlePrintModal = () => {
    document.body.classList.add('printing-modal');
    window.print();
    setTimeout(() => document.body.classList.remove('printing-modal'), 1000);
  };

  return (
    <div>
      <div className="dash-card" style={{ marginTop: '16px' }}>
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
          <div className="modal-content" id="viewReportModal" style={{ maxWidth: '1100px', width: '100%', padding: '20px' }} onClick={e => e.stopPropagation()}>
            
            <div className="modal-header no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
              <h3 style={{ margin: 0 }}>Report: {viewingReport.fltNo}</h3>
              <div>
                <button className="quick-btn" style={{ background: '#166534', color: 'white', marginRight: '10px' }} onClick={handlePrintModal}>🖨️ Print / Save as PDF</button>
                <button className="cancel-btn" onClick={() => setViewingReport(null)}>Close</button>
              </div>
            </div>

            {/* Use the exact same RampForm component in view-only mode */}
            <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px' }}>
              <RampForm
                formData={viewingReport}
                handleChange={() => {}} // No-op for view-only
                isManager={false}
                acTypes={[]}
                routeCodes={[]}
                handleAddAcType={() => {}}
                handleAddRoute={() => {}}
                appendRoute={() => {}}
                isViewOnlyMode={true}
              />
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default RampReportsPage;