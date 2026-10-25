import { useState, useEffect, useCallback } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth';
import { toast } from 'sonner';

const VIEW_ROLES = ['developer', 'manager', 'admin', 'owner', 'smt'];
const EDIT_ROLES = ['developer', 'manager', 'admin', 'owner'];
const ALL_ROLES = ['developer', 'manager', 'admin', 'smt', 'staff'];

const DEPARTMENTS = [
  'Ground Operations',
  'Maintenance',
  'Security',
  'Fire & Rescue',
  'Administration',
  'Safety', 
];

function UsersPage() {
  const { profile } = useAuth();
  const role = profile?.role || '';
  
  const canView = VIEW_ROLES.includes(role) || profile?.isSMT === true;
  const canEdit = EDIT_ROLES.includes(role);

  const [users, setUsers] = useState<any[]>([]);
  const [presets, setPresets] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [showPresetForm, setShowPresetForm] = useState<boolean>(false);
  const [presetEmail, setPresetEmail] = useState<string>('');
  const [presetRole, setPresetRole] = useState<string>('staff');
  const [presetDept, setPresetDept] = useState<string>('Ground Operations');
  const [savingPreset, setSavingPreset] = useState<boolean>(false);

  // FETCH DATA FROM D1
  const fetchData = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    
    try {
      const [usersData, presetsData, staffData] = await Promise.all([
        apiFetch('/users'),
        apiFetch('/user-presets'),
        apiFetch('/staff')
      ]);
      
      setUsers(usersData);
      setPresets(presetsData);
      setStaffList(staffData);
      setLoading(false);
    } catch (err: any) {
      toast.error(err.message);
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (!canView) {
    return (
      <div className="page-content">
        <h2>Access Denied</h2>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  const getStaffName = (email: string) => {
    if (!email) return '—';
    const s = staffList.find((st) => (st.email || '').toLowerCase() === email.toLowerCase());
    return s ? s.name : '—';
  };

  const handleChangeRole = async (userId: string, value: string) => {
    if (!canEdit) return;
    try {
      await apiFetch(`/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ role: value, department: users.find(u => u.id === userId)?.department || 'Ground Operations' })
      });
      toast.success('Role updated');
      fetchData();
    } catch (err: any) { toast.error('Error: ' + err.message); }
  };

  const handleChangeDept = async (userId: string, value: string) => {
    if (!canEdit) return;
    try {
      await apiFetch(`/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ role: users.find(u => u.id === userId)?.role || 'staff', department: value })
      });
      toast.success('Department updated');
      fetchData();
    } catch (err: any) { toast.error('Error: ' + err.message); }
  };

  const handleDelete = async (userId: string, email: string) => {
    if (!canEdit) return;
    if (!window.confirm(`Remove ${email} from the access list?`)) return;
    try {
      await apiFetch(`/users/${userId}`, { method: 'DELETE' });
      toast.success('User removed.');
      fetchData();
    } catch (err: any) { toast.error('Error: ' + err.message); }
  };

  const handleSendReset = async (email: string) => {
    if (!canEdit) return;
    if (!window.confirm(`Send password reset email to ${email}?`)) return;
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success(`Reset email sent to ${email}.`);
    } catch (err: any) {
      toast.error(err.code === 'auth/user-not-found' ? 'User not in Firebase Auth.' : err.message);
    }
  };

  const handleAddPreset = async (e: any) => {
    e.preventDefault();
    if (!canEdit) return;
    
    const email = presetEmail.trim().toLowerCase();
    if (!email) { toast.error('Email is required'); return; }
    if (!email.includes('@')) { toast.error('Please enter a valid email address'); return; }

    if (users.some((u) => (u.email || '').toLowerCase() === email)) {
      toast.error('This user has already logged in and has an active account.');
      return;
    }
    if (presets.some((p) => (p.email || '').toLowerCase() === email)) {
      toast.error('This email is already pre-registered.');
      return;
    }

    setSavingPreset(true);
    try {
      await apiFetch('/user-presets', {
        method: 'POST',
        body: JSON.stringify({
          email, role: presetRole, department: presetDept, createdBy: profile?.email || ''
        })
      });
      toast.success(`Pre-registered!`);
      setPresetEmail('');
      setPresetRole('staff');
      setPresetDept('Ground Operations');
      setShowPresetForm(false);
      fetchData();
    } catch (err: any) { toast.error('Error: ' + err.message); }
    setSavingPreset(false);
  };

  const handleDeletePreset = async (id: string, email: string) => {
    if (!canEdit) return;
    if (!window.confirm(`Remove pre-registration for ${email}?`)) return;
    try {
      await apiFetch(`/user-presets/${id}`, { method: 'DELETE' });
      toast.success('Pre-registration removed.');
      fetchData();
    } catch (err: any) { toast.error('Error: ' + err.message); }
  };

  if (loading) return <div className="page-content"><p>Loading Users...</p></div>;

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>User Management { !canEdit && <span style={{ fontSize: '14px', color: '#dc2626', fontWeight: 'normal' }}>(View Only)</span> }</h2>
        {canEdit && (
          <button
            className="add-staff-btn"
            onClick={() => setShowPresetForm(!showPresetForm)}
          >
            {showPresetForm ? 'Cancel' : '+ Pre-register User'}
          </button>
        )}
      </div>

      {showPresetForm && canEdit && (
        <form className="staff-form" onSubmit={handleAddPreset}>
          <div style={{ gridColumn: 'span 2', marginBottom: '4px', fontWeight: 600, color: '#1e293b' }}>
            ➕ Pre-register User (before they log in)
          </div>
          <input type="email" placeholder="Email (must match their Firebase login) *" value={presetEmail} onChange={(e) => setPresetEmail(e.target.value)} required />
          <select value={presetRole} onChange={(e) => setPresetRole(e.target.value)} style={{ color: '#1e293b' }}>
            {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={presetDept} onChange={(e) => setPresetDept(e.target.value)} style={{ color: '#1e293b' }}>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <button type="submit" disabled={savingPreset}>{savingPreset ? 'Saving...' : 'Pre-register User'}</button>
        </form>
      )}

      {presets.length > 0 && (
        <div className="collapsible-card">
          <div className="collapsible-header" style={{ cursor: 'default' }}>
            <span><strong>⏳ Pre-registered (awaiting first login)</strong></span>
          </div>
          <div className="collapsible-body">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>Role</th><th>Department</th>
                  {canEdit && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {presets.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{getStaffName(p.email)}</strong></td>
                    <td>{p.email}</td>
                    <td><span style={{ textTransform: 'uppercase', fontSize: '11px' }}>{p.role}</span></td>
                    <td>{p.department}</td>
                    {canEdit && (
                      <td>
                        <button className="delete-btn" onClick={() => handleDeletePreset(p.id, p.email)}>Remove</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="collapsible-card">
        <div className="collapsible-header" style={{ cursor: 'default' }}>
          <span><strong>👥 Active Users</strong></span>
        </div>
        <div className="collapsible-body">
          {users.length === 0 ? (
            <div className="empty-state"><p>No users have logged in yet.</p></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Name</th><th>Email</th><th>Role</th><th>Department</th>
                    {canEdit && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td><strong>{getStaffName(u.email)}</strong></td>
                      <td>{u.email}</td>
                      <td>
                        <select
                          value={u.role || 'staff'}
                          onChange={(e) => handleChangeRole(u.id, e.target.value)}
                          disabled={!canEdit}
                          style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', background: canEdit ? '#fff' : '#f1f5f9', color: '#1e293b' }}
                        >
                          {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td>
                        <select
                          value={u.department || 'Ground Operations'}
                          onChange={(e) => handleChangeDept(u.id, e.target.value)}
                          disabled={!canEdit}
                          style={{ padding: '6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', background: canEdit ? '#fff' : '#f1f5f9', color: '#1e293b' }}
                        >
                          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </td>
                      {canEdit && (
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="reset-pw-btn" onClick={() => handleSendReset(u.email)}>📧 Reset PW</button>
                          <button className="delete-btn" onClick={() => handleDelete(u.id, u.email)} style={{ marginLeft: '6px' }}>Remove</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UsersPage;