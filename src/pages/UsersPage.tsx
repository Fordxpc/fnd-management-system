import { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../auth';
import { toast } from 'sonner';
import { ConfirmDialog } from '../components/Dialogs';
import { UserEditModal } from '../components/UserEditModal';

const EDIT_ROLES = ['developer', 'manager', 'admin', 'owner'];
const VIEW_ROLES = EDIT_ROLES;
const ALL_ROLES = ['developer', 'manager', 'admin', 'smt', 'staff'];
const DEPARTMENTS = ['Ground Operations', 'Maintenance', 'Security', 'Fire & Rescue', 'Administration', 'Safety'];



function UsersPage() {
  const { profile } = useAuth();
  const role = String(profile?.role || '').toLowerCase();
  const assignableRoles = role === 'developer' ? ALL_ROLES : ALL_ROLES.filter(value => value !== 'developer');
  const canView = VIEW_ROLES.includes(role);
  const canEdit = EDIT_ROLES.includes(role);

  const [users, setUsers] = useState<any[]>([]);
  const [presets, setPresets] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [deleteUserTarget, setDeleteUserTarget] = useState<{ id: string, email: string } | null>(null);
  const [deletePresetTarget, setDeletePresetTarget] = useState<{ id: string, email: string } | null>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showPresetForm, setShowPresetForm] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', position: '', role: 'staff', department: 'Ground Operations'
  });
  const [savingPreset, setSavingPreset] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    if (!canView) { setLoading(false); return; }
    try {
      const [usersData, presetsData, staffData] = await Promise.all([
        apiFetch('/users').catch(() => []), 
        apiFetch('/user-presets').catch(() => []), 
        apiFetch('/staff').catch(() => [])
      ]);
      setUsers(Array.isArray(usersData) ? usersData : []); 
      setPresets(Array.isArray(presetsData) ? presetsData : []); 
      setStaffList(Array.isArray(staffData) ? staffData : []); 
      setLoading(false);
    } catch (err: any) {
      toast.error(err.message);
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  if (!canView) return <div className="page-content"><h2>Access Denied</h2><p>You do not have permission to view this page.</p></div>;

  const getStaffRecord = (email: string) => staffList.find((staff) => (staff.email || '').toLowerCase() === String(email || '').toLowerCase());
  const getStaffName = (email: string) => getStaffRecord(email)?.name || '—';
  const getStaffSN = (email: string) => String(getStaffRecord(email)?.sn || 'NO SN').toUpperCase();

  const handleChangeRole = async (userId: string, value: string) => {
    if (!canEdit) return;
    try {
      const dept = users.find(u => u.id === userId)?.department || 'Ground Operations';
      await apiFetch(`/users/${userId}`, { method: 'PUT', body: JSON.stringify({ role: value, department: dept }) });
      toast.success('Role updated');
      fetchData();
    } catch (err: any) { toast.error('Error: ' + err.message); }
  };

  const handleChangeDept = async (userId: string, value: string) => {
    if (!canEdit) return;
    try {
      const currentRole = users.find(u => u.id === userId)?.role || 'staff';
      await apiFetch(`/users/${userId}`, { method: 'PUT', body: JSON.stringify({ role: currentRole, department: value }) });
      toast.success('Department updated');
      fetchData();
    } catch (err: any) { toast.error('Error: ' + err.message); }
  };

  const handleDelete = (userId: string, email: string) => setDeleteUserTarget({ id: userId, email });
  const handleDeletePreset = (id: string, email: string) => setDeletePresetTarget({ id, email });

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    
    const email = formData.email.trim().toLowerCase();
    if (!email || !formData.password) { toast.error('Email and Password are required'); return; }
    if (formData.password.length < 6 || formData.password.length > 10) { toast.error('Password must be between 6 and 10 characters'); return; }
    if (users.some((u) => (u.email || '').toLowerCase() === email)) { toast.error('This user already exists in the active database.'); return; }

    setSavingPreset(true);
    try {
      const res = await apiFetch('/users/create-auth', {
        method: 'POST',
        body: JSON.stringify({ 
          email, password: formData.password, role: formData.role,
          department: formData.department, name: formData.name, position: formData.position
        })
      });
      
      toast.success(res.message || `User ${email} created successfully!`);
      setFormData({ name: '', email: '', password: '', position: '', role: 'staff', department: 'Ground Operations' });
      setShowPresetForm(false);
      fetchData();
    } catch (err: any) { toast.error('Error: ' + err.message); }
    setSavingPreset(false);
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const visibleUsers = users
    .filter(user => role === 'developer' || String(user.role || '').toLowerCase() !== 'developer')
    .filter(user => !normalizedSearch || [user.name, getStaffName(user.email), getStaffSN(user.email), user.email, user.role, user.department].some(value => String(value || '').toLowerCase().includes(normalizedSearch)));
  const visiblePresets = presets
    .filter(user => role === 'developer' || String(user.role || '').toLowerCase() !== 'developer')
    .filter(user => !normalizedSearch || [user.name, getStaffName(user.email), getStaffSN(user.email), user.email, user.role, user.department].some(value => String(value || '').toLowerCase().includes(normalizedSearch)));
  if (loading) return <div className="page-content"><p>Loading Users...</p></div>;

  return (
    <div className="page-content users-workspace">
      <header className="users-hero">
        <div><span>Identity & access</span><h2>User Management</h2><p>Create accounts, maintain trusted staff identity, and manage role and department assignments.</p></div>
        <div className="users-hero-actions">
          {!canEdit && <span className="users-view-badge">View only</span>}
          {canEdit && <button type="button" onClick={() => setShowPresetForm(current => !current)}>{showPresetForm ? 'Close form' : 'Create user'}</button>}
        </div>
      </header>

      <section className="users-summary" aria-label="User account summary">
        <article><span>Active accounts</span><strong>{visibleUsers.length}</strong><small>authenticated users</small></article>
        <article><span>Pre-registered</span><strong>{visiblePresets.length}</strong><small>awaiting activation</small></article>
        <article><span>Management roles</span><strong>{visibleUsers.filter(user => ['developer', 'admin', 'manager', 'owner'].includes(String(user.role || '').toLowerCase())).length}</strong><small>protected access</small></article>
      </section>

      <div className="users-toolbar">
        <div><strong>Account directory</strong><span>Search by name, email, role or department.</span></div>
        <input type="search" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search accounts…" aria-label="Search user accounts" />
      </div>

      {showPresetForm && canEdit && (
        <form className="users-create-form" onSubmit={handleCreateUser}>
          <header><div><span>New access</span><h3>Create user account</h3></div><small>Temporary passwords must contain 6–10 characters.</small></header>
          <div className="users-create-grid">
            <label><span>Full name</span><input placeholder="e.g. Mohamed Fuadhu" value={formData.name} onChange={event => setFormData({...formData, name: event.target.value})} required /></label>
            <label><span>Designation</span><input placeholder="e.g. Operations Officer" value={formData.position} onChange={event => setFormData({...formData, position: event.target.value})} /></label>
            <label><span>Work email</span><input type="email" placeholder="email@funadhooairport.com" value={formData.email} onChange={event => setFormData({...formData, email: event.target.value})} required /></label>
            <label><span>Temporary password</span><input type="password" minLength={6} maxLength={10} autoComplete="new-password" placeholder="6–10 characters" value={formData.password} onChange={event => setFormData({...formData, password: event.target.value})} required /></label>
            <label><span>Role</span><select value={formData.role} onChange={event => setFormData({...formData, role: event.target.value})}>{assignableRoles.map(value => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select></label>
            <label><span>Department</span><select value={formData.department} onChange={event => setFormData({...formData, department: event.target.value})}>{DEPARTMENTS.map(department => <option key={department} value={department}>{department}</option>)}</select></label>
          </div>
          <footer><button type="button" onClick={() => setShowPresetForm(false)}>Cancel</button><button className="primary" type="submit" disabled={savingPreset}>{savingPreset ? 'Creating account…' : 'Create account'}</button></footer>
        </form>
      )}

      {visiblePresets.length > 0 && (
        <details className="users-section">
          <summary><div><span>Pending activation</span><strong>Pre-registered users</strong></div><em>{visiblePresets.length}</em></summary>
          <div className="users-table-wrap"><table className="users-table"><thead><tr><th>Identity</th><th>Role</th><th>Department</th>{canEdit && <th>Actions</th>}</tr></thead><tbody>
            {visiblePresets.map(user => <tr key={user.id}>
              <td data-label="Identity"><div className="users-identity"><i className="users-sn-avatar">{getStaffSN(user.email)}</i><div><strong>{user.name || getStaffName(user.email)}</strong><span>{user.email}</span></div></div></td>
              <td data-label="Role"><span className={`users-role users-role--${String(user.role || 'staff').toLowerCase()}`}>{user.role || 'staff'}</span></td>
              <td data-label="Department">{user.department || '—'}</td>
              {canEdit && <td data-label="Actions"><div className="users-row-actions"><button onClick={() => setEditingUser({ ...user, status: 'Pre-registered' })}>Edit</button><button className="danger" onClick={() => handleDeletePreset(user.id, user.email)}>Remove</button></div></td>}
            </tr>)}
          </tbody></table></div>
        </details>
      )}

      <section className="users-section active">
        <header><div><span>Authenticated directory</span><strong>Active users</strong></div><em>{visibleUsers.length}</em></header>
        {visibleUsers.length === 0 ? <div className="users-empty">No matching active users.</div> : <div className="users-table-wrap"><table className="users-table"><thead><tr><th>Identity</th><th>Role</th><th>Department</th>{canEdit && <th>Actions</th>}</tr></thead><tbody>
          {visibleUsers.map(user => {
            const protectedDeveloper = String(user.role || '').toLowerCase() === 'developer' && role !== 'developer';
            const isSelf = String(user.email || '').toLowerCase() === String(profile?.email || '').toLowerCase();
            return <tr key={user.id}>
              <td data-label="Identity"><div className="users-identity"><i className="users-sn-avatar">{getStaffSN(user.email)}</i><div><strong>{user.name || getStaffName(user.email)}</strong><span>{user.email}</span>{isSelf && <small>Current account</small>}</div></div></td>
              <td data-label="Role"><select value={user.role || 'staff'} onChange={event => void handleChangeRole(user.id, event.target.value)} disabled={!canEdit || protectedDeveloper || isSelf}>{assignableRoles.map(value => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select></td>
              <td data-label="Department"><select value={user.department || 'Ground Operations'} onChange={event => void handleChangeDept(user.id, event.target.value)} disabled={!canEdit || protectedDeveloper}>{DEPARTMENTS.map(department => <option key={department} value={department}>{department}</option>)}</select></td>
              {canEdit && <td data-label="Actions">{protectedDeveloper ? <span className="users-protected">Protected</span> : <div className="users-row-actions"><button onClick={() => setEditingUser({ ...user, status: 'Active' })}>Edit</button><button className="danger" disabled={isSelf} onClick={() => handleDelete(user.id, user.email)}>Remove</button></div>}</td>}
            </tr>;
          })}
        </tbody></table></div>}
      </section>


      <ConfirmDialog isOpen={!!deleteUserTarget} title="Remove User?" message={`Remove ${deleteUserTarget?.email} from the database?`} confirmText="Remove" isDanger={true} onConfirm={async () => {
          if (!deleteUserTarget) return;
          try { await apiFetch(`/users/${deleteUserTarget.id}`, { method: 'DELETE' }); toast.success('User removed.'); fetchData(); } 
          catch (err: any) { toast.error(err.message); }
          setDeleteUserTarget(null);
        }} onCancel={() => setDeleteUserTarget(null)} />

      <ConfirmDialog isOpen={!!deletePresetTarget} title="Remove Pre-registration?" message={`Remove pre-registration for ${deletePresetTarget?.email}?`} confirmText="Remove" isDanger={true} onConfirm={async () => {
          if (!deletePresetTarget) return;
          try { await apiFetch(`/user-presets/${deletePresetTarget.id}`, { method: 'DELETE' }); toast.success('Pre-registration removed.'); fetchData(); } 
          catch (err: any) { toast.error(err.message); }
          setDeletePresetTarget(null);
        }} onCancel={() => setDeletePresetTarget(null)} />

      {editingUser && <UserEditModal user={editingUser} onClose={() => setEditingUser(null)} onSaved={fetchData} />}
    </div>
  );
}

export default UsersPage;