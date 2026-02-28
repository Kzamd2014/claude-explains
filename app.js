// ── Configuration ─────────────────────────────────────────────────────────────
// The Anthropic API key lives server-side in /api/ask.js — never here.
// The Supabase anon key is safe to use in the browser (it's public by design).
const SUPABASE_URL      = "https://heoylzckgecwcdjjtonh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhlb3lsemNrZ2Vjd2Nkamp0b25oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMjA3NjMsImV4cCI6MjA4NzY5Njc2M30.bDVuvKBt29pbXtsx8ZGTwHBnNLhEJSGF2OYzzd9Zp3g";

// ── DOM references ─────────────────────────────────────────────────────────────
const questionInput = document.getElementById("question-input");
const submitBtn     = document.getElementById("submit-btn");
const loadingEl     = document.getElementById("loading");
const errorBox      = document.getElementById("error-box");
const errorMessage  = document.getElementById("error-message");
const answerSection = document.getElementById("answer-section");
const answerText    = document.getElementById("answer-text");
const feed          = document.getElementById("feed");

// ── UI helpers ─────────────────────────────────────────────────────────────────

// Show or hide an element by toggling the "hidden" CSS class
function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden");    }

// Display an error message in the error box
function showError(msg) {
  errorMessage.textContent = msg;
  show(errorBox);
}

// Reset UI to a clean state before each new request
function resetUI() {
  hide(errorBox);
  hide(answerSection);
  hide(loadingEl);
  answerText.textContent = "";
}

// Lock/unlock the form while a request is in flight
function setLoading(isLoading) {
  submitBtn.disabled  = isLoading;
  questionInput.disabled = isLoading;
  isLoading ? show(loadingEl) : hide(loadingEl);
}

// ── Claude API ─────────────────────────────────────────────────────────────────

/**
 * Send a question to our Vercel serverless function, which calls Claude
 * server-side. The API key never touches the browser.
 *
 * @param {string} question - The user's question
 * @returns {Promise<string>} - Claude's answer
 */
async function askClaude(question) {
  const response = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Server error ${response.status}`);
  }

  return data.answer;
}

// ── Supabase helpers ───────────────────────────────────────────────────────────

/**
 * Save a question + answer pair to the "questions" table in Supabase.
 *
 * @param {string} question
 * @param {string} answer
 */
async function saveToSupabase(question, answer) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/questions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      // Return the inserted row so we can use it if needed
      "Prefer": "return=representation"
    },
    body: JSON.stringify({ question, answer })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    // Log but don't block the user — saving is non-critical
    console.error("Supabase save failed:", err);
  }
}

/**
 * Load all questions from Supabase, newest first.
 *
 * @returns {Promise<Array>} - Array of { question, answer } objects
 */
async function loadFeed() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/questions?select=question,answer&order=created_at.desc`,
    {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      }
    }
  );

  if (!response.ok) {
    console.error("Could not load feed from Supabase");
    return [];
  }

  return response.json();
}

// ── Feed rendering ─────────────────────────────────────────────────────────────

/**
 * Render the community feed from an array of Q&A objects.
 *
 * @param {Array} items
 */
function renderFeed(items) {
  if (items.length === 0) {
    feed.innerHTML = '<p class="feed-empty">No questions yet. Be the first!</p>';
    return;
  }

  feed.innerHTML = items
    .map(
      (item) => `
        <div class="feed-item">
          <p class="question">Q: ${escapeHtml(item.question)}</p>
          <p class="answer">${escapeHtml(item.answer)}</p>
        </div>
      `
    )
    .join("");
}

// Prevent XSS by escaping user-generated content before inserting into the DOM
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Main submit handler ────────────────────────────────────────────────────────

submitBtn.addEventListener("click", async () => {
  const question = questionInput.value.trim();

  // Don't submit empty questions
  if (!question) {
    showError("Please enter a question first.");
    return;
  }

  resetUI();
  setLoading(true);

  try {
    // 1. Ask Claude
    const answer = await askClaude(question);

    // 2. Show the answer
    answerText.textContent = answer;
    show(answerSection);

    // 3. Save to Supabase (non-blocking — errors are logged, not shown)
    await saveToSupabase(question, answer);

    // 4. Refresh the community feed
    const items = await loadFeed();
    renderFeed(items);

    // 5. Clear the input for the next question
    questionInput.value = "";

  } catch (err) {
    // Surface any error to the user in a friendly way
    showError(`Something went wrong: ${err.message}`);
  } finally {
    // Always re-enable the form, whether we succeeded or failed
    setLoading(false);
  }
});

// ── Init ───────────────────────────────────────────────────────────────────────

// Load existing questions when the page first opens
(async () => {
  const items = await loadFeed();
  renderFeed(items);
})();
