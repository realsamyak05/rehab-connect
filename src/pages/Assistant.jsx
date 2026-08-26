import { useState } from "react";
import { askGroq } from "../groq";
import "./Assistant.css";

function renderInline(text) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function tableCells(line) {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

function MarkdownAnswer({ content }) {
  const lines = content.split("\n");
  const blocks = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line) continue;

    if (/^-{3,}$/.test(line)) {
      blocks.push(<hr key={`rule-${index}`} />);
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const Heading = `h${heading[1].length}`;
      blocks.push(<Heading key={`heading-${index}`}>{renderInline(heading[2])}</Heading>);
      continue;
    }

    if (line.startsWith("|") && /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(lines[index + 1]?.trim())) {
      const headers = tableCells(line);
      index += 2;
      const rows = [];

      while (lines[index]?.trim().startsWith("|")) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      index -= 1;

      blocks.push(
        <div className="assistant-table-wrap" key={`table-${index}`}>
          <table className="assistant-table">
            <thead>
              <tr>{headers.map((header, cellIndex) => <th key={cellIndex}>{renderInline(header)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {headers.map((_, cellIndex) => <td key={cellIndex}>{renderInline(row[cellIndex] ?? "")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (/^[-*]\s+/.test(lines[index]?.trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }
      index -= 1;
      blocks.push(
        <ul key={`list-${index}`}>
          {items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}
        </ul>,
      );
      continue;
    }

    blocks.push(<p key={`paragraph-${index}`}>{renderInline(line)}</p>);
  }

  return <div className="assistant-markdown">{blocks}</div>;
}

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
          <MarkdownAnswer content={answer} />
        </section>
      )}
    </main>
  );
}

export default Assistant;
