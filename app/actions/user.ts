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

function isValidTimeZone(timeZone: string) {
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export async function updateUserTimezoneAction(timeZone: string) {
  const session = await auth();
  const userId = (session?.user as unknown as { id?: string } | undefined)?.id;
  if (!userId) return;

  const cleaned = String(timeZone ?? "").trim();
  if (!cleaned || !isValidTimeZone(cleaned)) return;

  await prisma.user.updateMany({
    where: { id: userId },
    data: { timezone: cleaned },
  });
}

export async function updateUserThemeAction(theme: string) {
  const session = await auth();
  const userId = (session?.user as unknown as { id?: string } | undefined)?.id;
  if (!userId) return;

  const cleaned = String(theme ?? "").trim();
  if (cleaned !== "light" && cleaned !== "dark") return;

  await prisma.user.updateMany({
    where: { id: userId },
    data: { theme: cleaned },
  });
}


