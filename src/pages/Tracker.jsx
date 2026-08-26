import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { FaBell, FaCheck, FaChevronDown, FaFire, FaPlayCircle, FaTrophy } from "react-icons/fa";
import { auth, db } from "../firebase";
import exercises from "../data/exercises";
import "./Tracker.css";

const todayKey = () => new Date().toISOString().slice(0, 10);
const DEFAULT_TASKS = [
  { id: 1, name: "Arm Stretch", sets: 2, reps: 10, minutes: 5 },
  { id: 2, name: "Leg Exercise", sets: 2, reps: 10, minutes: 8 },
];
const taskForToday = (task) => ({ ...task, completed: task.completedDate === todayKey(), sets: task.sets || 2, reps: task.reps || 10, minutes: task.minutes || 5 });

function streakFromHistory(history = []) {
  const done = new Set(history);
  let streak = 0;
  const cursor = new Date();
  if (!done.has(todayKey())) cursor.setDate(cursor.getDate() - 1);
  while (done.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function Tracker() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState(DEFAULT_TASKS);
  const [history, setHistory] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [reminderTime, setReminderTime] = useState("18:00");
  const [newExercise, setNewExercise] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [checkIn, setCheckIn] = useState({ pain: 0, difficulty: "Just right", rangeOfMotion: "", note: "" });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let stopTrackerListener = () => {};
    const stopAuthListener = onAuthStateChanged(auth, (currentUser) => {
      stopTrackerListener();
      setUser(currentUser);
      if (!currentUser) {
        setTasks(DEFAULT_TASKS.map(taskForToday));
        setHistory([]);
        setCheckIns([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const trackerRef = doc(db, "users", currentUser.uid, "tracker", "main");
      stopTrackerListener = onSnapshot(trackerRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setTasks((data.tasks || DEFAULT_TASKS).map(taskForToday));
          setHistory(data.history || []);
          setCheckIns(data.checkIns || []);
          setReminderTime(data.reminderTime || "18:00");
        } else {
          const initial = DEFAULT_TASKS.map(taskForToday);
          setTasks(initial);
          setDoc(trackerRef, { tasks: initial, history: [], reminderTime: "18:00", updatedAt: serverTimestamp() });
        }
        setLoading(false);
      });
    });
    return () => { stopAuthListener(); stopTrackerListener(); };
  }, []);

  async function save(updatedTasks, updates = {}) {
    setTasks(updatedTasks);
    if (!user) return;
    await setDoc(doc(db, "users", user.uid, "tracker", "main"), {
      tasks: updatedTasks, ...updates, updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  const completedCount = tasks.filter((task) => task.completed).length;
  const progress = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
  const streak = streakFromHistory(history);
  const planMinutes = tasks.filter((task) => !task.completed).reduce((sum, task) => sum + Number(task.minutes || 0), 0);
  const guidance = checkIn.pain >= 7
    ? "Pause today’s plan and contact your clinician if pain is new, severe, or worsening."
    : checkIn.pain >= 4 || checkIn.difficulty === "Too hard"
      ? "Let’s scale back: fewer reps, slower pace, and keep movements comfortable."
      : "Your plan is on track. Move slowly and stop if pain gets worse.";

  useEffect(() => {
    if (!user || !reminderTime || !("Notification" in window) || Notification.permission !== "granted") return undefined;
    const now = new Date();
    const [hours, minutes] = reminderTime.split(":").map(Number);
    const reminder = new Date();
    reminder.setHours(hours, minutes, 0, 0);
    const delay = reminder - now;
    if (delay < 0 || delay > 60 * 1000 || completedCount === tasks.length) return undefined;
    const timer = window.setTimeout(() => new Notification("Your Rehab Connect plan is ready", { body: `${tasks.length - completedCount} exercise${tasks.length - completedCount === 1 ? "" : "s"} left for today.` }), delay);
    return () => window.clearTimeout(timer);
  }, [user, reminderTime, completedCount, tasks.length]);

  async function enableReminder() {
    if (!("Notification" in window)) { setMessage("Browser reminders are not available on this device."); return; }
    const permission = await Notification.requestPermission();
    setMessage(permission === "granted" ? `Daily reminder set for ${reminderTime}.` : "Allow notifications in your browser to receive reminders.");
  }
  function addTask() {
    const name = newExercise.trim();
    if (!name) return;
    if (tasks.some((task) => task.name.toLowerCase() === name.toLowerCase())) { setMessage(`“${name}” is already in today’s plan.`); return; }
    save([...tasks, { id: Date.now(), name, sets: 2, reps: 10, minutes: 5, completed: false }]);
    setNewExercise("");
  }
  function updateTask(id, changes) { save(tasks.map((task) => task.id === id ? { ...task, ...changes } : task)); }
  function toggleTask(task) {
    const isCompleting = !task.completed;
    const updated = tasks.map((item) => item.id === task.id ? { ...item, completed: isCompleting, completedDate: isCompleting ? todayKey() : null } : item);
    const allDone = updated.length > 0 && updated.every((item) => item.completed);
    const updatedHistory = allDone ? [...new Set([...history, todayKey()])].slice(-90) : history.filter((date) => date !== todayKey());
    setHistory(updatedHistory);
    save(updated, { history: updatedHistory });
    if (allDone) setMessage("Today’s plan is complete — fantastic follow-through!");
  }
  function deleteTask(id) { save(tasks.filter((task) => task.id !== id)); }
  async function saveCheckIn() {
    const entry = { ...checkIn, date: todayKey() };
    const updatedCheckIns = [...checkIns, entry].slice(-30);
    setCheckIns(updatedCheckIns);
    if (user) {
      await setDoc(doc(db, "users", user.uid, "tracker", "main"), {
        checkIns: updatedCheckIns,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
    setMessage("Check-in saved. We’ll use this to guide your next session.");
  }
  const sortedTasks = useMemo(() => [...tasks].sort((a, b) => Number(a.completed) - Number(b.completed)), [tasks]);
  const milestones = [3, 7, 14].filter((goal) => streak >= goal);
  const missedThreeSessions = history.length > 0 && [1, 2, 3].every((daysAgo) => {
    const day = new Date();
    day.setDate(day.getDate() - daysAgo);
    return !history.includes(day.toISOString().slice(0, 10));
  });

  if (loading) return <main className="tracker-page">Loading your plan...</main>;
  return (
    <main className="tracker-page">
      <header className="plan-header">
        <div><p className="eyebrow">YOUR PERSONAL PLAN · {new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }).toUpperCase()}</p><h1>Small steps. Real recovery.</h1><p>{planMinutes ? `${planMinutes} minutes left in your guided plan.` : "Your movement for today is complete."}</p></div>
        <div className="streak-card"><FaFire /><strong>{streak}</strong><span>day streak</span></div>
      </header>
      {!user && <div className="guest-banner">Guest mode: sign in to save your plan, streaks, and check-ins across devices.</div>}
      {missedThreeSessions && tasks.length > 0 && <div className="nudge"><FaBell /> You missed 3 sessions. Start with just one exercise today — consistency beats intensity.</div>}
      <section className="plan-overview">
        <div className="plan-progress"><div><strong>Today’s progress</strong><span>{completedCount} of {tasks.length} exercises</span></div><div className="progress-row"><div className="progress-container"><div className="progress-fill" style={{ width: `${progress}%` }} /></div><b>{progress}%</b></div></div>
        <div className="milestones"><FaTrophy /><div><strong>Milestones</strong><span>{milestones.length ? `${milestones.join(", ")}-day milestone${milestones.length > 1 ? "s" : ""} unlocked` : "Complete 3 days to unlock your first milestone"}</span></div></div>
      </section>
      <section className="reminder-bar"><FaBell /><span>Daily reminder</span><input type="time" value={reminderTime} onChange={(event) => { setReminderTime(event.target.value); if (user) setDoc(doc(db, "users", user.uid, "tracker", "main"), { reminderTime: event.target.value }, { merge: true }); }} /><button onClick={enableReminder}>Enable reminders</button></section>
      <section className="daily-plan"><div className="section-heading"><div><p className="eyebrow">DAILY PLAN</p><h2>Follow your routine</h2></div><span>{tasks.length} exercises · {tasks.reduce((sum, task) => sum + Number(task.minutes || 0), 0)} min</span></div>
        {sortedTasks.map((task) => {
          const libraryItem = exercises.find((exercise) => exercise.title === task.name);
          const expanded = expandedId === task.id;
          return <article className={`plan-exercise ${task.completed ? "done" : ""}`} key={task.id}>
            <button className="complete-button" onClick={() => toggleTask(task)} aria-label={`Mark ${task.name} complete`}>{task.completed && <FaCheck />}</button>
            <div className="exercise-main"><div className="exercise-title"><h3>{task.name}</h3><span>{task.sets} sets · {task.reps} reps · {task.minutes} min</span></div><div className="exercise-actions">{libraryItem && <a href={libraryItem.video} target="_blank" rel="noreferrer"><FaPlayCircle /> Demo</a>}<button onClick={() => setExpandedId(expanded ? null : task.id)}>Adjust <FaChevronDown /></button></div>
              {expanded && <div className="exercise-details"><label>Sets<input type="number" min="1" max="10" value={task.sets} onChange={(event) => updateTask(task.id, { sets: Number(event.target.value) })} /></label><label>Reps<input type="number" min="1" max="50" value={task.reps} onChange={(event) => updateTask(task.id, { reps: Number(event.target.value) })} /></label><label>Minutes<input type="number" min="1" max="90" value={task.minutes} onChange={(event) => updateTask(task.id, { minutes: Number(event.target.value) })} /></label><button className="remove-exercise" onClick={() => deleteTask(task.id)}>Remove</button></div>}</div>
          </article>;
        })}
        <div className="add-exercise"><input value={newExercise} onChange={(event) => setNewExercise(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addTask()} placeholder="Add an exercise to today’s plan" /><button onClick={addTask}>Add exercise</button></div>
      </section>
      <section className="check-in"><div><p className="eyebrow">AFTER YOUR SESSION</p><h2>How did that feel?</h2><p>Share a quick check-in so your plan can meet you where you are.</p></div><div className="checkin-controls"><label>Pain level <span>{checkIn.pain}/10</span><input type="range" min="0" max="10" value={checkIn.pain} onChange={(event) => setCheckIn({ ...checkIn, pain: Number(event.target.value) })} /></label><label>Difficulty<select value={checkIn.difficulty} onChange={(event) => setCheckIn({ ...checkIn, difficulty: event.target.value })}><option>Too easy</option><option>Just right</option><option>Too hard</option></select></label><label>Range of motion (optional)<input type="number" min="0" max="360" placeholder="e.g. 95°" value={checkIn.rangeOfMotion} onChange={(event) => setCheckIn({ ...checkIn, rangeOfMotion: event.target.value })} /></label><textarea placeholder="Anything you noticed? (optional)" value={checkIn.note} onChange={(event) => setCheckIn({ ...checkIn, note: event.target.value })} /><button onClick={saveCheckIn}>Save check-in</button></div><p className={`guidance ${checkIn.pain >= 7 ? "urgent" : ""}`}>{guidance}</p></section>
      {message && <div className="tracker-message" role="status">{message}</div>}
    </main>
  );
}
export default Tracker;
