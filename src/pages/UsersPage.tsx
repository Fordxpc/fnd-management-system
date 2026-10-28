import { useState, useEffect, useCallback } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import { ConfirmDialog } from '../components/Dialogs';
import { UserEditModal } from '../components/UserEditModal';

const VIEW_ROLES = ['developer', 'manager', 'admin', 'owner', 'smt'];
const EDIT_ROLES = ['developer', 'manager', 'admin', 'owner'];
const ALL_ROLES = ['developer', 'manager', 'admin', 'smt', 'staff'];

const DEPARTMENTS = ['Ground Operations', 'Maintenance', 'Security', 'Fire & Rescue', 'Administration', 'Safety'];

const selectStyle: React.CSSProperties = {
  padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px',
  background: '#ffffff', color: '#1e293b', colorScheme: 'light', width: '100%'
};

function UsersPage() {
  const { profile } = useAuth();
  const role = profile?.role || '';
  
  const canView = VIEW_ROLES.includes(role) || profile?.isSMT === true;
  const canEdit = EDIT_ROLES.includes(role);

  const [users, setUsers] = useState<any[]>([]);
  const [presets, setPresets] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Custom Dialog States
  const [resetPwTarget, setResetPwTarget] = useState<string | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<{ id: string, email: string } | null>(null);
  const [deletePresetTarget, setDeletePresetTarget] = useState<{ id: string, email: string } | null>(null);
  const [editingUser, setEditingUser] = useState<any>(null);

  // Form States (Updated for Firebase Auth Creation)
  const [showPresetForm, setShowPresetForm] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', position: '', role: 'staff', department: 'Ground Operations'
  });
  const [savingPreset, setSavingPreset] = useState<boolean>(false);

  const fetchData = useCallback(async () => {
    if (!canView) { setLoading(false); return; }
    
    try {
      const [usersData, presetsData, staffData] = await Promise.all([
        apiFetch('/users'), apiFetch('/user-presets'), apiFetch('/staff')
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

  if (!canView) return <div className="page-content"><h2>Access Denied</h2><p>You do not have permission to view this page.</p></div>;

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

  const handleDelete = (userId: string, email: string) => setDeleteUserTarget({ id: userId, email });
  const handleSendReset = (email: string) => setResetPwTarget(email);
  const handleDeletePreset = (id: string, email: string) => setDeletePresetTarget({ id, email });

  const handleCreateUser = async (e: any) => {
    e.preventDefault();
    if (!canEdit) return;
    
    const email = formData.email.trim().toLowerCase();
    if (!email || !formData.password) { toast.error('Email and Password are required'); return; }
    if (formData.password.length < 6) { toast.error('Password must be at least 6 characters'); return; }

    if (users.some((u) => (u.email || '').toLowerCase() === email)) {
      toast.error('This user already exists in the active database.'); return;
    }

    setSavingPreset(true);
    try {
      const res = await apiFetch('/users/create-auth', {
        method: 'POST',
        body: JSON.stringify({ 
          email, 
          password: formData.password,
          role: formData.role,
          department: formData.department,
          name: formData.name,
          position: formData.position
        })
      });
      
      toast.success(res.message || `User ${email} created successfully!`);
      setFormData({ name: '', email: '', password: '', position: '', role: 'staff', department: 'Ground Operations' });
      setShowPresetForm(false);
      fetchData();
    } catch (err: any) { 
      toast.error('Error: ' + err.message); 
    }
    setSavingPreset(false);
  };

  if (loading) return <div className="page-content"><p>Loading Users...</p></div>;

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>User Management { !canEdit && <span style={{ fontSize: '14px', color: '#dc2626', fontWeight: 'normal' }}>(View Only)</span> }</h2>
        {canEdit && (
          <button className="add-staff-btn" onClick={() => setShowPresetForm(!showPresetForm)}>
            {showPresetForm ? 'Cancel' : '+ Create New User'}
          </button>
        )}
      </div>

      {showPresetForm && canEdit && (
        <form className="staff-form" onSubmit={handleCreateUser}>
          <div style={{ gridColumn: 'span 2', marginBottom: '8px', fontWeight: 600, color: '#1e293b', fontSize: '16px' }}>
            ➕ Create New User (Adds to Firebase Auth & Database)
          </div>
          
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px', display: 'block' }}>Full Name</label>
            <input placeholder="e.g. Mohamed Fuadhu" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px', display: 'block' }}>Designation</label>
            <input placeholder="e.g. Operations Officer" value={formData.position} onChange={(e) => setFormData({...formData, position: e.target.value})} />
          </div>
          
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px', display: 'block' }}>Work Email *</label>
            <input type="email" placeholder="email@funadhooairport.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px', display: 'block' }}>Temporary Password *</label>
            <input type="text" placeholder="Min 6 characters" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} required />
          </div>
          
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px', display: 'block' }}>Role</label>
            <select value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} style={selectStyle}>
              {ALL_ROLES.map((r) => <option key={r} value={r}>{r.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px', display: 'block' }}>Department</label>
            <select value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})} style={selectStyle}>
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          
          <button type="submit" disabled={savingPreset} style={{ gridColumn: 'span 2', background: '#2563eb', color: 'white', padding: '12px', fontSize: '14px', marginTop: '10px' }}>
            {savingPreset ? 'Creating User...' : 'Create User Account'}
          </button>
        </form>
      )}

      {presets.length > 0 && (
        <div className="collapsible-card" style={{ marginTop: '20px' }}>
          <div className="collapsible-header" style={{ cursor: 'default' }}>
            <span><strong>⏳ Pre-registered Users (Waiting for first login)</strong></span>
          </div>
          <div className="collapsible-body" style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th>{canEdit && <th>Actions</th>}</tr>
              </thead>
              <tbody>
                {presets.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.name || getStaffName(p.email)}</strong></td>
                    <td>{p.email}</td>
                    <td><span style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: 700, background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{p.role}</span></td>
                    <td>{p.department}</td>
                    {canEdit && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="edit-btn" onClick={() => setEditingUser({ ...p, status: 'Pre-registered' })} style={{ marginRight: '6px', padding: '4px 8px', fontSize: '11px' }}>✏️ Edit</button>
                        <button className="delete-btn" onClick={() => handleDeletePreset(p.id, p.email)} style={{ padding: '4px 8px', fontSize: '11px' }}>Remove</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="collapsible-card" style={{ marginTop: '20px' }}>
        <div className="collapsible-header" style={{ cursor: 'default' }}>
          <span><strong>👥 Active Users</strong></span>
        </div>
        <div className="collapsible-body" style={{ overflowX: 'auto' }}>
          {users.length === 0 ? (
            <div className="empty-state"><p>No active users yet.</p></div>
          ) : (
            <div style={{ minWidth: '600px' }}>
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th>{canEdit && <th>Actions</th>}</tr></thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td><strong>{u.name || getStaffName(u.email)}</strong></td>
                      <td>{u.email}</td>
                      <td>
                        <select value={u.role || 'staff'} onChange={(e) => handleChangeRole(u.id, e.target.value)} disabled={!canEdit} style={{ ...selectStyle, background: canEdit ? '#ffffff' : '#f1f5f9' }}>
                          {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td>
                        <select value={u.department || 'Ground Operations'} onChange={(e) => handleChangeDept(u.id, e.target.value)} disabled={!canEdit} style={{ ...selectStyle, background: canEdit ? '#ffffff' : '#f1f5f9' }}>
                          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </td>
                      {canEdit && (
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="edit-btn" onClick={() => setEditingUser({ ...u, status: 'Active' })} style={{ marginRight: '6px', padding: '4px 8px', fontSize: '11px' }}>✏️ Edit</button>
                          <button className="reset-pw-btn" onClick={() => handleSendReset(u.email)} style={{ padding: '4px 8px', fontSize: '11px' }}>📧 Reset PW</button>
                          <button className="delete-btn" onClick={() => handleDelete(u.id, u.email)} style={{ marginLeft: '6px', padding: '4px 8px', fontSize: '11px' }}>Remove</button>
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

      <ConfirmDialog isOpen={!!resetPwTarget} title="Send Password Reset?" message={`Send a password reset email to ${resetPwTarget}?`} confirmText="Send" isDanger={false} onConfirm={async () => {
          if (!resetPwTarget) return;
          try { await sendPasswordResetEmail(auth, resetPwTarget); toast.success(`Reset email sent.`); } catch (err: any) { toast.error(err.message); }
          setResetPwTarget(null);
        }} onCancel={() => setResetPwTarget(null)} />

      <ConfirmDialog isOpen={!!deleteUserTarget} title="Remove User?" message={`Remove ${deleteUserTarget?.email} from the database?`} confirmText="Remove" isDanger={true} onConfirm={async () => {
          if (!deleteUserTarget) return;
          try { await apiFetch(`/users/${deleteUserTarget.id}`, { method: 'DELETE' }); toast.success('User removed.'); fetchData(); } catch (err: any) { toast.error(err.message); }
          setDeleteUserTarget(null);
        }} onCancel={() => setDeleteUserTarget(null)} />

      <ConfirmDialog isOpen={!!deletePresetTarget} title="Remove Pre-registration?" message={`Remove pre-registration for ${deletePresetTarget?.email}?`} confirmText="Remove" isDanger={true} onConfirm={async () => {
          if (!deletePresetTarget) return;
          try { await apiFetch(`/user-presets/${deletePresetTarget.id}`, { method: 'DELETE' }); toast.success('Pre-registration removed.'); fetchData(); } catch (err: any) { toast.error(err.message); }
          setDeletePresetTarget(null);
        }} onCancel={() => setDeletePresetTarget(null)} />

      {editingUser && <UserEditModal user={editingUser} onClose={() => setEditingUser(null)} onSaved={fetchData} />}
    </div>
  );
}

export default UsersPage;