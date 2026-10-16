import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, doc, updateDoc, deleteDoc, setDoc
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import { useAuth } from '../auth';

const ADMIN_ROLES = ['developer', 'manager'];

const ALL_ROLES = [
  { value: 'developer', label: 'Developer (full access)' },
  { value: 'manager',   label: 'Manager / Owner (full access)' },
  { value: 'admin',     label: 'Admin (full access)' },
  { value: 'smt',       label: 'SMT (manages rosters + approves own dept)' },
  { value: 'staff',     label: 'Staff (view only)' },
];

const DEPARTMENTS = [
  'Ground Operations',
  'Maintenance',
  'Security',
  'Fire & Rescue',
  'Administration',
];

function UsersPage() {
  const { profile } = useAuth();
  const isAllowed = ADMIN_ROLES.includes(profile?.role || '');

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<string>('');

  const [showForm, setShowForm] = useState<boolean>(false);
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newRole, setNewRole] = useState<string>('staff');
  const [newDept, setNewDept] = useState<string>('Ground Operations');
  const [adding, setAdding] = useState<boolean>(false);

  useEffect(() => {
    if (!isAllowed) return;
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [isAllowed]);

  if (!isAllowed) {
    return (
      <div className="page-content">
        <h2>Access Denied</h2>
        <p>Only Developers and Managers can access this page.</p>
      </div>
    );
  }

  const handleChangeRole = async (userId: string, newRoleValue: string) => {
    setSaving(userId);
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRoleValue });
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
    setSaving('');
  };

  const handleChangeDept = async (userId: string, newDeptValue: string) => {
    setSaving(userId);
    try {
      await updateDoc(doc(db, 'users', userId), { department: newDeptValue });
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
    setSaving('');
  };

  const handleDelete = async (userId: string, email: string) => {
    if (!window.confirm(
      `⚠️ Remove ${email} from the users collection?\n\n` +
      `Note: This only removes their access record. To fully delete their login, ` +
      `use Firebase Console → Authentication.`
    )) return;

    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleAddUser = async (e: any) => {
    e.preventDefault();
    if (!newEmail || !newPassword) {
      alert('Email and password are required');
      return;
    }
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    if (users.some((u) => (u.email || '').toLowerCase() === newEmail.toLowerCase())) {
      alert('A user with this email already exists.');
      return;
    }

    setAdding(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, newEmail, newPassword);

      await setDoc(doc(db, 'users', cred.user.uid), {
        email: newEmail,
        role: newRole,
        department: newDept,
        createdAt: new Date().toISOString(),
      });

      await signOut(auth);

      alert(
        `✅ User ${newEmail} created!\n\n` +
        `⚠️ You've been signed out. Please log back in to continue managing users.`
      );

      window.location.href = '/';
    } catch (err: any) {
      alert('Error creating user: ' + err.message);
    }
    setAdding(false);
  };

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>User Management</h2>
        <button className="add-staff-btn" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      <div className="info-banner">
        <strong>ℹ️ About roles:</strong>
        <br />
        • <strong>Developer</strong> — full access to everything
        <br />
        • <strong>Manager</strong> — Airport Manager, full access
        <br />
        • <strong>SMT</strong> — manages rosters + approves leave for their department
        <br />
        • <strong>Staff</strong> — read-only, view own roster + submit leave
      </div>

      {showForm && (
        <form className="staff-form" onSubmit={handleAddUser}>
          <div style={{ gridColumn: 'span 2', marginBottom: '4px', fontWeight: 600, color: '#1e293b' }}>
            ➕ Create New User
          </div>
          <input
            type="email"
            placeholder="Email *"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Temporary password (min 6 chars) *"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
            {ALL_ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <select value={newDept} onChange={(e) => setNewDept(e.target.value)}>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <div style={{ gridColumn: 'span 2', fontSize: '12px', color: '#92400e', padding: '10px 12px', background: '#fef3c7', borderRadius: '6px' }}>
            ⚠️ Creating a user will sign you out temporarily. You'll need to log back in.
          </div>

          <button type="submit" disabled={adding}>
            {adding ? 'Creating...' : 'Create User'}
          </button>
        </form>
      )}

      <div className="staff-list">
        {loading ? (
          <div className="empty-state"><p>Loading...</p></div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <p>No users yet.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users
                .slice()
                .sort((a, b) => (a.email || '').localeCompare(b.email || ''))
                .map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.email}</strong></td>
                    <td>
                      <select
                        value={u.role || 'staff'}
                        onChange={(e) => handleChangeRole(u.id, e.target.value)}
                        disabled={saving === u.id}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontFamily: 'inherit',
                          fontSize: '12px',
                          background: '#ffffff',
                          color: '#1e293b',
                          fontWeight: 600,
                        }}
                      >
                        {ALL_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.value}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={u.department || 'Ground Operations'}
                        onChange={(e) => handleChangeDept(u.id, e.target.value)}
                        disabled={saving === u.id}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontFamily: 'inherit',
                          fontSize: '12px',
                          background: '#ffffff',
                          color: '#1e293b',
                        }}
                      >
                        {DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ fontSize: '12px', color: '#64748b' }}>
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <button
                        className="delete-btn"
                        onClick={() => handleDelete(u.id, u.email)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default UsersPage;