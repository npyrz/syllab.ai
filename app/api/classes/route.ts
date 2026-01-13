import { NextResponse } from "next/server";

// Example route handler for classes
export async function GET() {
  return NextResponse.json({ classes: [] });
}

export async function POST(req: Request) {
  const data = await req.json();
  return NextResponse.json({ ok: true, data });
}
