import WeeklySchedule from "@/app/components/WeeklySchedule";
import { getOrCreateWeekScheduleForClass } from "@/lib/week-schedule-service";

function parseISODate(value: string): Date | undefined {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

export default async function WeekDashboardLoader({
  classId,
  userId,
  currentWeek,
}: {
  classId: string;
  userId: string;
  currentWeek: number | null;
}) {
  if (!currentWeek) return null;

  const weekSchedule = await getOrCreateWeekScheduleForClass({
    classId,
    userId,
    targetWeek: currentWeek,
  });

  if (!weekSchedule) return null;

  return (
    <>
      <section className="mt-10">
        <WeeklySchedule
          currentWeek={weekSchedule.week}
          weekStart={parseISODate(weekSchedule.weekStartISO)}
          weekEnd={parseISODate(weekSchedule.weekEndISO)}
          days={weekSchedule.days}
        />
      </section>

      {weekSchedule.upcoming.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-sm font-semibold tracking-wide text-[color:var(--app-text)]">
            Upcoming
          </h2>
          <div className="mt-4 rounded-3xl bg-[color:var(--app-surface)] p-4 ring-1 ring-[color:var(--app-border)] shadow-[var(--app-shadow)]">
            <div className="mt-3 space-y-3">
              {weekSchedule.upcoming.slice(0, 3).map((item, idx) => (
                <div
                  key={`${item.dueDateISO}-${item.title}-${idx}`}
                  className="flex items-center justify-between rounded-2xl bg-[color:var(--app-panel)] px-4 py-3 text-sm text-[color:var(--app-text)] ring-1 ring-[color:var(--app-border)] shadow-sm"
                >
                  <div className="max-w-[70%] text-[13px] font-medium text-[color:var(--app-text)]">
                    {item.title}
                  </div>
                  <div className="text-[11px] font-semibold text-[color:var(--app-subtle)]">
                    {item.dueDowLabel}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
