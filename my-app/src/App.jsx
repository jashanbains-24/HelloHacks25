import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Profile from './pages/Profile.jsx';

export default function App() {
  return (
    <>
      <style>{`
        html, body, #root {
          height: 100%;
          margin: 0;
          padding: 0;
        }

        #root {
          width: 100%;
          max-width: none;
          text-align: initial;
          box-sizing: border-box;
        }

        body {
          background: #ffffff; 
          color: #000000;     
          padding-top: 64px;   
          font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        }
      `}</style>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </>
  );
}