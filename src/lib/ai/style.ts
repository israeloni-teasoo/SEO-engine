// Author-voice preservation + de-"AI"-ification for anything the model writes.
//
// Two layers:
//   1. STYLE_RULES — appended to every writing/rewrite system prompt so the model
//      mirrors the original author's tone, formality, and vocabulary and avoids
//      tell-tale AI phrasing and em dashes.
//   2. sanitizeAiText() — a deterministic post-pass that removes em/en dashes used
//      as separators and repairs the spacing, regardless of what the model did.

export const STYLE_RULES = `
STYLE — match the ORIGINAL AUTHOR, do not impose an "AI" voice:
- Mirror the author's tone, formality, vocabulary, and sentence rhythm. If the
  original reads formal, stay formal; if casual, stay casual. Do not make casual
  writing sound corporate or vice versa.
- NEVER use em dashes (—) or en dashes (–). Use commas, periods, or parentheses.
- Avoid AI-tell phrasing and clichés, including: "delve", "in today's world",
  "in the realm of", "navigating the", "it's important to note", "it's worth
  noting", "unlock", "elevate", "leverage" (as filler), "tapestry", "testament
  to", "boasts", "seamless", "game-changer", "dive in", "embark", "furthermore/
  moreover" used repeatedly, "in conclusion", and the "it's not just X, it's Y"
  construction.
- Do not add emojis the author didn't use. Do not start sentences with the same
  filler repeatedly. Keep contractions if the author uses them.
- Preserve the author's meaning and facts exactly. Improve clarity and SEO
  without changing what they are saying or their personality.`.trim();

/**
 * Remove em/en dashes and other subtle AI markers from generated text. Safe to
 * run over HTML — it only touches text, not tags. Leaves numeric en-dash ranges
 * (e.g. "2020–2024") intact.
 */
export function sanitizeAiText(input: string): string {
  if (!input) return input;
  let s = input;

  // Em dash used as a separator -> comma. "word — word" or "word—word".
  s = s.replace(/\s*—\s*/g, ", ");
  // Spaced en dash used as a separator -> comma (keep 2020–2024 ranges).
  s = s.replace(/(\D)\s+–\s+(\D)/g, "$1, $2");
  s = s.replace(/([A-Za-z])\s*–\s*([A-Za-z])/g, "$1, $2");
  // Horizontal-bar / figure-dash variants.
  s = s.replace(/\s*[―‒]\s*/g, ", ");

  // Repair artifacts the replacements can create.
  s = s.replace(/ ,/g, ",");
  s = s.replace(/,\s*,/g, ",");
  s = s.replace(/,\s*\./g, ".");
  s = s.replace(/,\s*([)\]])/g, "$1");
  s = s.replace(/([([])\s*,\s*/g, "$1");
  // Collapse doubled spaces that aren't inside tags.
  s = s.replace(/ {2,}/g, " ");

  return s;
}
