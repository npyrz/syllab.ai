import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateWeekRecommendationsForClass } from "@/lib/weekly-recommendation-service";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const classId = String(body?.classId ?? "").trim();
    const targetWeekRaw = body?.targetWeek;

    if (!classId) {
      return NextResponse.json({ error: "classId is required" }, { status: 400 });
    }

    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, userId: true, currentWeek: true },
    });

    if (!classRecord || classRecord.userId !== session.user.id) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const parsedWeek = Number.parseInt(String(targetWeekRaw ?? ""), 10);
    const targetWeek = Number.isFinite(parsedWeek) && parsedWeek >= 1
      ? Math.min(20, parsedWeek)
      : (classRecord.currentWeek ?? 1);

    const recommendation = await getOrCreateWeekRecommendationsForClass({
      classId,
      userId: session.user.id,
      targetWeek,
    });

    if (!recommendation || recommendation.resources.length === 0) {
      return NextResponse.json(
        {
          error: "No weekly content detected in syllabus or schedule",
          code: "NO_WEEKLY_CONTENT",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      week: recommendation.week,
      topicSource: recommendation.topicSource,
      topicSummary: recommendation.topicSummary,
      resources: recommendation.resources,
    });
  } catch (error) {
    console.error("[WeeklyResources] Error generating weekly resources:", error);
    return NextResponse.json({ error: "Failed to generate weekly resources" }, { status: 500 });
  }
}
