import { useState } from 'react';

interface ConfirmProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ isOpen, title, message, confirmText = 'Confirm', isDanger = false, onConfirm, onCancel }: ConfirmProps) {
  if (!isOpen) return null;
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ color: isDanger ? '#dc2626' : '#1e293b' }}>{title}</h3>
        <p style={{ color: '#475569', fontSize: '14px', marginBottom: '24px', whiteSpace: 'pre-line' }}>{message}</p>
        <div className="modal-actions">
          <button className="cancel-btn" onClick={onCancel}>Cancel</button>
          <button 
            className="submit-btn" 
            onClick={onConfirm}
            style={{ backgroundColor: isDanger ? '#dc2626' : '#2563eb' }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

interface PromptProps {
  isOpen: boolean;
  title: string;
  message: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function PromptDialog({ isOpen, title, message, placeholder = 'Type here...', onSubmit, onCancel }: PromptProps) {
  const [value, setValue] = useState('');
  if (!isOpen) return null;
  
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p style={{ color: '#475569', fontSize: '14px', marginBottom: '16px' }}>{message}</p>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', marginBottom: '20px', fontFamily: 'inherit' }}
          autoFocus
        />
        <div className="modal-actions">
          <button className="cancel-btn" onClick={onCancel}>Cancel</button>
          <button className="submit-btn" onClick={() => onSubmit(value)}>Submit</button>
        </div>
      </div>
    </div>
  );
}