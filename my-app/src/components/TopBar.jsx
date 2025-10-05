import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import LoginModal from './LoginModal.jsx';
import profilePic from '../assets/Group 2.png'; // 👈 adjust the path if needed

export default function TopBar() {
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('isLoggedIn') === 'true');

  const handleProfileClick = () => {
    if (!isLoggedIn) {
      setShowLogin(true);
    } else {
      navigate('/profile');
    }
  };

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    setShowLogin(false);
  };

  return (
    <>
      <header className="topbar" role="banner">
        <div className="brand">
          <Link to="/" className="brand-name no-link" aria-label="Go to homepage">
            CareerCompass
          </Link>
        </div>

        {/* Profile Image Button */}
        <button
          className="profile-btn"
          aria-label="Open profile"
          title="Profile"
          onClick={handleProfileClick}
        >
          <img src={profilePic} alt="Profile" className="profile-img" />
        </button>

        <style>{`
          .topbar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 1000;
            display: flex;
            justify-content: space-between;
            align-items: center;
            height: 64px;
            padding: 0 16px;
            background: rgba(210, 169, 253, 1.0);
            border-bottom: 1px solid rgba(255,255,255,0.12);
          }
          .brand-name {
            font-weight: 700;
            font-size: 1.1rem;
            color: #60a5fa;
          }
          .no-link {
            color: inherit;
            text-decoration: none;
            cursor: pointer;
          }
          .no-link:hover,
          .no-link:focus {
            opacity: 0.9;
          }
          .profile-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: transparent;
            border: 1px solid rgba(255,255,255,0.2);
            cursor: pointer;
            overflow: hidden;
            padding: 0;
          }
          .profile-btn:hover {
            border-color: rgba(255,255,255,0.4);
          }
          .profile-btn:focus-visible {
            outline: 2px solid white;
            outline-offset: 2px;
          }
          .profile-img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
        `}</style>
      </header>

      <LoginModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </>
  );
}
