import { getOrCreateWeekScheduleForClass } from "@/lib/week-schedule-service";

export async function primeCurrentWeekScheduleForClass(params: {
  classId: string;
  userId: string;
}) {
  const weekSchedule = await getOrCreateWeekScheduleForClass({
    classId: params.classId,
    userId: params.userId,
  });

  if (!weekSchedule) {
    return {
      primed: false,
      reason: "missing-input-data" as const,
      entryCount: 0,
    };
  }

  return {
    primed: true,
    reason: "generated" as const,
    entryCount: weekSchedule.days.length,
  };
}
