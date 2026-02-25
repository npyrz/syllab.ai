export default function WeeklyScheduleSkeleton() {
  return (
    <div className="rounded-3xl bg-[color:var(--app-surface)] p-6 ring-1 ring-[color:var(--app-border)] shadow-[var(--app-shadow)]">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-[color:var(--app-text)]">This week</h3>
        <p className="mt-1 text-xs text-[color:var(--app-subtle)]">
          <span className="inline-block h-4 w-24 bg-[color:var(--app-panel)] rounded animate-pulse" />
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="rounded-2xl bg-[color:var(--app-panel)] px-4 py-3.5 ring-1 ring-[color:var(--app-border)] shadow-sm"
          >
            <div className="h-3 w-12 bg-[color:var(--app-muted)] rounded animate-pulse mb-2" />
            <div className="space-y-2">
              <div className="h-4 w-32 bg-[color:var(--app-muted)] rounded animate-pulse" />
              <div className="h-3 w-24 bg-[color:var(--app-muted)] rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
