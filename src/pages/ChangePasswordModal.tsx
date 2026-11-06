import { useState } from 'react';
import type { FormEvent } from 'react';
import { authClient } from '../lib/auth-client';
import { toast } from 'sonner';

interface Props {
  onClose: () => void;
}

function ChangePasswordModal({ onClose }: Props) {
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields'); return;
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      toast.error('New password must be between 8 and 128 characters'); return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match'); return;
    }
    if (newPassword === currentPassword) {
      toast.error('New password must be different from the current password'); return;
    }

    setSubmitting(true);
    try {
      const { error } = await authClient.changePassword({
        newPassword,
        currentPassword,
        revokeOtherSessions: true,
      });

      if (error) throw new Error(error.message);

      toast.success('Password changed successfully');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Password could not be changed. Check your current password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>🔐 Change My Password</h3>
        <form onSubmit={handleSubmit}>
          
          <div className="input-group" style={{ marginBottom: '12px' }}>
            <label>Current Password</label>
            <div style={{ position: 'relative' }}>
              <input type={showCurrent ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required style={{ width: '100%', paddingRight: '40px' }} />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#64748b' }}>{showCurrent ? '🙈' : '👁️'}</button>
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: '12px' }}>
            <label>New Password (8–128 characters)</label>
            <div style={{ position: 'relative' }}>
              <input type={showNew ? "text" : "password"} minLength={8} maxLength={128} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required style={{ width: '100%', paddingRight: '40px' }} />
              <button type="button" onClick={() => setShowNew(!showNew)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#64748b' }}>{showNew ? '🙈' : '👁️'}</button>
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: '12px' }}>
            <label>Confirm New Password</label>
            <div style={{ position: 'relative' }}>
              <input type={showConfirm ? "text" : "password"} minLength={8} maxLength={128} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required style={{ width: '100%', paddingRight: '40px' }} />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#64748b' }}>{showConfirm ? '🙈' : '👁️'}</button>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="submit-btn" disabled={submitting}>{submitting ? 'Changing...' : 'Change Password'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ChangePasswordModal;