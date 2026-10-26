import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { toast } from 'sonner';
import RampForm from './RampForm';
import { ConfirmDialog } from '../components/Dialogs';

interface RampReportsPageProps {
  onEdit?: (report: any) => void;
}

function RampReportsPage({ onEdit }: RampReportsPageProps) {
  const [reports, setReports] = useState<any[]>([]);
  const [viewingReport, setViewingReport] = useState<any>(null);
  
  // Custom Dialog State
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    try {
      const data = await apiFetch('/ramp/reports');
      setReports(data);
    } catch (err: any) { toast.error(err.message); }
  }, []);

  useEffect(() => {
    fetchReports();
    const interval = setInterval(fetchReports, 15000);
    return () => clearInterval(interval);
  }, [fetchReports]);

  const handleDelete = (id: string) => setDeleteTarget(id);

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
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="reset-pw-btn" onClick={() => setViewingReport(r)}>👁️ View / Print</button>
                    {onEdit && (
                      <button
                        className="edit-btn"
                        onClick={() => {
                          if (window.confirm(`Edit saved report ${r.fltNo || ''}? The current form will be replaced.`)) {
                            onEdit(r);
                          }
                        }}
                        style={{ marginLeft: '6px' }}
                      >
                        ✏️ Edit
                      </button>
                    )}
                    <button className="delete-btn" onClick={() => handleDelete(r.id)} style={{ marginLeft: '6px' }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewingReport && (
        <div className="modal-backdrop" onClick={() => setViewingReport(null)}>
          <div className="modal-content" id="viewReportModal" style={{ maxWidth: '1100px', width: '95%', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header no-print" style={{ padding: '15px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ margin: 0 }}>Report: {viewingReport.fltNo}</h3>
              <div>
                <button className="quick-btn" style={{ background: '#166534', color: 'white', marginRight: '10px' }} onClick={handlePrintModal}>🖨️ Print / Save as PDF</button>
                <button className="cancel-btn" onClick={() => setViewingReport(null)}>Close</button>
              </div>
            </div>
            <div className="modal-scrollable-body" style={{ padding: '20px', overflowY: 'auto', flex: 1, background: '#f8fafc', maxHeight: '85vh' }}>
              <RampForm
                formData={viewingReport}
                handleChange={() => {}}
                isManager={false}
                acTypes={[]}
                routeCodes={[]}
                handleAddAcType={() => {}}
                handleAddRoute={() => {}}
                appendRoute={(_code: string) => {}}
                isViewOnlyMode={true}
              />
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog 
        isOpen={!!deleteTarget}
        title="Delete Report?"
        message="Are you sure you want to permanently delete this report?"
        confirmText="Delete"
        isDanger={true}
        onConfirm={async () => {
          if (!deleteTarget) return;
          try {
            await apiFetch(`/ramp/reports/${deleteTarget}`, { method: 'DELETE' });
            toast.success('Report deleted');
            fetchReports();
          } catch (err: any) { toast.error(err.message); }
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default RampReportsPage;