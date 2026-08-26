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
  const [loadError, setLoadError] = useState("");
  const [retryAttempt, setRetryAttempt] = useState(0);

  useEffect(() => {
    let stopTracker = () => {};
    let stopSavedCentres = () => {};
    setLoading(true);
    setLoadError("");

    const stopAuth = onAuthStateChanged(auth, (currentUser) => {
      stopTracker();
      stopSavedCentres();
      setUser(currentUser);
      setLoadError("");

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

      function handleFirestoreError(error) {
        console.error("Dashboard Firestore error:", error);
        setLoadError(
          "We could not load your dashboard data. Check your internet connection and try again.",
        );
        setLoading(false);
      }

      stopTracker = onSnapshot(
        doc(db, "users", currentUser.uid, "tracker", "main"),
        (snapshot) => {
          setTasks(snapshot.exists() ? snapshot.data().tasks || [] : []);
          trackerReady = true;
          finishLoading();
        },
        handleFirestoreError,
      );

      stopSavedCentres = onSnapshot(
        collection(db, "users", currentUser.uid, "savedCentres"),
        (snapshot) => {
          setSavedCentresCount(snapshot.size);
          centresReady = true;
          finishLoading();
        },
        handleFirestoreError,
      );
    });

    return () => {
      stopAuth();
      stopTracker();
      stopSavedCentres();
    };
  }, [retryAttempt]);

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

  if (loadError) {
    return (
      <main className="dashboard-page">
        <h1>My Dashboard</h1>
        <p role="alert">{loadError}</p>
        <button
          className="dashboard-button"
          onClick={() => setRetryAttempt((attempt) => attempt + 1)}
        >
          Try again
        </button>
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
