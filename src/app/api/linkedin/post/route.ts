import { NextResponse } from "next/server";
import { createPost, getUserInfo } from "@/lib/linkedin/client";

export const runtime = "nodejs";
export const maxDuration = 60;

function tokenFrom(req: Request): string | null {
  return (
    req.headers.get("cookie")?.match(/(?:^|;\s*)li_access_token=([^;]+)/)?.[1] ?? null
  );
}

export async function POST(req: Request) {
  const token = tokenFrom(req);
  if (!token) {
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
      const orgId = body.orgId || process.env.LINKEDIN_ORG_ID;
      if (!orgId) {
        return NextResponse.json(
          { error: "No LinkedIn organization ID provided (needs an approved w_organization_social app)." },
          { status: 400 },
        );
      }
      authorUrn = `urn:li:organization:${orgId}`;
    } else {
      const user = await getUserInfo(token);
      authorUrn = `urn:li:person:${user.sub}`;
    }

    const post = await createPost({ accessToken: token, authorUrn, commentary });
    return NextResponse.json({ ok: true, post });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
