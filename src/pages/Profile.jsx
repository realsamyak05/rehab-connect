import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { onAuthStateChanged, updateProfile as updateAuthProfile } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { FaArrowRight, FaPlus, FaWandMagicSparkles } from "react-icons/fa6";
import { auth, db } from "../firebase";
import exercises from "../data/exercises";
import "./Profile.css";

const keywordCategories = [
  { words: ["knee", "leg", "hip", "ankle", "foot", "walk", "walking"], categories: ["Knee", "Hip", "Ankle", "Leg"] },
  { words: ["shoulder", "arm", "elbow"], categories: ["Shoulder", "Arm"] },
  { words: ["back", "spine", "core"], categories: ["Back", "Core"] },
  { words: ["neck", "head"], categories: ["Neck"] },
  { words: ["hand", "wrist", "finger", "thumb"], categories: ["Hand"] },
  { words: ["balance", "fall", "unsteady"], categories: ["Balance", "Seated"] },
];
const minutesFromDuration = (duration) => Number.parseInt(duration, 10) || 5;
function suggestedExercises(problem) {
  const text = problem.toLowerCase();
  const match = keywordCategories.find(({ words }) => words.some((word) => text.includes(word)));
  return exercises.filter((exercise) => (match?.categories || ["Seated", "Balance", "Breathing"]).includes(exercise.category)).slice(0, 3);
}

function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [problem, setProblem] = useState("");
  const navigate = useNavigate();
  const recommendations = useMemo(() => suggestedExercises(problem), [problem]);

  useEffect(() => {
    const stopAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) { setLoading(false); return; }
      setLoading(true);
      try {
        const snapshot = await getDoc(doc(db, "users", currentUser.uid));
        const data = snapshot.exists() ? snapshot.data() : {};
        setName(currentUser.displayName || data.name || "");
        setProblem(data.recoveryGoal || data.problem || "");
      } catch {
        setMessage("Could not load your saved plan details.");
      } finally { setLoading(false); }
    });
    return stopAuth;
  }, []);

  async function saveProblem() {
    if (!user) return;
    setSaving(true);
    try {
      const trimmedName = name.trim();
      if (trimmedName && trimmedName !== user.displayName) await updateAuthProfile(user, { displayName: trimmedName });
      await setDoc(doc(db, "users", user.uid), { name: trimmedName, email: user.email, recoveryGoal: problem.trim(), problem: problem.trim(), updatedAt: serverTimestamp() }, { merge: true });
      setMessage("Your recovery details are saved.");
    } catch { setMessage("Could not save your recovery details. Please try again."); } finally { setSaving(false); }
  }

  async function addToPlan(items) {
    if (!user || !items.length) return;
    setSaving(true);
    try {
      const trackerRef = doc(db, "users", user.uid, "tracker", "main");
      const snapshot = await getDoc(trackerRef);
      const currentTasks = snapshot.exists() ? snapshot.data().tasks || [] : [];
      const additions = items.filter((item) => !currentTasks.some((task) => task.name === item.name));
      await setDoc(trackerRef, { tasks: [...currentTasks, ...additions], updatedAt: serverTimestamp() }, { merge: true });
      setMessage(additions.length ? String(additions.length) + " exercise" + (additions.length === 1 ? "" : "s") + " added to your daily plan." : "Those exercises are already in your daily plan.");
    } catch { setMessage("Could not update your plan. Please try again."); } finally { setSaving(false); }
  }
  function addSuggestedPlan() {
    addToPlan(recommendations.map((exercise) => ({ id: "plan-" + exercise.id + "-" + Date.now(), name: exercise.title, sets: 2, reps: 10, minutes: minutesFromDuration(exercise.duration), completed: false })));
  }
  if (loading) return <main className="profile-page">Loading your plan builder...</main>;
  if (!user) return <main className="profile-page"><h1>Build your recovery plan</h1><p>Log in to get exercise suggestions and save a custom daily plan.</p><Link className="profile-login-link" to="/login">Log in</Link></main>;
  return (
    <main className="profile-page">
      <header className="profile-header"><p className="profile-kicker">RECOVERY PLAN BUILDER</p><h1>Tell us what’s bothering you.</h1><p>We’ll suggest gentle exercises you can review and add to your daily plan.</p></header>
      <section className="intake-card">
        <div className="intake-fields"><label>Your name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label><label>What would you like help with?<textarea value={problem} onChange={(event) => setProblem(event.target.value)} placeholder="e.g. My knee feels stiff after sitting, and I want to walk more comfortably." rows={5} /></label><p className="safety-note">These are general wellness suggestions, not a medical diagnosis. Stop if pain increases, and contact a clinician for new, severe, or worsening symptoms.</p><button className="save-details" onClick={saveProblem} disabled={saving}>{saving ? "Saving..." : "Save recovery details"}</button></div>
        <div className="intake-hint"><FaWandMagicSparkles /><strong>Better details, better fit</strong><span>Include the area, what feels difficult, and what you want to get back to doing.</span></div>
      </section>
      <section className="recommendations">
        <div className="profile-section-heading"><div><p className="profile-kicker">YOUR SUGGESTED START</p><h2>{problem.trim() ? "A gentle plan to try" : "Start with a gentle foundation"}</h2></div><button className="add-plan-button" onClick={addSuggestedPlan} disabled={saving || !recommendations.length}><FaPlus /> Add all to my plan</button></div>
        <div className="suggestion-grid">{recommendations.map((exercise) => <article className="suggestion-card" key={exercise.id}><div><span className="category-label">{exercise.category}</span><h3>{exercise.title}</h3><p>2 sets · 10 reps · {exercise.duration}</p></div><a href={exercise.video} target="_blank" rel="noreferrer">Watch demo <FaArrowRight /></a></article>)}</div>
        <p className="library-note">Want to add more exercises? Browse the <Link to="/exercises">Exercise Library</Link> to watch demos and add them to your daily plan.</p>
      </section>
      {message && <p className="profile-message" role="status">{message} <button onClick={() => navigate("/tracker")}>View daily plan</button></p>}
    </main>
  );
}
export default Profile;
