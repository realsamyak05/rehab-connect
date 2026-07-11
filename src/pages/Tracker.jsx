import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import "./Tracker.css";

const DEFAULT_TASKS = [
  { id: 1, name: "Arm Stretch", completed: false },
  { id: 2, name: "Leg Exercise", completed: false },
];

function Tracker() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState(DEFAULT_TASKS);
  const [newExercise, setNewExercise] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stopTrackerListener = () => {};

    const stopAuthListener = onAuthStateChanged(auth, (currentUser) => {
      stopTrackerListener();
      setUser(currentUser);

      if (!currentUser) {
        setTasks(DEFAULT_TASKS);
        setLoading(false);
        return;
      }

      setLoading(true);

      const trackerRef = doc(db, "users", currentUser.uid, "tracker", "main");

      stopTrackerListener = onSnapshot(trackerRef, (snapshot) => {
        if (snapshot.exists()) {
          setTasks(snapshot.data().tasks || DEFAULT_TASKS);
        } else {
          setDoc(trackerRef, {
            tasks: DEFAULT_TASKS,
            updatedAt: serverTimestamp(),
          });
        }

        setLoading(false);
      });
    });

    return () => {
      stopAuthListener();
      stopTrackerListener();
    };
  }, []);

  async function saveTasks(updatedTasks) {
    setTasks(updatedTasks);

    if (!user) return;

    const trackerRef = doc(db, "users", user.uid, "tracker", "main");

    await setDoc(
      trackerRef,
      {
        tasks: updatedTasks,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  function addTask() {
    const name = newExercise.trim();

    if (!name) return;

    saveTasks([
      ...tasks,
      {
        id: Date.now(),
        name,
        completed: false,
      },
    ]);

    setNewExercise("");
  }

  function toggleTask(id) {
    saveTasks(
      tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task,
      ),
    );
  }

  function deleteTask(id) {
    saveTasks(tasks.filter((task) => task.id !== id));
  }

  const completedCount = tasks.filter((task) => task.completed).length;
  const progress = tasks.length ? (completedCount / tasks.length) * 100 : 0;

  if (loading) {
    return <main className="tracker-page">Loading your tracker...</main>;
  }

  return (
    <main className="tracker-page">
      <h1 className="tracker-title">Progress Tracker</h1>

      <p>
        {user
          ? `Your progress is saved to ${user.email}.`
          : "Guest mode: your progress will reset when you refresh. Log in to save it."}
      </p>

      <h2>
        Completed: {completedCount} / {tasks.length}
      </h2>

      <div className="progress-container">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="input-section">
        <input
          type="text"
          placeholder="Enter exercise name..."
          value={newExercise}
          onChange={(event) => setNewExercise(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") addTask();
          }}
        />

        <button onClick={addTask}>Add Exercise</button>
      </div>

      {tasks.map((task) => (
        <div key={task.id} className="task-card">
          <h3>{task.name}</h3>

          <div className="task-actions">
            <label>
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => toggleTask(task.id)}
              />
              Completed
            </label>

            <button className="delete-btn" onClick={() => deleteTask(task.id)}>
              Delete
            </button>
          </div>
        </div>
      ))}
    </main>
  );
}

export default Tracker;
