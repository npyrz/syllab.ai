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