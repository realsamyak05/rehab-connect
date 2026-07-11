import exercises from "../data/exercises";
import "./Exercises.css";

function Exercises() {
  return (
    <div className="exercises-page">
      <h1>Exercise Library</h1>

      <div className="exercise-grid">
        {exercises.map((exercise) => (
          <div key={exercise.id} className="exercise-card">
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
          </div>
        ))}
      </div>
    </div>
  );
}

export default Exercises;
