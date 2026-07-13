import { auth } from "./firebase";

export async function askGroq(question) {
  const user = auth.currentUser;

  if (!user) {
    return "Please log in to use the AI Assistant.";
  }

  try {
    const idToken = await user.getIdToken();

    const response = await fetch("/api/ask-groq", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ question }),
    });

    const data = await response.json();

    if (!response.ok) {
      return data.error || "Something went wrong.";
    }

    return data.answer;
  } catch (error) {
    console.error(error);
    return "Something went wrong.";
  }
}
