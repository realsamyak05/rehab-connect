import { useState } from "react";
import { askGroq } from "../groq";

function Assistant() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  async function handleAsk() {
    if (question.trim() === "") {
      return;
    }

    setAnswer("Thinking...");

    const response = await askGroq(question);

    setAnswer(response);
  }

  return (
    <div style={{ padding: "40px" }}>
      <h1>RehabConnect AI Assistant 🤖</h1>

      <input
        type="text"
        placeholder="Ask a question..."
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        style={{
          width: "400px",
          padding: "10px",
          marginTop: "20px",
        }}
      />

      <button
        onClick={handleAsk}
        style={{
          marginLeft: "10px",
          padding: "10px 20px",
        }}
      >
        Ask
      </button>

      {answer && (
        <div
          style={{
            marginTop: "30px",
            padding: "20px",
            border: "1px solid #ccc",
            borderRadius: "10px",
          }}
        >
          <h3>Answer:</h3>
          <p
            style={{
              whiteSpace: "pre-line",
              lineHeight: "1.7",
            }}
          >
            {answer}
          </p>
        </div>
      )}
    </div>
  );
}

export default Assistant;
