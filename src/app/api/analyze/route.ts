import { NextResponse } from "next/server";
import { analyze } from "@/lib/analysis/index";
import type { AnalysisInput } from "@/lib/analysis/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: Partial<AnalysisInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const input: AnalysisInput = {
    title: body.title ?? "",
    content: body.content ?? "",
    metaDescription: body.metaDescription ?? "",
    focusKeyphrase: body.focusKeyphrase ?? "",
    slug: body.slug ?? "",
    siteDomain: body.siteDomain || process.env.SITE_DOMAIN || undefined,
  };

  try {
    const result = analyze(input);
    // Omit the heavy `parsed` blob from the wire response.
    const { parsed: _parsed, ...lean } = result;
    return NextResponse.json(lean);
  } catch (e) {
    return NextResponse.json(
      { error: `Analysis failed: ${(e as Error).message}` },
      { status: 500 },
    );
  }
}
