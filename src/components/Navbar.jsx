import { Link } from "react-router-dom";

import {
  FaHome,
  FaHospital,
  FaDumbbell,
  FaChartLine,
  FaStore,
  FaRobot,
} from "react-icons/fa";
import "./Navbar.css";

function Navbar() {
  return (
    <nav className="navbar">
      <h2>RehabConnect</h2>

      <div className="nav-links">
        <Link to="/">
          <FaHome /> Home
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
      </div>
    </nav>
  );
}

export default Navbar;
