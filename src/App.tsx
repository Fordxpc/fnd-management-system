import { useState } from 'react';
import { useAuth } from './auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import Dashboard from './Dashboard';
import './App.css';

// Roles that are considered "management/owner" — must use the Owner/Manager tab
const MANAGEMENT_ROLES = ['developer', 'manager', 'owner', 'admin', 'smt'];

function App() {
  const [isOwner, setIsOwner] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [checking, setChecking] = useState(false);
  const { user, login, logout } = useAuth();

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setChecking(true);

    try {
      // 1. Sign in with Firebase Auth
      const cred = await login(email, password);

      // 2. Load the user's role from Firestore
      const userRef = doc(db, 'users', cred.user.uid);
      const userSnap = await getDoc(userRef);
      const role = userSnap.exists() ? userSnap.data().role : 'staff';

      const isManagement = MANAGEMENT_ROLES.includes(role);

      // 3. Validate the tab matches the actual role
      if (isOwner && !isManagement) {
        // Picked Owner/Manager tab but account is a regular staff
        await logout();
        alert('This account is a Staff account. Please use the "Staff" tab to sign in.');
        setChecking(false);
        return;
      }

      if (!isOwner && isManagement) {
        // Picked Staff tab but account is a manager
        await logout();
        alert('This account is an Owner/Manager account. Please use the "Owner / Manager" tab to sign in.');
        setChecking(false);
        return;
      }

      // 4. Role matches the tab — proceed to dashboard
      // (AuthProvider already handled the redirect via `user` state)
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setChecking(false);
    }
  };

  // If logged in → show the Dashboard
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
            className={isOwner ? 'active' : ''}
            onClick={() => setIsOwner(true)}
            type="button"
          >
            Owner / Manager
          </button>
          <button
            className={!isOwner ? 'active' : ''}
            onClick={() => setIsOwner(false)}
            type="button"
          >
            Staff
          </button>
        </div>

        <p className="subtitle">
          {isOwner
            ? 'Sign in to manage your airport roster'
            : 'Sign in to view your schedule'}
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