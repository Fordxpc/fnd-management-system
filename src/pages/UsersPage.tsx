import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
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
];

function UsersPage() {
  const { profile } = useAuth();
  const isAllowed = ADMIN_ROLES.indexOf(profile?.role || '') !== -1;

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isAllowed) {
      setLoading(false);
      return;
    }
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

  return (
    <div className="page-content">
      <div className="staff-header">
        <h2>User Management</h2>
      </div>

      <div className="info-banner">
        <strong>ℹ️ How to add a new user:</strong>
        <br />
        1. Firebase Console → Authentication → Add user
        <br />
        2. Have them log in once to the app
        <br />
        3. Come back to this page to set their Role + Department
        <br />
        <br />
        <strong>🔐 Password help:</strong>
        <br />
        • Users can change their own password via the sidebar
        <br />
        • Click <strong>📧 Reset PW</strong> to send them a reset email
        <br />
        • <em>Reset emails only work if the user has a real inbox — placeholder emails like
        <code>sn-0439@funadhooairport.com</code> won't receive anything.</em>
      </div>

      <div className="staff-list">
        {loading ? (
          <div className="empty-state"><p>Loading...</p></div>
        ) : users.length === 0 ? (
          <div className="empty-state"><p>No users yet.</p></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Department</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.email}</strong></td>
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
                        <option key={r} value={r}>{r}</option>
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
                        <option key={d} value={d}>{d}</option>
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
        )}
      </div>
    </div>
  );
}

export default UsersPage;