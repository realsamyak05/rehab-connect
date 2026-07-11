import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import "./Dashboard.css";

function Dashboard() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [savedCentresCount, setSavedCentresCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stopTracker = () => {};
    let stopSavedCentres = () => {};

    const stopAuth = onAuthStateChanged(auth, (currentUser) => {
      stopTracker();
      stopSavedCentres();
      setUser(currentUser);

      if (!currentUser) {
        setTasks([]);
        setSavedCentresCount(0);
        setLoading(false);
        return;
      }

      let trackerReady = false;
      let centresReady = false;

      function finishLoading() {
        if (trackerReady && centresReady) {
          setLoading(false);
        }
      }

      stopTracker = onSnapshot(
        doc(db, "users", currentUser.uid, "tracker", "main"),
        (snapshot) => {
          setTasks(snapshot.exists() ? snapshot.data().tasks || [] : []);
          trackerReady = true;
          finishLoading();
        },
      );

      stopSavedCentres = onSnapshot(
        collection(db, "users", currentUser.uid, "savedCentres"),
        (snapshot) => {
          setSavedCentresCount(snapshot.size);
          centresReady = true;
          finishLoading();
        },
      );
    });

    return () => {
      stopAuth();
      stopTracker();
      stopSavedCentres();
    };
  }, []);

  if (loading) {
    return <main className="dashboard-page">Loading dashboard...</main>;
  }

  if (!user) {
    return (
      <main className="dashboard-page">
        <h1>My Dashboard</h1>
        <p>Log in to view your recovery progress.</p>
        <Link className="dashboard-button" to="/login">
          Log in
        </Link>
      </main>
    );
  }

  const completedCount = tasks.filter((task) => task.completed).length;
  const name = user.displayName || user.email.split("@")[0];

  return (
    <main className="dashboard-page">
      <h1>Welcome back, {name}!</h1>
      <p className="dashboard-subtitle">
        Here is an overview of your RehabConnect activity.
      </p>

      <section className="dashboard-stats">
        <article className="dashboard-stat-card">
          <h2>
            {completedCount} / {tasks.length}
          </h2>
          <p>Exercises completed</p>
        </article>

        <article className="dashboard-stat-card">
          <h2>{savedCentresCount}</h2>
          <p>Saved centres</p>
        </article>

        <article className="dashboard-stat-card">
          <h2>{tasks.length}</h2>
          <p>Exercises in tracker</p>
        </article>
      </section>

      <section className="dashboard-actions">
        <Link to="/tracker" className="dashboard-button">
          Continue Tracker
        </Link>

        <Link to="/exercises" className="dashboard-button">
          Explore Exercises
        </Link>

        <Link to="/saved-centres" className="dashboard-button">
          View Saved Centres
        </Link>
      </section>
    </main>
  );
}

export default Dashboard;
