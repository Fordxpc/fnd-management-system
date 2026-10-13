import { useState } from 'react';
import { useAuth } from './AuthContext';
import './App.css';

function App() {
  const [isOwner, setIsOwner] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { user, login, logout } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      alert("Successfully logged in!");
    } catch (error: any) {
      alert("Error: " + error.message);
    }
  };

  // If user is logged in, show a temporary dashboard
  if (user) {
    return (
      <div className="login-container">
        <div className="login-box" style={{ textAlign: 'center' }}>
          <h1>Welcome!</h1>
          <p>You are logged in as: <strong>{user.email}</strong></p>
          <button onClick={logout} className="submit-btn" style={{ marginTop: '20px' }}>
            Log Out
          </button>
        </div>
      </div>
    );
  }

  // If not logged in, show the login form
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