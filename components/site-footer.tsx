import Link from "next/link";
import { getContactUrl } from "@/lib/site";

export function SiteFooter() {
  const contactUrl = getContactUrl();
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-7 pb-28 sm:flex-row sm:items-center sm:justify-between md:px-8 md:pb-9">
        <div>
          <p className="font-display text-lg font-extrabold">Pickle Rating</p>
          <p className="text-sm text-ink-3">Philippine pickleball rankings from confirmed matches.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-3">
          <Link href="/feedback" className="btn bg-brand text-brand-ink">
            <svg className="size-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 5h16v11H8l-4 4z" /></svg>
            Send feedback
          </Link>
          {contactUrl && <a href={contactUrl} className="btn-secondary" target="_blank" rel="noreferrer">Facebook page</a>}
        </nav>
      </div>
    </footer>
  );
}
