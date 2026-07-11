import axios from "axios";

export async function askGroq(question) {
  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",

        messages: [
          {
            role: "system",
            content: `
      You are RehabConnect AI, an assistant for a rehabilitation website.
      
      Rules:
      - Give concise answers (maximum 150 words).
      - Focus on rehabilitation, physiotherapy, exercises, assistive devices, and recovery.
      - If the user asks about pain or injuries, suggest general exercises and advise consulting a doctor for serious symptoms.
      - Use short numbered lists instead of Markdown bullets.
      - Do not use *, **, #, or any Markdown formatting.
      - Do not invent rehabilitation centres.
      - Keep the tone supportive and professional.
      `,
          },

          {
            role: "user",
            content: `Answer briefly with each point on a separate line:\n${question}`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error(error);
    return "Something went wrong.";
  }
}
