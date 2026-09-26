"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg space-y-4 py-10 text-center">
      <h1 className="page-title">Something went wrong</h1>
      <p className="text-ink-2">{error.message.includes("Supabase") ? error.message : "The page could not load. Check your connection and try again."}</p>
      <button type="button" className="btn-primary" onClick={reset}>Try again</button>
    </div>
  );
}
