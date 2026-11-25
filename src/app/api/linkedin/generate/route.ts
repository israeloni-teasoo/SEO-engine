import { NextResponse } from "next/server";
import { generateLinkedInPost } from "@/lib/ai/linkedin-post";
import { aiConfigured } from "@/lib/ai/provider";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  title?: string;
  content?: string;
  focusKeyphrase?: string;
  metaDescription?: string;
  url?: string;
  tags?: string[];
}

/** A decent LinkedIn post built with no AI — used when no key, or AI fails. */
function ruleBased(input: Body): string {
  const title = (input.title || "New article").trim();
  const meta = (input.metaDescription || "").trim();
  const hashtags = (input.tags || [])
    .slice(0, 4)
    .map((t) => "#" + t.replace(/[^a-zA-Z0-9]/g, ""))
    .filter((h) => h.length > 2);
  const lines = [
    title,
    "",
    meta || "We just published a new article worth your time.",
    "",
    input.url ? `Read the full piece 👉 ${input.url}` : "Read the full piece on our blog.",
  ];
  if (hashtags.length) lines.push("", hashtags.join(" "));
  return lines.join("\n");
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.title && !body.content) {
    return NextResponse.json({ error: "Nothing to generate from — add a title or content first." }, { status: 400 });
  }

  if (!aiConfigured()) {
    return NextResponse.json({ text: ruleBased(body), source: "rule" });
  }
  try {
    const text = await generateLinkedInPost({
      title: body.title || "",
      content: body.content || "",
      focusKeyphrase: body.focusKeyphrase,
      url: body.url,
    });
    return NextResponse.json({ text, source: "ai" });
  } catch (e) {
    // Fall back to a usable post rather than failing the dialog.
    return NextResponse.json({ text: ruleBased(body), source: "rule", note: (e as Error).message });
  }
}
