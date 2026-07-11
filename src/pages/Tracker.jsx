import { useEffect, useState } from "react";
import "./Tracker.css";

function Tracker() {
  const [newExercise, setNewExercise] = useState("");
  const [tasks, setTasks] = useState(() => {
    const savedTasks = localStorage.getItem("rehabTasks");

    if (savedTasks) {
      return JSON.parse(savedTasks);
    }

    return [
      {
        id: 1,
        name: "Arm Stretch",
        completed: false,
      },
      {
        id: 2,
        name: "Leg Exercise",
        completed: true,
      },
    ];
  });
  useEffect(() => {
    localStorage.setItem("rehabTasks", JSON.stringify(tasks));
  }, [tasks]);

  function addTask() {
    if (newExercise.trim() === "") {
      return;
    }

    const task = {
      id: Date.now(),
      name: newExercise,
      completed: false,
    };

    setTasks([...tasks, task]);
    setNewExercise("");
  }

  function toggleTask(id) {
    const updatedTasks = tasks.map((task) => {
      if (task.id === id) {
        return {
          ...task,
          completed: !task.completed,
        };
      }

      return task;
    });

    setTasks(updatedTasks);
  }

  const completedCount = tasks.filter((task) => task.completed).length;

  return (
    <div className="tracker-page">
      <h1 className="tracker-title">Progress Tracker</h1>

      <h2>
        Completed: {completedCount} / {tasks.length}
      </h2>

      <div className="progress-container">
        <div
          className="progress-fill"
          style={{
            width: `${
              tasks.length === 0 ? 0 : (completedCount / tasks.length) * 100
            }%`,
          }}
        />
      </div>

      <div className="input-section">
        <input
          type="text"
          placeholder="Enter exercise name..."
          value={newExercise}
          onChange={(e) => setNewExercise(e.target.value)}
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

            <button
              className="delete-btn"
              onClick={() => setTasks(tasks.filter((t) => t.id !== task.id))}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default Tracker;
