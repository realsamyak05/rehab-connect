import { Link } from "react-router-dom";
import "./Navbar.css";

function Navbar() {
  return (
    <nav className="navbar">
      <h2>RehabConnect</h2>

      <div className="nav-links">
        <Link to="/">Home</Link>
        <Link to="/centres">Centres</Link>
        <Link to="/exercises">Exercises</Link>
        <Link to="/tracker">Tracker</Link>
        <Link to="/marketplace">Marketplace</Link>
        <Link to="/assistant">AI Assistant</Link>
      </div>
    </nav>
  );
}

export default Navbar;
