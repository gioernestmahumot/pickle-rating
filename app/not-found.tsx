import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg space-y-3 py-10 text-center">
      <h1 className="page-title">Not found</h1>
      <p className="text-ink-2">That player, match, club or tournament doesn&apos;t exist, or the link is wrong.</p>
      <Link href="/" className="btn-primary">Back to rankings</Link>
    </div>
  );
}
