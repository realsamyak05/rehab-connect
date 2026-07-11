import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaChartLine,
  FaDumbbell,
  FaHeart,
  FaHospital,
  FaHome,
  FaRobot,
  FaSignInAlt,
  FaSignOutAlt,
  FaStore,
  FaUserCircle,
  FaTachometerAlt,
} from "react-icons/fa";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";
import "./Navbar.css";

function Navbar() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return unsubscribe;
  }, []);

  async function handleLogout() {
    await signOut(auth);
    navigate("/");
  }

  return (
    <nav className="navbar">
      <h2>RehabConnect</h2>

      <div className="nav-links">
        <Link to="/">
          <FaHome /> Home
        </Link>
        <Link to="/dashboard">
          <FaTachometerAlt /> Dashboard
        </Link>
        <Link to="/centres">
          <FaHospital /> Centres
        </Link>
        <Link to="/exercises">
          <FaDumbbell /> Exercises
        </Link>
        <Link to="/tracker">
          <FaChartLine /> Tracker
        </Link>
        <Link to="/marketplace">
          <FaStore /> Marketplace
        </Link>
        <Link to="/assistant">
          <FaRobot /> AI Assistant
        </Link>
        <Link to="/saved-centres">
          <FaHeart /> Saved Centres
        </Link>

        {user ? (
          <>
            <span className="user-name">
              <FaUserCircle /> {user.displayName || user.email}
            </span>

            <button className="logout-button" onClick={handleLogout}>
              <FaSignOutAlt /> Logout
            </button>
          </>
        ) : (
          <Link className="login-link" to="/login">
            <FaSignInAlt /> Login
          </Link>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
