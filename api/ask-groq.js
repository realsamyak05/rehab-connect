import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function getAdminAuth() {
  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }

  return getAuth();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const authorization = req.headers.authorization || "";
  const idToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;

  if (!idToken) {
    return res.status(401).json({ error: "Please log in first." });
  }

  const { question } =
    typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

  if (!question || typeof question !== "string") {
    return res.status(400).json({ error: "A question is required." });
  }

  try {
    await getAdminAuth().verifyIdToken(idToken);

    const groqResponse = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful AI assistant for a rehabilitation support application.",
            },
            { role: "user", content: question.slice(0, 4000) },
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      },
    );

    const data = await groqResponse.json();

    if (!groqResponse.ok) {
      console.error("Groq error:", data);
      return res.status(groqResponse.status).json({
        error: data.error?.message || "Groq could not answer right now.",
      });
    }

    return res.status(200).json({
      answer: data.choices?.[0]?.message?.content || "No answer received.",
    });
  } catch (error) {
    console.error("ask-groq error:", error);
    return res.status(500).json({ error: "Something went wrong." });
  }
}
