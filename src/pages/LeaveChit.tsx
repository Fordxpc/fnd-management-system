import { createPortal } from 'react-dom';
import '../styles/leave-chit.css';

const showDate = (date: any) => {
  if (!date) return '—';
  const parsed = new Date(`${String(date).slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? String(date) : parsed.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC'
  });
};

/** Preliminary layout. Replace with the official Funadhoo Airport sample when provided. */
export default function LeaveChit({ request, onClose }: { request: any; onClose: () => void }) {
  const approved = String(request?.status || '').toLowerCase() === 'approved';
  if (!approved) return null;
  return createPortal(<div className="leave-chit-overlay" role="dialog" aria-modal="true" aria-label="Leave chit preview">
    <section className="leave-chit-paper">
      <header><span>FUNADHOO AIRPORT</span><h1>LEAVE CHIT</h1><p>Generated from an approved Leave Request</p></header>
      <div className="leave-chit-reference"><span>Request reference</span><strong>{request.id}</strong></div>
      <div className="leave-chit-details">
        <div><label>Staff name</label><strong>{request.staffName || '—'}</strong></div>
        <div><label>Staff number</label><strong>{request.staffSn || request.staffSN || '—'}</strong></div>
        <div><label>Department</label><strong>{request.staffDepartment || '—'}</strong></div>
        <div><label>Leave type</label><strong>{request.leaveType || '—'}</strong></div>
        <div><label>From</label><strong>{showDate(request.startDate)}</strong></div>
        <div><label>To</label><strong>{showDate(request.endDate)}</strong></div>
        <div><label>Approved leave days</label><strong>{request.days ?? '—'}</strong></div>
        <div><label>Status</label><strong>APPROVED</strong></div>
      </div>
      <div className="leave-chit-approval"><h3>Approval details</h3>
        <p><strong>Reviewed by:</strong> {request.reviewedBy || '—'}</p>
        <p><strong>Reviewed on:</strong> {request.reviewedAt ? new Date(request.reviewedAt).toLocaleString('en-GB') : '—'}</p>
      </div>
      <div className="leave-chit-signatures"><div>Employee signature</div><div>Authorized signatory</div></div>
      <footer>This document is generated from the current approved leave record. Signature requirements and official layout will be confirmed against the airport's sample.</footer>
      <div className="leave-chit-actions no-print"><button type="button" onClick={onClose}>Close</button><button type="button" onClick={() => window.print()}>Print / Save as PDF</button></div>
    </section>
  </div>, document.body);
}
