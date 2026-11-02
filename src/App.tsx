import { useState } from 'react';
import { useAuth } from './auth';
import { apiFetch } from './lib/api';
import Dashboard from './Dashboard';
import PublicLiveView from './pages/PublicLiveView';
import ForgotPasswordModal from './pages/ForgotPasswordModal';
import './App.css';
import { toast } from 'sonner';

const MANAGEMENT_ROLES = ['developer', 'manager', 'owner', 'admin', 'smt'];
const DEPARTMENTS = ['Ground Operations', 'Maintenance', 'Security', 'Fire & Rescue', 'Administration', 'Safety'];

function App() {
  if (window.location.pathname === '/live') {
    return <PublicLiveView />;
  }

  const [tab, setTab] = useState<'management' | 'employee'>('management');
  const [email, setEmail] = useState('@funadhooairport.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [department, setDepartment] = useState('');
  const [checking, setChecking] = useState(false);
  const [showForgotPw, setShowForgotPw] = useState(false);
  const { user, login, logout } = useAuth();

  const handleLogin = async (e: any) => {
    e.preventDefault();
    setChecking(true);

    try {
      if (tab === 'employee' && !department) {
        toast.error('Please select your department.');
        setChecking(false);
        return;
      }

      await login(email, password);

      let staffDept = "";
      try {
        const emailLower = email.trim().toLowerCase();
        const staffData = await apiFetch('/staff');
        const match = staffData.find(
          (s: any) => (s.email || '').trim().toLowerCase() === emailLower
        );
        if (match) {
          staffDept = match.department || "";
        }
      } catch (e) { console.warn(e); }

      const users = await apiFetch('/users');
      const data = users.find(
        (u: any) => (u.email || '').toLowerCase() === email.toLowerCase()
      ) || {};

      const role = data.role || 'staff';
      const userDept = staffDept || data.department || 'Ground Operations';
      const isManagement = MANAGEMENT_ROLES.includes(role);

      if (tab === 'management' && !isManagement) {
        await logout();
        toast.error('This is an Employee account. Please use the "EMPLOYEE" tab to sign in.');
        setChecking(false);
        return;
      }

      if (tab === 'employee' && isManagement) {
        await logout();
        toast.error('This is an SMT / Manager account. Please use the "SMT / MANAGER" tab to sign in.');
        setChecking(false);
        return;
      }

      if (tab === 'employee' && userDept && userDept !== department) {
        await logout();
        toast.error(`Your account is registered under "${userDept}". Please select "${userDept}" in the dropdown.`);
        setChecking(false);
        return;
      }

      window.location.reload();

    } catch (error: any) {
      console.error(error);
      toast.error(String(error));
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
          <p>FND Management System</p>
        </div>

        <div className="role-toggle">
          <button className={tab === 'management' ? 'active' : ''} onClick={() => { setTab('management'); setDepartment(''); }} type="button">
            SMT / MANAGER
          </button>
          <button className={tab === 'employee' ? 'active' : ''} onClick={() => setTab('employee')} type="button">
            EMPLOYEE
          </button>
        </div>

        <p className="subtitle">
          {tab === 'management' ? 'Sign in to manage rosters, staff and approvals' : 'Sign in to view your schedule and requests'}
        </p>

        <form className="login-form" onSubmit={handleLogin}>
          <div className="input-group">
            <label>Email</label>
            <input type="email" placeholder="name@funadhooairport.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="input-group">
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: '100%', paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#64748b' }}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {tab === 'employee' && (
            <div className="input-group">
              <label>Department</label>
              <select value={department} onChange={(e) => setDepartment(e.target.value)} required>
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
          <a href="#" onClick={(e) => { e.preventDefault(); setShowForgotPw(true); }}>Forgot password?</a>
          <p>No account? <a href="#" onClick={(e) => { e.preventDefault(); toast.error('Please contact the Administrator to create an account.'); }}>Register</a></p>
        </div>
      </div>
      
      {showForgotPw && <ForgotPasswordModal onClose={() => setShowForgotPw(false)} />}
    </div>
  );
}

export default App;