import Anthropic from "@anthropic-ai/sdk";

/** Default model per Anthropic guidance; override with SEO_AI_MODEL. */
export const AI_MODEL = process.env.SEO_AI_MODEL || "claude-opus-5";

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY is not set. Add it to your environment to enable AI suggestions and auto-fix.",
    );
    this.name = "MissingApiKeyError";
  }
}

let cached: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new MissingApiKeyError();
  if (!cached) cached = new Anthropic();
  return cached;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Pull the first JSON object out of a model response, tolerating code fences
 * or stray prose around it. Throws if nothing parseable is found.
 */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("The AI response did not contain JSON.");
  }
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}

/** Concatenate the text blocks of a message response. */
export function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}
