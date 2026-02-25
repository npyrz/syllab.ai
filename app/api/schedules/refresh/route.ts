import { NextResponse } from "next/server";
import { precomputeNextWeekSchedulesForActiveClasses } from "@/lib/week-schedule-service";

function isAuthorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;

  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await precomputeNextWeekSchedulesForActiveClasses();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[WeekScheduleCron] refresh failed", error);
    return NextResponse.json({ error: "Failed to refresh schedules" }, { status: 500 });
  }
}
