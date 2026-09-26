/** Shown instantly while a page loads, so a tapped link never feels frozen. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="animate-pulse space-y-5">
      <div className="h-3 w-40 rounded-full bg-surface-2" />
      <div className="h-9 w-72 max-w-full rounded-xl bg-surface-2" />
      <div className="h-4 w-96 max-w-full rounded-full bg-surface-2" />
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0">
            <div className="size-6 rounded-full bg-surface-2" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-48 max-w-[60%] rounded-full bg-surface-2" />
              <div className="h-3 w-32 max-w-[40%] rounded-full bg-surface-2" />
            </div>
            <div className="h-5 w-14 rounded-lg bg-surface-2" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
