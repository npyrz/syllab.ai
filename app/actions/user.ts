"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function touchLastSeenAction() {
  const session = await auth();
  const userId = (session?.user as unknown as { id?: string } | undefined)?.id;
  if (!userId) return;

  // Avoid throwing if the user record does not exist yet.
  await prisma.user.updateMany({
    where: { id: userId },
    data: { lastSeenAt: new Date() },
  });
}
