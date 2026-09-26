"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Rankings", icon: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4a3 3 0 0 0 3 3M17 6h3a3 3 0 0 1-3 3" },
  { href: "/matches", label: "Matches", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/clubs", label: "Clubs", icon: "M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .8 3 3 3 6" },
  { href: "/tournaments", label: "Events", icon: "M4 5h5v4H4zM4 15h5v4H4zM9 7h4v10H9M13 12h7" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" || pathname.startsWith("/players") : pathname === href || (pathname.startsWith(`${href}/`) && pathname !== "/matches/new");
}

function Badge({ count }: { count: number }) {
  if (!count) return null;
  return <span className="ml-1 rounded-full bg-accent px-1.5 text-[11px] font-bold text-accent-ink">{count}</span>;
}

/** Desktop links in the header. */
export function HeaderNav({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={isActive(pathname, link.href) ? "page" : undefined}
          className={`rounded-xl px-3.5 py-2 text-[15px] font-semibold transition ${isActive(pathname, link.href) ? "bg-brand-2 text-brand-ink" : "text-brand-ink-2 hover:text-brand-ink"}`}
        >
          {link.label === "Events" ? "Tournaments" : link.label}
          {link.href === "/matches" && <Badge count={pendingCount} />}
        </Link>
      ))}
    </nav>
  );
}

/** Phone bottom menu with the record-match button in the middle. */
export function BottomNav({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname();
  const item = (link: (typeof LINKS)[number]) => {
    const active = isActive(pathname, link.href);
    return (
      <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className={`relative flex flex-col items-center gap-0.5 text-[11px] ${active ? "font-bold text-link" : "font-semibold text-ink-3"}`}>
        <svg className="size-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={link.icon} /></svg>
        {link.label}
        {link.href === "/matches" && pendingCount > 0 && (
          <span className="absolute -top-1 left-1/2 ml-2 rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-ink">{pendingCount}</span>
        )}
      </Link>
    );
  };
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 grid h-[72px] grid-cols-5 items-center border-t border-line bg-surface px-2 pb-2 md:hidden">
      {item(LINKS[0])}
      {item(LINKS[1])}
      <Link href="/matches/new" aria-label="Record a match" className="-mt-6 grid size-14 place-items-center justify-self-center rounded-full border-4 border-ground bg-accent text-accent-ink shadow-md">
        <svg className="size-6" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
      </Link>
      {item(LINKS[2])}
      {item(LINKS[3])}
    </nav>
  );
}
