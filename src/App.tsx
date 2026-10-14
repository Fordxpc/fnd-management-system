import { useState } from 'react';
import { useAuth } from './auth';
import Dashboard from './Dashboard';
import './App.css';

function App() {
  const [isOwner, setIsOwner] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { user, login, logout } = useAuth();

  const handleLogin = async (e: any) => {
    e.preventDefault();
    try {
      await login(email, password);
    } catch (error: any) {
      alert("Error: " + error.message);
    }
  };

  // If logged in → show the Dashboard
  if (user) {
    return <Dashboard user={user} logout={logout} />;
  }

  // If not logged in → show the login page
  return (
    <div className="login-container">
      <div className="login-box">
        <div className="header">
          <h1>Funadhoo Airport</h1>
          <p>Staff Duty & Leave Management</p>
        </div>

        <div className="role-toggle">
          <button className={isOwner ? 'active' : ''} onClick={() => setIsOwner(true)}>
            Owner / Manager
          </button>
          <button className={!isOwner ? 'active' : ''} onClick={() => setIsOwner(false)}>
            Staff
          </button>
        </div>

        <p className="subtitle">
          {isOwner ? 'Sign in to manage your airport roster' : 'Sign in to view your schedule'}
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
          <button type="submit" className="submit-btn">Sign In</button>
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