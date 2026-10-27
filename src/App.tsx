import { useState } from 'react';
import { useAuth } from './auth';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import Dashboard from './Dashboard';
import PublicLiveView from './pages/PublicLiveView';
import './App.css';
import { toast } from 'sonner';

const MANAGEMENT_ROLES = ['developer', 'manager', 'owner', 'admin', 'smt'];
const DEPARTMENTS = ['Ground Operations', 'Maintenance', 'Security', 'Fire & Rescue', 'Administration', 'Safety'];

function App() {
  if (window.location.pathname === '/live') {
    return <PublicLiveView />;
  }

  const [tab, setTab] = useState<'management' | 'employee'>('management');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [department, setDepartment] = useState('');
  const [checking, setChecking] = useState(false);
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

      // 1. Log in first
      const cred = await login(email, password);

      // 2. Fetch the TRUE department from the STAFF collection (client-side filtering for accuracy)
      let staffDept = "";
      try {
        const emailLower = email.trim().toLowerCase();
        const staffSnap = await getDocs(collection(db, "staff"));
        const match = staffSnap.docs.find(d => (d.data().email || "").trim().toLowerCase() === emailLower);
        if (match) {
          staffDept = match.data().department || "";
        }
      } catch (e) { console.warn(e); }

      // 3. Fetch role from USERS collection
      const userRef = doc(db, 'users', cred.user.uid);
      const userSnap = await getDoc(userRef);
      const data = userSnap.exists() ? userSnap.data() : {};
      
      const role = data.role || 'staff';
      // Fallback logic: use staffDept, then users doc, then Ground Ops
      const userDept = staffDept || data.department || 'Ground Operations';

      const isManagement = MANAGEMENT_ROLES.includes(role);

      // 4. Perform checks
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
      
    } catch (error: any) {
      console.error(error);
      toast.error('Error: ' + error.message);
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
          <a href="#">Forgot password?</a>
          <p>No account? <a href="#">Register</a></p>
        </div>
      </div>
    </div>
  );
}

export default App;