import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guard";
import { getSettings, updateSettings } from "@/lib/db/settings";
import { encryptionConfigured } from "@/lib/crypto";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await requireRole(req, "admin");
    const s = await getSettings();
    return NextResponse.json({
      settings: {
        wordpressUrl: s?.wordpressUrl ?? "",
        wordpressUsername: s?.wordpressUsername ?? "",
        wordpressPasswordSet: Boolean(s?.wordpressAppPasswordEnc),
        linkedinOrgId: s?.linkedinOrgId ?? "",
        siteDomain: s?.siteDomain ?? "",
      },
      encryptionConfigured: encryptionConfigured(),
    });
  } catch (e) {
    return authErrorResponse(e);
  }
}

export async function PUT(req: Request) {
  try {
    await requireRole(req, "admin");
    if (!encryptionConfigured()) {
      return NextResponse.json(
        { error: "Set ENCRYPTION_KEY before saving credentials." },
        { status: 400 },
      );
    }
    let body: {
      wordpressUrl?: string;
      wordpressUsername?: string;
      wordpressAppPassword?: string;
      linkedinOrgId?: string;
      siteDomain?: string;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    await updateSettings(body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e);
  }
}
