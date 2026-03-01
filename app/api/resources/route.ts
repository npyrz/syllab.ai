import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { curateResourcesFromLectureNotes } from "@/lib/lecture-resource-curator";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const classId = String(body?.classId ?? "").trim();

    if (!classId) {
      return NextResponse.json({ error: "classId is required" }, { status: 400 });
    }

    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, userId: true, title: true },
    });

    if (!classRecord || classRecord.userId !== session.user.id) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const lectureNotes = await prisma.document.findMany({
      where: {
        classId,
        userId: session.user.id,
        status: "done",
        docType: "lecture_notes",
        textExtracted: { not: null },
      },
      orderBy: { createdAt: "desc" },
      select: {
        textExtracted: true,
      },
      take: 5,
    });

    const payload = await curateResourcesFromLectureNotes({
      classTitle: classRecord.title,
      lectureNoteTexts: lectureNotes.map((item) => item.textExtracted ?? ""),
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[Resources] Error generating resources:", error);
    return NextResponse.json({ error: "Failed to generate resources" }, { status: 500 });
  }
}
