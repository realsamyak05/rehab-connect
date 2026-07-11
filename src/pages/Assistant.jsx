import { useState } from "react";

function Assistant() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  function handleAsk() {
    const q = question.toLowerCase();

    if (q.includes("knee")) {
      setAnswer(
        "Recommended exercises: knee raises, leg stretches, and walking.",
      );
    } else if (q.includes("lucknow")) {
      setAnswer(
        "Rehabilitation centres available in Lucknow: Sunrise Rehabilitation Centre and Healing Touch.",
      );
    } else if (q.includes("wheelchair")) {
      setAnswer(
        "Affordable wheelchairs are available in the marketplace section.",
      );
    } else if (q.includes("back")) {
      setAnswer("Try back stretches and light mobility exercises.");
    } else {
      setAnswer("Sorry, I don't know the answer yet.");
    }
  }

  return (
    <div style={{ padding: "40px" }}>
      <h1>AI Assistant</h1>

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
          <p>{answer}</p>
        </div>
      )}
    </div>
  );
}

export default Assistant;
