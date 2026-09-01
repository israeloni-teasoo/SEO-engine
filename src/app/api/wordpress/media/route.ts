import { NextResponse } from "next/server";
import { uploadMedia, WordPressError } from "@/lib/wordpress/client";
import type { WordPressCredentials } from "@/lib/wordpress/client";
import { authConfigured } from "@/lib/auth/session";
import { dbConfigured } from "@/lib/db/client";
import { getWordPressConfig } from "@/lib/db/settings";

export const runtime = "nodejs";
export const maxDuration = 60;

const multiUser = () => authConfigured() && dbConfigured();

async function resolveCreds(): Promise<WordPressCredentials | null> {
  if (multiUser()) return getWordPressConfig();
  const url = process.env.WORDPRESS_URL;
  const username = process.env.WORDPRESS_USERNAME;
  const applicationPassword = process.env.WORDPRESS_APP_PASSWORD;
  if (url && username && applicationPassword) return { url, username, applicationPassword };
  return null;
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data with a 'file' field." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const data = Buffer.from(await file.arrayBuffer());
  const filename = file.name || `image-${Date.now()}.png`;
  const contentType = file.type || "image/png";

  const creds = await resolveCreds();
  if (creds) {
    try {
      const media = await uploadMedia(creds, { filename, contentType, data });
      return NextResponse.json({ url: media.source_url, id: media.id, hosted: true });
    } catch (e) {
      const status = e instanceof WordPressError ? e.status || 502 : 500;
      return NextResponse.json({ error: (e as Error).message }, { status });
    }
  }

  // No WordPress connection yet — return an inline data URL so the writer can
  // keep going. It will be uploaded properly once WordPress is configured.
  const dataUrl = `data:${contentType};base64,${data.toString("base64")}`;
  return NextResponse.json({ url: dataUrl, hosted: false });
}
