import { NextResponse } from "next/server";
import { analyze } from "@/lib/analysis/index";
import { buildAnalysisInput } from "@/lib/analysis/input";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const result = analyze(buildAnalysisInput(body));
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
