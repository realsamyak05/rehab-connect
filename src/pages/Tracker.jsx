import { useState } from "react";

function Tracker() {
  const [tasks, setTasks] = useState([
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
  ]);

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
    <div style={{ padding: "40px" }}>
      <h1>Progress Tracker</h1>

      <h2>
        Completed: {completedCount} / {tasks.length}
      </h2>

      {tasks.map((task) => (
        <div
          key={task.id}
          style={{
            marginTop: "20px",
            padding: "15px",
            border: "1px solid #ccc",
            borderRadius: "10px",
          }}
        >
          <h3>{task.name}</h3>

          <label>
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => toggleTask(task.id)}
            />
            Completed
          </label>
        </div>
      ))}
    </div>
  );
}

export default Tracker;
