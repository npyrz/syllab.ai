import WeeklySchedule from "@/app/components/WeeklySchedule";
import { getOrCreateWeekScheduleForClass } from "@/lib/week-schedule-service";
import { getWeekDateRange } from "@/lib/week-utils";

export default async function WeeklyScheduleLoader({
  classId,
  userId,
  currentWeek,
}: {
  classId: string;
  userId: string;
  currentWeek: number | null;
}) {
  const now = new Date();
  const weekRange = currentWeek ? getWeekDateRange(currentWeek, now) : null;

  if (!currentWeek) {
    return (
      <WeeklySchedule
        currentWeek={currentWeek}
        weekStart={weekRange?.start}
        weekEnd={weekRange?.end}
        days={[]}
      />
    );
  }

  const weekSchedule = await getOrCreateWeekScheduleForClass({
    classId,
    userId,
    targetWeek: currentWeek,
  });

  return (
    <WeeklySchedule
      currentWeek={currentWeek}
      weekStart={weekRange?.start}
      weekEnd={weekRange?.end}
      days={weekSchedule?.days ?? []}
    />
  );
}
