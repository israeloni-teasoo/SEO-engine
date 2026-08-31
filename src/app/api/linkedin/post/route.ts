import { NextResponse } from "next/server";
import { createPost, getUserInfo } from "@/lib/linkedin/client";
import { resolveLinkedIn } from "@/lib/linkedin/token";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const resolved = await resolveLinkedIn(req).catch(() => null);
  if (!resolved) {
    return NextResponse.json(
      { error: "Not connected to LinkedIn. Connect your account first." },
      { status: 401 },
    );
  }

  let body: { commentary?: string; target?: "member" | "organization"; orgId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const commentary = (body.commentary ?? "").trim();
  if (!commentary) {
    return NextResponse.json({ error: "Post text is empty." }, { status: 400 });
  }

  try {
    let authorUrn: string;
    if (body.target === "organization") {
      const orgId = body.orgId || resolved.orgId;
      if (!orgId) {
        return NextResponse.json(
          { error: "No LinkedIn organization ID configured (needs an approved w_organization_social app)." },
          { status: 400 },
        );
      }
      authorUrn = `urn:li:organization:${orgId}`;
    } else {
      const sub = resolved.sub || (await getUserInfo(resolved.accessToken)).sub;
      authorUrn = `urn:li:person:${sub}`;
    }

    const post = await createPost({ accessToken: resolved.accessToken, authorUrn, commentary });
    return NextResponse.json({ ok: true, post });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
