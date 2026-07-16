import { prisma } from "@/lib/prisma";
import { computeEffectiveCurrentWeek, startOfWeek } from "@/lib/week-utils";

type MaybeDate = Date | null | undefined;

function crossedSundayBoundary(previous: MaybeDate, now: Date): boolean {
  if (!previous) return true;
  return startOfWeek(previous).getTime() < startOfWeek(now).getTime();
}

export async function syncUserClassWeeksIfNeeded(params: {
  userId: string;
  now?: Date;
  previousSeenAt?: MaybeDate;
  previousLoginAt?: MaybeDate;
}) {
  const now = params.now ?? new Date();
  const shouldRun =
    crossedSundayBoundary(params.previousSeenAt, now) ||
    crossedSundayBoundary(params.previousLoginAt, now);

  if (!shouldRun) {
    return { scanned: 0, updated: 0 };
  }

  const classes = await prisma.class.findMany({
    where: {
      userId: params.userId,
      currentWeek: { not: null },
    },
    select: {
      id: true,
      currentWeek: true,
      currentWeekSetAt: true,
      createdAt: true,
    },
  });

  let updated = 0;

  for (const classRecord of classes) {
    const effectiveWeek = computeEffectiveCurrentWeek(classRecord, now);
    if (!effectiveWeek || effectiveWeek === classRecord.currentWeek) continue;

    await prisma.class.update({
      where: { id: classRecord.id },
      data: {
        currentWeek: effectiveWeek,
        currentWeekSetAt: now,
      },
    });
    updated += 1;
  }

  return { scanned: classes.length, updated };
}
