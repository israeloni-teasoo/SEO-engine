// Pluggable LLM provider so the app can run on a FREE tier (Google Gemini) or
// any OpenAI-compatible endpoint (Groq, OpenRouter, OpenAI), as well as Claude.
//
// Selection order:
//   1. AI_PROVIDER env ("gemini" | "anthropic" | "openai")
//   2. whichever API key is present (Gemini -> Anthropic -> OpenAI)
//
// Keys:
//   GEMINI_API_KEY (or GOOGLE_AI_API_KEY)   — free at https://aistudio.google.com/apikey
//   ANTHROPIC_API_KEY
//   OPENAI_API_KEY (+ optional OPENAI_BASE_URL for Groq/OpenRouter)

import Anthropic from "@anthropic-ai/sdk";

export type AiProviderName = "gemini" | "anthropic" | "openai";

export class AiNotConfiguredError extends Error {
  constructor() {
    super(
      "No AI provider is configured. Set GEMINI_API_KEY (free), ANTHROPIC_API_KEY, or OPENAI_API_KEY.",
    );
    this.name = "AiNotConfiguredError";
  }
}

const geminiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;

export function activeProvider(): AiProviderName | null {
  const forced = process.env.AI_PROVIDER as AiProviderName | undefined;
  if (forced === "gemini" && geminiKey()) return "gemini";
  if (forced === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (forced === "openai" && process.env.OPENAI_API_KEY) return "openai";
  if (geminiKey()) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

export function aiConfigured(): boolean {
  return activeProvider() !== null;
}

/** fetch with an abort timeout, converting a hang into a clean error. */
async function fetchTimeout(url: string, init: RequestInit, ms = 55000): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
  } catch (e) {
    if ((e as Error).name === "TimeoutError" || (e as Error).name === "AbortError") {
      throw new Error("The AI provider took too long to respond. Try again, or shorten the article.");
    }
    throw e;
  }
}

function modelFor(p: AiProviderName): string {
  if (process.env.SEO_AI_MODEL) return process.env.SEO_AI_MODEL;
  if (p === "gemini") return "gemini-3.6-flash";
  if (p === "anthropic") return "claude-opus-5";
  return "gpt-4o-mini";
}

export interface GenerateOpts {
  system: string;
  prompt: string;
  maxTokens?: number;
  /** Ask the provider to return strict JSON when supported. */
  json?: boolean;
}

/** Generate text with the active provider. Throws AiNotConfiguredError if none. */
export async function generateText(opts: GenerateOpts): Promise<string> {
  const provider = activeProvider();
  if (!provider) throw new AiNotConfiguredError();
  const model = modelFor(provider);
  const maxTokens = opts.maxTokens ?? 4000;

  if (provider === "gemini") return geminiText(model, opts, maxTokens);
  if (provider === "openai") return openaiText(model, opts, maxTokens);
  return anthropicText(model, opts, maxTokens);
}

export interface VisionImage {
  url: string;
}

/**
 * Generate JSON from a prompt plus images (used for alt text). Providers that
 * can't fetch a URL directly (Gemini) have the images fetched and inlined.
 */
export async function generateVisionText(
  system: string,
  prompt: string,
  images: VisionImage[],
  maxTokens = 1500,
): Promise<string> {
  const provider = activeProvider();
  if (!provider) throw new AiNotConfiguredError();
  const model = modelFor(provider);
  if (provider === "gemini") return geminiVision(model, system, prompt, images, maxTokens);
  if (provider === "openai") return openaiVision(model, system, prompt, images, maxTokens);
  return anthropicVision(model, system, prompt, images, maxTokens);
}

// ---------------- Anthropic ----------------

let anthropicClient: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!anthropicClient) anthropicClient = new Anthropic();
  return anthropicClient;
}

async function anthropicText(model: string, opts: GenerateOpts, maxTokens: number): Promise<string> {
  const res = await anthropic().messages.create({
    model,
    max_tokens: maxTokens,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
  });
  return res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
}

async function anthropicVision(
  model: string, system: string, prompt: string, images: VisionImage[], maxTokens: number,
): Promise<string> {
  const content: Anthropic.ContentBlockParam[] = [{ type: "text", text: prompt }];
  for (const img of images) {
    content.push({ type: "image", source: { type: "url", url: img.url } });
  }
  const res = await anthropic().messages.create({
    model, max_tokens: maxTokens, system, messages: [{ role: "user", content }],
  });
  return res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
}

// ---------------- Google Gemini (free tier) ----------------

/**
 * POST to Gemini generateContent. If the model 404s because it was retired,
 * Google's error names the replacement ("...use models/gemini-3.6-flash...") —
 * we extract it and retry once, so model deprecations self-heal.
 */
async function geminiRequest(
  model: string,
  body: Record<string, unknown>,
  label: string,
  allowModelSwap = true,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey()}`;
  const res = await fetchTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 404 && allowModelSwap) {
      const recommended = text.match(/use\s+models\/([a-zA-Z0-9.\-]+)/)?.[1];
      if (recommended && recommended !== model) {
        return geminiRequest(recommended, body, label, false);
      }
    }
    throw new Error(
      `${label} (${res.status}): ${text}${res.status === 404 ? " — set SEO_AI_MODEL to a current Gemini model." : ""}`,
    );
  }
  return geminiExtract(await res.json());
}

async function geminiText(model: string, opts: GenerateOpts, maxTokens: number): Promise<string> {
  return geminiRequest(
    model,
    {
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
      },
    },
    "Gemini error",
  );
}

async function geminiVision(
  model: string, system: string, prompt: string, images: VisionImage[], maxTokens: number,
): Promise<string> {
  const parts: unknown[] = [{ text: prompt }];
  for (const img of images) {
    const inlined = await fetchAsInlineData(img.url);
    if (inlined) parts.push({ inline_data: inlined });
  }
  return geminiRequest(
    model,
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts }],
      generationConfig: { maxOutputTokens: maxTokens, responseMimeType: "application/json" },
    },
    "Gemini vision error",
  );
}

function geminiExtract(json: unknown): string {
  const j = json as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
}

async function fetchAsInlineData(url: string): Promise<{ mime_type: string; data: string } | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mime = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 4_000_000) return null; // keep requests small
    return { mime_type: mime, data: buf.toString("base64") };
  } catch {
    return null;
  }
}

// ---------------- OpenAI-compatible (Groq / OpenRouter / OpenAI) ----------------

function openaiBase(): string {
  return (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
}

async function openaiText(model: string, opts: GenerateOpts, maxTokens: number): Promise<string> {
  const res = await fetchTimeout(`${openaiBase()}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.prompt },
      ],
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`OpenAI-compatible error (${res.status}): ${await res.text()}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

async function openaiVision(
  model: string, system: string, prompt: string, images: VisionImage[], maxTokens: number,
): Promise<string> {
  const content: unknown[] = [{ type: "text", text: prompt }];
  for (const img of images) content.push({ type: "image_url", image_url: { url: img.url } });
  const res = await fetchTimeout(`${openaiBase()}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model, max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI-compatible vision error (${res.status}): ${await res.text()}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

/** Pull the first JSON object/array out of a model response. */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  const endObj = candidate.lastIndexOf("}");
  const endArr = candidate.lastIndexOf("]");
  const end = Math.max(endObj, endArr);
  if (start === -1 || end <= start) throw new Error("The AI response did not contain JSON.");
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}
