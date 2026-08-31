import { AI_MODEL, getClient, textOf } from "./client";

export interface LinkedInDraftInput {
  title: string;
  content: string;
  focusKeyphrase?: string;
  /** Public URL of the published post, appended as the link if provided. */
  url?: string;
}

const SYSTEM = `You write high-performing LinkedIn posts that drive reach and clicks to a blog article.
Style:
- Open with a strong one-line hook (no "I'm excited to share").
- Short lines and line breaks; scannable. 120-180 words.
- Conversational and specific; pull 2-4 concrete takeaways from the article.
- End with a soft call to action to read the full post.
- Add 3-5 relevant hashtags on the last line.
- Plain text only (LinkedIn has no rich formatting). Do not use markdown.
Return ONLY the post text — no preamble, no quotes around it.`;

/** Generate a LinkedIn-native post adapted from the blog article. */
export async function generateLinkedInPost(input: LinkedInDraftInput): Promise<string> {
  const client = getClient();
  const brief = [
    `Article title: ${input.title}`,
    input.focusKeyphrase ? `Topic: ${input.focusKeyphrase}` : "",
    input.url ? `Link to include: ${input.url}` : "",
    "",
    "Article:",
    input.content,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.create({
    model: AI_MODEL,
    max_tokens: 1200,
    system: SYSTEM,
    messages: [{ role: "user", content: brief }],
  });

  return textOf(response.content).trim();
}
