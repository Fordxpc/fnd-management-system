import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import RampForm from './RampForm';

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
          <div 
            className="modal-content" 
            id="viewReportModal" 
            style={{ maxWidth: '1100px', width: '95%', display: 'flex', flexDirection: 'column' }} 
            onClick={e => e.stopPropagation()}
          >
            
            {/* STICKY HEADER */}
            <div className="modal-header no-print" style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ margin: 0 }}>Report: {viewingReport.fltNo}</h3>
              <div>
                <button className="quick-btn" style={{ background: '#166534', color: 'white', marginRight: '10px' }} onClick={handlePrintModal}>🖨️ Print / Save as PDF</button>
                <button className="cancel-btn" onClick={() => setViewingReport(null)}>Close</button>
              </div>
            </div>

            {/* SCROLLABLE BODY */}
            <div className="modal-scrollable-body" style={{ padding: '20px', overflowY: 'auto', flex: 1, background: '#f8fafc', maxHeight: '85vh' }}>
              <RampForm
                formData={viewingReport}
                handleChange={() => {}}
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