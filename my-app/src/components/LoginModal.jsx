import { useState } from 'react';
import { FAKE_PROFILES } from '../data/profile.js';
import './LoginModal.css';

export default function LoginModal({ isOpen, onClose, onLoginSuccess }) {
  const [emailOrUser, setEmailOrUser] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null; 

  const handleSubmit = (e) => {
    e.preventDefault();

    const user = FAKE_PROFILES.find(
      (p) =>
        (p.account.username === emailOrUser.trim() ||
          p.email === emailOrUser.trim()) &&
        p.account.password === password.trim()
    );

    if (user) {
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('activeUser', JSON.stringify(user));
      setError('');
      onLoginSuccess();
      onClose();
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()} 
      >
        <h2>Login</h2>

        {error && <p className="error">{error}</p>}

        <form onSubmit={handleSubmit}>
          <label htmlFor="login-username">Username or Email</label>
          <input
            id="login-username"
            type="text"
            placeholder="Enter username or email"
            value={emailOrUser}
            onChange={(e) => setEmailOrUser(e.target.value)}
            required
          />

          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit">Sign In</button>
        </form>
      </div>
    </div>
  );
}
