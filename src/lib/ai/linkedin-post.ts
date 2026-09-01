import { generateText } from "./provider";
import { STYLE_RULES, sanitizeAiText } from "./style";

export interface LinkedInDraftInput {
  title: string;
  content: string;
  focusKeyphrase?: string;
  url?: string;
}

const SYSTEM = `You write high-performing LinkedIn posts that drive reach and clicks to a blog article.
Style:
- Open with a strong one-line hook (no "I'm excited to share").
- Short lines and line breaks; scannable. 120-180 words.
- Conversational and specific; pull 2-4 concrete takeaways from the article.
- End with a soft call to action to read the full post.
- Add 3-5 relevant hashtags on the last line.
- Plain text only (no markdown).
Return ONLY the post text — no preamble, no quotes.`;

export async function generateLinkedInPost(input: LinkedInDraftInput): Promise<string> {
  const prompt = [
    `Article title: ${input.title}`,
    input.focusKeyphrase ? `Topic: ${input.focusKeyphrase}` : "",
    input.url ? `Link to include: ${input.url}` : "",
    "",
    "Article:",
    input.content,
  ].filter(Boolean).join("\n");

  const text = await generateText({ system: `${SYSTEM}\n\n${STYLE_RULES}`, prompt, maxTokens: 1200 });
  return sanitizeAiText(text.trim());
}
