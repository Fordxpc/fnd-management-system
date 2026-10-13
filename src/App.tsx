import { useState } from 'react';
import './App.css';

function App() {
  const [isOwner, setIsOwner] = useState(true);

  return (
    <div className="login-container">
      <div className="login-box">
        
        {/* Header */}
        <div className="header">
          <h1>Funadhoo Airport</h1>
          <p>Staff Duty & Leave Management</p>
        </div>

        {/* Role Toggle */}
        <div className="role-toggle">
          <button 
            className={isOwner ? 'active' : ''}
            onClick={() => setIsOwner(true)}
          >
            Owner / Manager
          </button>
          <button 
            className={!isOwner ? 'active' : ''}
            onClick={() => setIsOwner(false)}
          >
            Staff
          </button>
        </div>

        {/* Sign In Form */}
        <p className="subtitle">
          {isOwner ? 'Sign in to manage your airport roster' : 'Sign in to view your schedule'}
        </p>

        <form className="login-form" onSubmit={(e) => e.preventDefault()}>
          <div className="input-group">
            <label>Email</label>
            <input type="email" placeholder="name@funadhooairport.com" />
          </div>
          <div className="input-group">
            <label>Password</label>
            <input type="password" placeholder="Your password" />
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