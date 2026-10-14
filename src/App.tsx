import { useState } from 'react';
import { useAuth } from './auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import Dashboard from './Dashboard';
import './App.css';

// Roles that use the SMT / MANAGER tab
const MANAGEMENT_ROLES = ['developer', 'manager', 'owner', 'admin', 'smt'];

// All departments in the system
const DEPARTMENTS = [
  'Operations',
  'Security',
  'Maintenance',
  'Administration',
  'Fire & Rescue',
];

function App() {
  const [tab, setTab] = useState<'management' | 'employee'>('management');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState('');
  const [checking, setChecking] = useState(false);
  const { user, login, logout } = useAuth();

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setChecking(true);

    try {
      // 1. Validate department is chosen for employees
      if (tab === 'employee' && !department) {
        alert('Please select your department.');
        setChecking(false);
        return;
      }

      // 2. Sign in with Firebase Auth
      const cred = await login(email, password);

      // 3. Load the user's role + department from Firestore
      const userRef = doc(db, 'users', cred.user.uid);
      const userSnap = await getDoc(userRef);
      const data = userSnap.exists() ? userSnap.data() : {};
      const role = data.role || 'staff';
      const userDept = data.department || '';

      const isManagement = MANAGEMENT_ROLES.includes(role);

      // 4. Validate the tab matches the actual role
      if (tab === 'management' && !isManagement) {
        await logout();
        alert('This is an Employee account. Please use the "EMPLOYEE" tab to sign in.');
        setChecking(false);
        return;
      }

      if (tab === 'employee' && isManagement) {
        await logout();
        alert('This is an SMT / Manager account. Please use the "SMT / MANAGER" tab to sign in.');
        setChecking(false);
        return;
      }

      // 5. Validate the selected department matches the user's profile
      if (tab === 'employee' && userDept && userDept !== department) {
        await logout();
        alert(
          `Your account is registered under "${userDept}". ` +
          `Please select "${userDept}" in the department dropdown.`
        );
        setChecking(false);
        return;
      }

      // Success — AuthProvider handles the redirect
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setChecking(false);
    }
  };

  if (user) {
    return <Dashboard user={user} logout={logout} />;
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="header">
          <h1>Funadhoo Airport</h1>
          <p>Staff Duty & Leave Management</p>
        </div>

        <div className="role-toggle">
          <button
            className={tab === 'management' ? 'active' : ''}
            onClick={() => { setTab('management'); setDepartment(''); }}
            type="button"
          >
            SMT / MANAGER
          </button>
          <button
            className={tab === 'employee' ? 'active' : ''}
            onClick={() => setTab('employee')}
            type="button"
          >
            EMPLOYEE
          </button>
        </div>

        <p className="subtitle">
          {tab === 'management'
            ? 'Sign in to manage rosters, staff and approvals'
            : 'Sign in to view your schedule and requests'}
        </p>

        <form className="login-form" onSubmit={handleLogin}>
          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              placeholder="name@funadhooairport.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {tab === 'employee' && (
            <div className="input-group">
              <label>Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                required
              >
                <option value="">Select your department...</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}

          <button type="submit" className="submit-btn" disabled={checking}>
            {checking ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="footer-links">
          <a href="#">Forgot password?</a>
          <p>
            No account? <a href="#">Register</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;