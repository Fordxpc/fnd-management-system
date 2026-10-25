import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  addDoc,
} from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from '../firebase';
import { useAuth } from '../auth';

const ADMIN_ROLES = ['developer', 'manager'];
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
  const isAllowed = ADMIN_ROLES.indexOf(profile?.role || '') !== -1;

  const [users, setUsers] = useState<any[]>([]);
  const [presets, setPresets] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]); // NEW: Staff data
  const [loading, setLoading] = useState<boolean>(true);

  // Pre-register form
  const [showPresetForm, setShowPresetForm] = useState<boolean>(false);
  const [presetEmail, setPresetEmail] = useState<string>('');
  const [presetRole, setPresetRole] = useState<string>('staff');
  const [presetDept, setPresetDept] = useState<string>('Ground Operations');
  const [savingPreset, setSavingPreset] = useState<boolean>(false);

  useEffect(() => {
    if (!isAllowed) {
      setLoading(false);
      return;
    }
    
    // Listen to Active Users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    
    // Listen to Pre-registered Users
    const unsubPresets = onSnapshot(collection(db, 'user_presets'), (snap) => {
      setPresets(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    // Listen to Staff Database (to get real names)
    const unsubStaff = onSnapshot(collection(db, 'staff'), (snap) => {
      setStaffList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubUsers();
      unsubPresets();
      unsubStaff();
    };
  }, [isAllowed]);

  if (!isAllowed) {
    return (
      <div className="page-content">
        <h2>Access Denied</h2>
        <p>Only Developers and Managers can access this page.</p>
      </div>
    );
  }

  // Helper to find the staff name by email
  const getStaffName = (email: string) => {
    if (!email) return '—';
    const s = staffList.find((st) => (st.email || '').toLowerCase() === email.toLowerCase());
    return s ? s.name : '—';
  };

  const handleChangeRole = async (userId: string, value: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: value });
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleChangeDept = async (userId: string, value: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { department: value });
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleDelete = async (userId: string, email: string) => {
    const ok = window.confirm(
      `Remove ${email} from the access list?\n\n` +
      `To fully delete their login, use Firebase Console → Authentication.`
    );
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleSendReset = async (email: string) => {
    const ok = window.confirm(
      `Send password reset email to ${email}?\n\n` +
      `They will receive a link to reset their password.`
    );
    if (!ok) return;

    try {
      await sendPasswordResetEmail(auth, email);
      alert(
        `✅ Reset email sent to ${email}.\n\n` +
        `They need to check that inbox (and spam folder).`
      );
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        alert('This user is not in Firebase Authentication.\nCreate them first via Firebase Console.');
      } else {
        alert('Error: ' + err.message);
      }
    }
  };

  const handleAddPreset = async (e: any) => {
    e.preventDefault();
    const email = presetEmail.trim().toLowerCase();
    if (!email) {
      alert('Email is required');
      return;
    }
    if (!email.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    if (users.some((u) => (u.email || '').toLowerCase() === email)) {
      alert('This user has already logged in and has an active account.');
      return;
    }
    if (presets.some((p) => (p.email || '').toLowerCase() === email)) {
      alert('This email is already pre-registered.');
      return;
    }

    setSavingPreset(true);
    try {
      await addDoc(collection(db, 'user_presets'), {
        email,
        role: presetRole,
        department: presetDept,
        createdAt: new Date().toISOString(),
        createdBy: profile?.email || '',
      });
      alert(
        `✅ Pre-registered!\n\n` +
        `${email}\n` +
        `Role: ${presetRole}\n` +
        `Department: ${presetDept}\n\n` +
        `When they log in for the first time, these settings will apply automatically.`
      );
      setPresetEmail('');
      setPresetRole('staff');
      setPresetDept('Ground Operations');
      setShowPresetForm(false);
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
    setSavingPreset(false);
  };

  const handleDeletePreset = async (id: string, email: string) => {
    const ok = window.confirm(`Remove pre-registration for ${email}?`);
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'user_presets', id));
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>User Management</h2>
        <button
          className="add-staff-btn"
          onClick={() => setShowPresetForm(!showPresetForm)}
        >
          {showPresetForm ? 'Cancel' : '+ Pre-register User'}
        </button>
      </div>

      <div className="info-banner">
        <strong>ℹ️ How to add a new user (2 options):</strong>
        <br />
        <strong>Option A — Pre-register here:</strong> Enter email + role + department.
        When they log in (once you've created their Firebase Auth login), they get their role automatically.
        <br />
        <strong>Option B — Manual:</strong> Have them log in once, then come back here to set their role.
        <br />
        <br />
        <em>
          Note: For either option, you still need to create their Firebase Authentication login first:
          <strong> Firebase Console → Authentication → Add user</strong>.
        </em>
      </div>

      {showPresetForm && (
        <form className="staff-form" onSubmit={handleAddPreset}>
          <div
            style={{
              gridColumn: 'span 2',
              marginBottom: '4px',
              fontWeight: 600,
              color: '#1e293b',
            }}
          >
            ➕ Pre-register User (before they log in)
          </div>

          <input
            type="email"
            placeholder="Email (must match their Firebase login) *"
            value={presetEmail}
            onChange={(e) => setPresetEmail(e.target.value)}
            required
          />

          <select value={presetRole} onChange={(e) => setPresetRole(e.target.value)}>
            {ALL_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <select value={presetDept} onChange={(e) => setPresetDept(e.target.value)}>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <div
            style={{
              gridColumn: 'span 2',
              fontSize: '12px',
              color: '#92400e',
              padding: '10px 12px',
              background: '#fef3c7',
              borderRadius: '6px',
            }}
          >
            ⚠️ The email must EXACTLY match the one in Firebase Authentication. When this
            person logs in, they will immediately get the role and department you set here.
          </div>

          <button type="submit" disabled={savingPreset}>
            {savingPreset ? 'Saving...' : 'Pre-register User'}
          </button>
        </form>
      )}

      {presets.length > 0 && (
        <div className="collapsible-card">
          <div className="collapsible-header" style={{ cursor: 'default' }}>
            <span>
              <strong>⏳ Pre-registered (awaiting first login)</strong>
              <span
                style={{
                  fontSize: '12px',
                  color: '#94a3b8',
                  fontWeight: 500,
                  marginLeft: '10px',
                }}
              >
                ({presets.length})
              </span>
            </span>
          </div>
          <div className="collapsible-body">
            <table>
              <thead>
                <tr>
                  <th>Name</th> {/* NEW HEADER */}
                  <th>Email</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Pre-registered by</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {presets.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{getStaffName(p.email)}</strong></td> {/* NEW CELL */}
                    <td>{p.email}</td>
                    <td>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          background:
                            p.role === 'smt'
                              ? '#fef3c7'
                              : p.role === 'manager'
                              ? '#dbeafe'
                              : p.role === 'developer'
                              ? '#fee2e2'
                              : '#e2e8f0',
                          color:
                            p.role === 'smt'
                              ? '#92400e'
                              : p.role === 'manager'
                              ? '#1e40af'
                              : p.role === 'developer'
                              ? '#991b1b'
                              : '#475569',
                        }}
                      >
                        {String(p.role).toUpperCase()}
                      </span>
                    </td>
                    <td>{p.department}</td>
                    <td style={{ fontSize: '12px', color: '#64748b' }}>
                      {p.createdBy || '—'}
                    </td>
                    <td>
                      <button
                        className="delete-btn"
                        onClick={() => handleDeletePreset(p.id, p.email)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="collapsible-card">
        <div className="collapsible-header" style={{ cursor: 'default' }}>
          <span>
            <strong>👥 Active Users</strong>
            <span
              style={{
                fontSize: '12px',
                color: '#94a3b8',
                fontWeight: 500,
                marginLeft: '10px',
              }}
            >
              ({users.length})
            </span>
          </span>
        </div>
        <div className="collapsible-body">
          {loading ? (
            <p style={{ color: '#64748b' }}>Loading...</p>
          ) : users.length === 0 ? (
            <div className="empty-state">
              <p>No users have logged in yet.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Name</th> {/* NEW HEADER */}
                    <th>Email</th>
                    <th>Role</th>
                    <th>Department</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td><strong>{getStaffName(u.email)}</strong></td> {/* NEW CELL */}
                      <td>{u.email}</td>
                      <td>
                        <select
                          value={u.role || 'staff'}
                          onChange={(e) => handleChangeRole(u.id, e.target.value)}
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
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={u.department || 'Ground Operations'}
                          onChange={(e) => handleChangeDept(u.id, e.target.value)}
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
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button
                          className="reset-pw-btn"
                          onClick={() => handleSendReset(u.email)}
                          title="Send password reset email"
                        >
                          📧 Reset PW
                        </button>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UsersPage;