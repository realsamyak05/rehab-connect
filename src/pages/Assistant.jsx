import { useState } from "react";
import { askGroq } from "../groq";
import "./Assistant.css";

function Assistant() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  async function handleAsk(event) {
    event.preventDefault();

    if (!question.trim()) return;

    setAnswer("Thinking...");
    setAnswer(await askGroq(question));
  }

  return (
    <main className="assistant-page">
      <h1>RehabConnect AI Assistant 🤖</h1>

      <form className="assistant-form" onSubmit={handleAsk}>
        <input
          className="assistant-input"
          type="text"
          placeholder="Ask a question..."
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <button className="assistant-button" type="submit">
          Ask
        </button>
      </form>

      {answer && (
        <section className="assistant-answer" aria-live="polite">
          <h3>Answer:</h3>
          <p>{answer}</p>
        </section>
      )}
    </main>
  );
}

export default Assistant;
