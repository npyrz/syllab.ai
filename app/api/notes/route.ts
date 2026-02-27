import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const MAX_NOTE_TITLE_LENGTH = 120;
const MAX_NOTE_CONTENT_LENGTH = 20_000;

function sanitizeTitle(value: unknown) {
  const cleaned = String(value ?? "").trim();
  if (!cleaned) return "Untitled note";
  return cleaned.slice(0, MAX_NOTE_TITLE_LENGTH);
}

function sanitizeContent(value: unknown) {
  return String(value ?? "").trim().slice(0, MAX_NOTE_CONTENT_LENGTH);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId")?.trim();

  if (!classId) {
    return NextResponse.json({ error: "Class ID is required" }, { status: 400 });
  }

  const classRecord = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, userId: true },
  });

  if (!classRecord || classRecord.userId !== session.user.id) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  const notes = await prisma.note.findMany({
    where: {
      classId,
      userId: session.user.id,
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      classId: true,
      title: true,
      content: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ notes });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const classId = String(body?.classId ?? "").trim();
    const title = sanitizeTitle(body?.title);
    const content = sanitizeContent(body?.content);

    if (!classId) {
      return NextResponse.json({ error: "Class ID is required" }, { status: 400 });
    }

    if (!content) {
      return NextResponse.json({ error: "Note content is required" }, { status: 400 });
    }

    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, userId: true },
    });

    if (!classRecord || classRecord.userId !== session.user.id) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const note = await prisma.note.create({
      data: {
        classId,
        userId: session.user.id,
        title,
        content,
      },
      select: {
        id: true,
        classId: true,
        title: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, note });
  } catch (error) {
    console.error("[Notes] Error creating note:", error);
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const id = String(body?.id ?? "").trim();

    if (!id) {
      return NextResponse.json({ error: "Note ID is required" }, { status: 400 });
    }

    const existing = await prisma.note.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const hasTitle = Object.prototype.hasOwnProperty.call(body, "title");
    const hasContent = Object.prototype.hasOwnProperty.call(body, "content");

    if (!hasTitle && !hasContent) {
      return NextResponse.json({ error: "No note fields to update" }, { status: 400 });
    }

    const note = await prisma.note.update({
      where: { id },
      data: {
        ...(hasTitle ? { title: sanitizeTitle(body?.title) } : {}),
        ...(hasContent ? { content: sanitizeContent(body?.content) } : {}),
      },
      select: {
        id: true,
        classId: true,
        title: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, note });
  } catch (error) {
    console.error("[Notes] Error updating note:", error);
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const id = String(body?.id ?? "").trim();

    if (!id) {
      return NextResponse.json({ error: "Note ID is required" }, { status: 400 });
    }

    const existing = await prisma.note.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    await prisma.note.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Notes] Error deleting note:", error);
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
