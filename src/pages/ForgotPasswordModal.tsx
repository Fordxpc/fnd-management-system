import { useState } from 'react';
import type { FormEvent } from 'react';
import { apiFetch } from '../lib/api';
import { toast } from 'sonner';

export default function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch('/request-password-reset', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      toast.success('Request sent to Administrator. They will reset it shortly.');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send request.');
    }
    setLoading(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', padding: '24px' }}>
        <h3 style={{ marginTop: 0, color: '#1e293b' }}>🔐 Forgot password request</h3>
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
          Enter your work email to submit a forgot-password request. An authorized manager will create a temporary password and share the login details with you securely.
        </p>
        <form onSubmit={handleSubmit}>
          <input 
            type="email" 
            placeholder="sn-0729@funadhooairport.com" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            style={{ width: '100%', padding: '10px', marginBottom: '16px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={loading} style={{ padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              {loading ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}