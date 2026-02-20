import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/classes
 * Fetch all classes for the authenticated user
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const classes = await prisma.class.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { documents: true },
      },
    },
  });

  return NextResponse.json({ classes });
}

/**
 * POST /api/classes
 * Create a new class for the authenticated user
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { title, description } = body;

    if (!title || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const newClass = await prisma.class.create({
      data: {
        userId: session.user.id,
        title: title.trim(),
        description: description?.trim() || null,
      },
    });

    return NextResponse.json({ 
      success: true,
      class: newClass,
    });
  } catch (error) {
    console.error('[Classes] Error creating class:', error);
    return NextResponse.json(
      { error: "Failed to create class" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/classes
 * Delete a class (and its documents) owned by the authenticated user
 */
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id } = body as { id?: string };

    if (!id) {
      return NextResponse.json({ error: "Class id is required" }, { status: 400 });
    }

    const existing = await prisma.class.findUnique({ where: { id } });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    await prisma.class.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Classes] Error deleting class:", error);
    return NextResponse.json(
      { error: "Failed to delete class" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/classes
 * Update class semester and current week information
 */
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { classId, semester, currentWeek } = body as {
      classId?: string;
      semester?: string;
      currentWeek?: number;
    };

    if (!classId) {
      return NextResponse.json({ error: "Class id is required" }, { status: 400 });
    }

    const existing = await prisma.class.findUnique({ where: { id: classId } });
    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    const updated = await prisma.class.update({
      where: { id: classId },
      data: {
        semester: semester !== undefined ? semester : existing.semester,
        currentWeek: currentWeek !== undefined ? currentWeek : existing.currentWeek,
      },
    });

    return NextResponse.json({ success: true, class: updated });
  } catch (error) {
    console.error("[Classes] Error updating class:", error);
    return NextResponse.json(
      { error: "Failed to update class" },
      { status: 500 }
    );
  }
}