import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import exercises from "../data/exercises";
import { auth, db } from "../firebase";
import "./Exercises.css";

function Exercises() {
  const [user, setUser] = useState(null);
  const [addedExerciseNames, setAddedExerciseNames] = useState([]);
  const [addingId, setAddingId] = useState(null);
  const [message, setMessage] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const navigate = useNavigate();

  // Build the category list once, sorted, with counts for the filter bar
  const categories = useMemo(() => {
    const counts = exercises.reduce((acc, ex) => {
      acc[ex.category] = (acc[ex.category] || 0) + 1;
      return acc;
    }, {});

    const sorted = Object.keys(counts).sort();
    return [
      { name: "All", count: exercises.length },
      ...sorted.map((name) => ({ name, count: counts[name] })),
    ];
  }, []);

  const visibleExercises = useMemo(() => {
    if (selectedCategory === "All") return exercises;
    return exercises.filter((ex) => ex.category === selectedCategory);
  }, [selectedCategory]);

  useEffect(() => {
    let stopTrackerListener = () => {};

    const stopAuthListener = onAuthStateChanged(auth, (currentUser) => {
      stopTrackerListener();
      setUser(currentUser);

      if (!currentUser) {
        setAddedExerciseNames([]);
        return;
      }

      const trackerRef = doc(db, "users", currentUser.uid, "tracker", "main");

      stopTrackerListener = onSnapshot(trackerRef, (snapshot) => {
        const tasks = snapshot.exists() ? snapshot.data().tasks || [] : [];
        setAddedExerciseNames(tasks.map((task) => task.name));
      });
    });

    return () => {
      stopAuthListener();
      stopTrackerListener();
    };
  }, []);

  async function addToTracker(exercise) {
    if (!user) {
      navigate("/login");
      return;
    }

    setAddingId(exercise.id);
    setMessage("");

    try {
      const trackerRef = doc(db, "users", user.uid, "tracker", "main");
      const trackerSnapshot = await getDoc(trackerRef);
      const currentTasks = trackerSnapshot.exists()
        ? trackerSnapshot.data().tasks || []
        : [];

      if (currentTasks.some((task) => task.name === exercise.title)) {
        setMessage(`${exercise.title} is already in your tracker.`);
        return;
      }

      await setDoc(
        trackerRef,
        {
          tasks: [
            ...currentTasks,
            {
              id: Date.now(),
              name: exercise.title,
              completed: false,
            },
          ],
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      setMessage(`${exercise.title} was added to your tracker.`);
    } catch {
      setMessage("Could not add this exercise. Please try again.");
    } finally {
      setAddingId(null);
    }
  }

  return (
    <main className="exercises-page">
      <h1>Exercise Library</h1>
      <p className="exercise-note">
        Explore {exercises.length} gentle exercises. Stop if pain gets worse or
        you feel unwell, and consult a health professional when needed.
      </p>

      <div className="category-filter">
        {categories.map((cat) => (
          <button
            key={cat.name}
            className={`category-chip ${
              selectedCategory === cat.name ? "active" : ""
            }`}
            onClick={() => setSelectedCategory(cat.name)}
          >
            {cat.name} <span className="chip-count">{cat.count}</span>
          </button>
        ))}
      </div>

      {message && <p className="exercise-message">{message}</p>}

      <div className="exercise-grid">
        {visibleExercises.map((exercise) => {
          const isAdded = addedExerciseNames.includes(exercise.title);

          return (
            <article key={exercise.id} className="exercise-card">
              <h2>{exercise.title}</h2>
              <p>
                <strong>Category:</strong> {exercise.category}
              </p>
              <p>
                <strong>Duration:</strong> {exercise.duration}
              </p>

              <a href={exercise.video} target="_blank" rel="noreferrer">
                Watch Video
              </a>

              <button
                className={`add-tracker-button ${isAdded ? "added" : ""}`}
                onClick={() => addToTracker(exercise)}
                disabled={addingId === exercise.id || isAdded}
              >
                {isAdded
                  ? "✓ Added to Tracker"
                  : addingId === exercise.id
                    ? "Adding..."
                    : "Add to Tracker"}
              </button>
            </article>
          );
        })}
      </div>

      {visibleExercises.length === 0 && (
        <p className="exercise-message">No exercises in this category.</p>
      )}
    </main>
  );
}

export default Exercises;
