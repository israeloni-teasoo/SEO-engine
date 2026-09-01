import { NextResponse } from "next/server";
import { activeProvider } from "@/lib/ai/provider";

export const runtime = "nodejs";

export async function GET() {
  const provider = activeProvider();
  return NextResponse.json({ configured: provider !== null, provider });
}
