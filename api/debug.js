// Temporary debug endpoint — delete after fixing env var issue
module.exports = function handler(req, res) {
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  const keyPreview = process.env.ANTHROPIC_API_KEY
    ? process.env.ANTHROPIC_API_KEY.slice(0, 15) + "..."
    : "undefined";

  return res.status(200).json({
    ANTHROPIC_API_KEY_set: hasKey,
    ANTHROPIC_API_KEY_preview: keyPreview,
    NODE_ENV: process.env.NODE_ENV
  });
};
