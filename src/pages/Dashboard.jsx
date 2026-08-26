import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { FaArrowRight, FaChartLine, FaFire, FaRegCalendarCheck, FaRegSmile } from "react-icons/fa";
import { auth, db } from "../firebase";
import "./Dashboard.css";

const todayKey = () => new Date().toISOString().slice(0, 10);
function calculateStreak(history = []) {
  const completedDays = new Set(history);
  let total = 0;
  const cursor = new Date();
  if (!completedDays.has(todayKey())) cursor.setDate(cursor.getDate() - 1);
  while (completedDays.has(cursor.toISOString().slice(0, 10))) { total += 1; cursor.setDate(cursor.getDate() - 1); }
  return total;
}
function trendLabel(checkIns, field, suffix = "") {
  const values = checkIns.map((item) => Number(item[field])).filter((value) => Number.isFinite(value) && value >= 0);
  if (values.length < 2) return "Log twice to see a trend";
  const change = values[values.length - 1] - values[0];
  if (change === 0) return "No change logged yet";
  return (change > 0 ? "↑ " : "↓ ") + Math.abs(change) + suffix + " since you started";
}
function recoveryTimeline(history = [], checkIns = []) {
  return Array.from({ length: 4 }, (_, index) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (27 - index * 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    const startKey = start.toISOString().slice(0, 10);
    const endKey = end.toISOString().slice(0, 10);
    const inWeek = checkIns.filter((item) => item.date >= startKey && item.date <= endKey);
    const average = (field) => {
      const values = inWeek.map((item) => Number(item[field])).filter((value) => Number.isFinite(value) && value >= 0);
      return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
    };
    return {
      label: `Week ${index + 1}`,
      pain: average("pain"),
      rangeOfMotion: average("rangeOfMotion"),
      strength: average("strength"),
      adherence: Math.round((history.filter((date) => date >= startKey && date <= endKey).length / 7) * 100),
    };
  });
}

function Dashboard() {
  const [user, setUser] = useState(null);
  const [tracker, setTracker] = useState({ tasks: [], history: [], checkIns: [] });
  const [savedCentresCount, setSavedCentresCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let stopTracker = () => {};
    let stopSavedCentres = () => {};
    const stopAuth = onAuthStateChanged(auth, (currentUser) => {
      stopTracker(); stopSavedCentres(); setUser(currentUser); setLoadError("");
      if (!currentUser) { setTracker({ tasks: [], history: [], checkIns: [] }); setSavedCentresCount(0); setLoading(false); return; }
      setLoading(true);
      let trackerReady = false; let centresReady = false;
      const finishLoading = () => { if (trackerReady && centresReady) setLoading(false); };
      const handleError = () => { setLoadError("We could not load your recovery data. Please try again."); setLoading(false); };
      stopTracker = onSnapshot(doc(db, "users", currentUser.uid, "tracker", "main"), (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() : {};
        setTracker({ tasks: data.tasks || [], history: data.history || [], checkIns: data.checkIns || [] });
        trackerReady = true; finishLoading();
      }, handleError);
      stopSavedCentres = onSnapshot(collection(db, "users", currentUser.uid, "savedCentres"), (snapshot) => {
        setSavedCentresCount(snapshot.size); centresReady = true; finishLoading();
      }, handleError);
    });
    return () => { stopAuth(); stopTracker(); stopSavedCentres(); };
  }, []);

  const dailyStats = useMemo(() => {
    const completed = tracker.tasks.filter((task) => task.completedDate === todayKey()).length;
    const totalMinutes = tracker.tasks.reduce((sum, task) => sum + Number(task.minutes || 5), 0);
    return { completed, total: tracker.tasks.length, totalMinutes, progress: tracker.tasks.length ? Math.round((completed / tracker.tasks.length) * 100) : 0 };
  }, [tracker.tasks]);
  const streak = calculateStreak(tracker.history);
  const timeline = useMemo(
    () => recoveryTimeline(tracker.history, tracker.checkIns),
    [tracker.checkIns, tracker.history],
  );
  const name = user?.displayName || user?.email?.split("@")[0] || "there";
  const latestCheckIn = tracker.checkIns.at(-1);
  const tomorrowText = latestCheckIn?.pain >= 7 || latestCheckIn?.difficulty === "Too hard"
    ? "Tomorrow, keep it gentle: reduce reps and move within a comfortable range."
    : "Tomorrow’s plan is ready with the same steady, manageable routine.";

  if (loading) return <main className="dashboard-page">Loading your recovery dashboard...</main>;
  if (!user) return <main className="dashboard-page"><h1>Your recovery, one day at a time.</h1><p>Log in to see your daily plan, progress, and milestones.</p><Link className="dashboard-button" to="/login">Log in</Link></main>;
  if (loadError) return <main className="dashboard-page"><h1>Today’s Recovery</h1><p role="alert">{loadError}</p><Link className="dashboard-button" to="/tracker">Open tracker</Link></main>;

  return (
    <main className="dashboard-page">
      <header className="recovery-header"><div><p className="dashboard-kicker">TODAY’S RECOVERY</p><h1>Good to see you, {name}.</h1><p>Your next small step is waiting. A little consistency goes a long way.</p></div><div className="dashboard-streak"><FaFire /><strong>{streak}</strong><span>day streak</span></div></header>
      <section className="today-card">
        <div className="today-card-heading"><div><p className="dashboard-kicker">YOUR DAILY PLAN</p><h2>{dailyStats.total ? "Let’s keep the momentum going." : "Build your first daily plan."}</h2><span>{dailyStats.total ? dailyStats.total + " exercises · ~" + dailyStats.totalMinutes + " min" : "Choose exercises that match your recovery goal."}</span></div><Link to={dailyStats.total ? "/tracker" : "/profile"} className="start-plan-button">{dailyStats.total ? (dailyStats.progress === 100 ? "Review today" : "Continue plan") : "Build a plan"} <FaArrowRight /></Link></div>
        <div className="dashboard-progress"><div className="dashboard-progress-track"><div style={{ width: dailyStats.progress + "%" }} /></div><strong>{dailyStats.progress}%</strong><span>{dailyStats.completed} of {dailyStats.total} complete</span></div>
      </section>
      <section className="recovery-metrics">
        <article><div className="metric-icon pain"><FaRegSmile /></div><p>Pain trend</p><strong>{trendLabel(tracker.checkIns, "pain", "/10")}</strong><span>Based on your check-ins</span></article>
        <article><div className="metric-icon range"><FaChartLine /></div><p>Range of motion</p><strong>{trendLabel(tracker.checkIns, "rangeOfMotion", "°")}</strong><span>Optional ROM measurements</span></article>
        <article><div className="metric-icon sessions"><FaRegCalendarCheck /></div><p>Completed sessions</p><strong>{tracker.history.length}</strong><span>Days you completed your plan</span></article>
      </section>
      <section className="timeline-card">
        <div className="timeline-heading"><div><p className="dashboard-kicker">YOUR RECOVERY TIMELINE</p><h2>Progress you can look back on.</h2><p>Each week uses your completed sessions and symptom check-ins.</p></div><Link to="/tracker">Log today’s progress <FaArrowRight /></Link></div>
        <div className="timeline-scroll"><div className="timeline-grid">
          <div className="timeline-labels"><strong>Measure</strong><span>Pain</span><span>Range of motion</span><span>Strength</span><span>Adherence</span></div>
          {timeline.map((week) => <article key={week.label} className="timeline-week"><strong>{week.label}</strong><span>{week.pain === null ? "—" : week.pain + "/10"}</span><span>{week.rangeOfMotion === null ? "—" : week.rangeOfMotion + "°"}</span><span>{week.strength === null ? "—" : week.strength + "%"}</span><span className="adherence-value">{week.adherence}%</span></article>)}
        </div></div>
        <p className="timeline-note">Add range of motion and strength only when they are measures you and your clinician are already tracking.</p>
      </section>
      <section className="dashboard-lower">
        <article className="tomorrow-card"><p className="dashboard-kicker">LOOKING AHEAD</p><h2>Tomorrow’s plan</h2><p>{tomorrowText}</p><Link to="/tracker">View tomorrow’s routine <FaArrowRight /></Link></article>
        <article className="quick-checkin"><p className="dashboard-kicker">KEEP YOUR PLAN PERSONAL</p><h2>How are you feeling?</h2><p>Log pain, difficulty, and range of motion after your session so tomorrow’s guidance can adapt.</p><Link to="/tracker">Log symptoms <FaArrowRight /></Link></article>
      </section>
      {savedCentresCount > 0 && <p className="saved-centres-note">You have {savedCentresCount} saved care centre{savedCentresCount === 1 ? "" : "s"} for support when you need it.</p>}
    </main>
  );
}
export default Dashboard;
