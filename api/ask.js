// ── /api/ask.js ────────────────────────────────────────────────────────────────
// Vercel serverless function — runs on the server, never in the browser.
// The ANTHROPIC_API_KEY environment variable is only accessible here,
// keeping it safe from anyone inspecting the page source or DevTools.

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { question } = req.body;

  if (!question || typeof question !== "string" || question.trim() === "") {
    return res.status(400).json({ error: "A question is required." });
  }

  // Catch missing env var early with a clear message
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY is not set on the server." });
  }

  try {
    // Call the Anthropic API using the server-side environment variable
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `Please explain the following clearly and concisely:\n\n${question.trim()}`
          }
        ]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Anthropic API error ${response.status}`);
    }

    const data = await response.json();
    const answer = data.content[0].text;

    // Return the answer to the browser
    return res.status(200).json({ answer });

  } catch (err) {
    console.error("Claude API error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
