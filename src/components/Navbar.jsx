import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaBars,
  FaChartLine,
  FaDumbbell,
  FaHeart,
  FaHospital,
  FaHome,
  FaRobot,
  FaSignInAlt,
  FaSignOutAlt,
  FaStore,
  FaTachometerAlt,
  FaTimes,
  FaUserCircle,
} from "react-icons/fa";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";
import "./Navbar.css";

function Navbar() {
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  function closeMenu() {
    setMenuOpen(false);
  }

  async function handleLogout() {
    await signOut(auth);
    closeMenu();
    navigate("/");
  }

  return (
    <nav className="navbar">
      <div className="navbar-top">
        <h2>RehabConnect</h2>

        <button
          className="menu-toggle"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>

      <div className={`nav-links ${menuOpen ? "open" : ""}`}>
        <Link to="/" onClick={closeMenu}>
          <FaHome /> Home
        </Link>
        <Link to="/dashboard" onClick={closeMenu}>
          <FaTachometerAlt /> Dashboard
        </Link>
        <Link to="/centres" onClick={closeMenu}>
          <FaHospital /> Centres
        </Link>
        <Link to="/exercises" onClick={closeMenu}>
          <FaDumbbell /> Exercises
        </Link>
        <Link to="/tracker" onClick={closeMenu}>
          <FaChartLine /> Tracker
        </Link>
        <Link to="/marketplace" onClick={closeMenu}>
          <FaStore /> Marketplace
        </Link>
        <Link to="/assistant" onClick={closeMenu}>
          <FaRobot /> AI Assistant
        </Link>
        <Link to="/saved-centres" onClick={closeMenu}>
          <FaHeart /> Saved Centres
        </Link>

        {user ? (
          <>
            <Link className="user-name" to="/profile" onClick={closeMenu}>
              <FaUserCircle /> {user.displayName || user.email}
            </Link>
            <button className="logout-button" onClick={handleLogout}>
              <FaSignOutAlt /> Logout
            </button>
          </>
        ) : (
          <Link className="login-link" to="/login" onClick={closeMenu}>
            <FaSignInAlt /> Login
          </Link>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
