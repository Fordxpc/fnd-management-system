import { useState } from 'react';
import { apiFetch } from '../lib/api';
import { toast } from 'sonner';

const DEPARTMENTS = ['Ground Operations', 'Maintenance', 'Security', 'Fire & Rescue', 'Administration', 'Safety'];

interface UserEditModalProps {
  user: any;
  onClose: () => void;
  onSaved: () => void;
}

export function UserEditModal({ user, onClose, onSaved }: UserEditModalProps) {
  const [role, setRole] = useState(user.role || 'staff');
  const [dept, setDept] = useState(user.department || 'Ground Operations');
  const [name, setName] = useState(user.name || '');
  const [position, setPosition] = useState(user.position || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch(`/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ role, department: dept, name, position })
      });
      toast.success('User account updated successfully');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update user');
    }
    setSaving(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', padding: '24px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#1e293b' }}>Edit User: {user.email}</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Full Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#1e293b' }} 
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Designation / Position</label>
            <input 
              type="text" 
              value={position} 
              onChange={e => setPosition(e.target.value)} 
              style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#1e293b' }} 
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Role</label>
            <select 
              value={role} 
              onChange={e => setRole(e.target.value)} 
              style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#1e293b' }}
            >
              <option value="staff">Staff</option>
              <option value="smt">SMT</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
              <option value="developer">Developer</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Department</label>
            <select 
              value={dept} 
              onChange={e => setDept(e.target.value)} 
              style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#1e293b' }}
            >
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, color: '#475569' }}>Cancel</button>
          <button 
            onClick={handleSave} 
            disabled={saving} 
            style={{ padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}